// =====================================================
// Katalog Okuyucu — tam ekran dergi görünümü
// =====================================================

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  Dimensions, StyleSheet, StatusBar, Platform, Linking, Share, Animated,
  Modal, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalog } from '../../src/hooks/useMarkets';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import { CatalogPage } from '../../src/types/api';

const { width: W } = Dimensions.get('window');
const THUMB_SIZE = 52;
const THUMB_GAP = 6;
const THUMB_STRIP_MAX = 24;

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function CatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: catalog, isLoading, isError, refetch } = useCatalog(id);
  const insets = useSafeAreaInsets();

  const [currentPage, setCurrentPage] = useState(0);
  const [uiVisible, setUiVisible] = useState(true);
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const uiOpacity = useRef(new Animated.Value(1)).current;

  const mainListRef = useRef<FlatList>(null);
  const thumbListRef = useRef<FlatList>(null);
  const pickerListRef = useRef<FlatList>(null);

  const topInset = insets.top;
  const bottomInset = insets.bottom;
  const topBarH = 52 + topInset;
  const bottomBarH = 120 + bottomInset;
  const viewerH = Dimensions.get('window').height - topBarH - bottomBarH;

  const toggleUI = useCallback(() => {
    const next = !uiVisible;
    setUiVisible(next);
    Animated.timing(uiOpacity, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [uiVisible, uiOpacity]);

  const goToPage = useCallback((index: number) => {
    if (!catalog?.pages?.length) return;
    const clamped = Math.max(0, Math.min(index, catalog.pages.length - 1));
    setCurrentPage(clamped);
    mainListRef.current?.scrollToIndex({ index: clamped, animated: true });
    if (clamped < THUMB_STRIP_MAX) {
      thumbListRef.current?.scrollToIndex({ index: clamped, animated: true, viewPosition: 0.5 });
    }
  }, [catalog?.pages?.length]);

  const onMainScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / W);
      if (page !== currentPage) setCurrentPage(page);
    },
    [currentPage],
  );

  const handleOpenPdf = useCallback(async () => {
    const url = catalog?.pdfUrl;
    if (!url) return;
    try { await Linking.openURL(url); } catch { /* ignore */ }
  }, [catalog]);

  const handleShare = useCallback(async () => {
    if (!catalog) return;
    const pages = catalog.pages ?? [];
    const url = catalog.pdfUrl || pages[currentPage]?.imageUrl || pages[0]?.imageUrl || '';
    try {
      await Share.share({
        title: catalog.title,
        message: url ? `${catalog.title}\n${url}` : catalog.title,
        url: Platform.OS === 'ios' ? url : undefined,
      });
    } catch { /* ignore */ }
  }, [catalog, currentPage]);

  const pages: CatalogPage[] = catalog?.pages ?? [];
  const showThumbStrip = pages.length > 0 && pages.length <= THUMB_STRIP_MAX;

  const pickerColumns = useMemo(() => {
    const cols = 3;
    const rows: CatalogPage[][] = [];
    for (let i = 0; i < pages.length; i += cols) {
      rows.push(pages.slice(i, i + cols));
    }
    return rows;
  }, [pages]);

  if (isLoading) return <LoadingScreen message="Katalog yükleniyor..." />;
  if (isError || !catalog) return <ErrorView message="Katalog bulunamadı" onRetry={refetch} />;

  const hasPdf = !!catalog.pdfUrl;
  const mkt = catalog.market;
  const brandColor = mkt?.brandColor ?? '#60a5fa';
  const start = new Date(catalog.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const end = new Date(catalog.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

  if (pages.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.emptyContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="images-outline" size={64} color="rgba(255,255,255,0.15)" />
          <Text style={styles.emptyTitle}>Katalog sayfaları hazır değil</Text>
          <Text style={styles.emptySub}>Bu katalog için henüz sayfa eklenmemiş</Text>
          {hasPdf && (
            <TouchableOpacity onPress={handleOpenPdf} style={[styles.actionBtn, { backgroundColor: brandColor }]}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>PDF'i Aç</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Ana görüntüleyici */}
      <View style={[styles.mainViewer, { marginTop: topBarH, marginBottom: bottomBarH }]}>
        <FlatList
          ref={mainListRef}
          data={pages}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onMainScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
          renderItem={({ item }: { item: CatalogPage }) => (
            <Pressable style={[styles.pageContainer, { height: viewerH }]} onPress={toggleUI}>
              <Image source={{ uri: item.imageUrl }} style={[styles.pageImage, { height: viewerH }]} resizeMode="contain" />
            </Pressable>
          )}
        />

        {/* Sol / sağ gezinme */}
        {uiVisible && (
          <>
            {currentPage > 0 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnLeft]}
                onPress={() => goToPage(currentPage - 1)}
                activeOpacity={0.85}
              >
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>
            )}
            {currentPage < pages.length - 1 && (
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnRight]}
                onPress={() => goToPage(currentPage + 1)}
                activeOpacity={0.85}
              >
                <Ionicons name="chevron-forward" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Üst bar */}
      <Animated.View
        style={[styles.topBar, { paddingTop: topInset, height: topBarH, opacity: uiOpacity }]}
        pointerEvents={uiVisible ? 'box-none' : 'none'}
      >
        <View style={styles.topBarBg} />
        <TouchableOpacity onPress={() => router.back()} style={styles.topIconBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <View style={styles.topMarketRow}>
            {mkt?.logoUrl ? (
              <Image source={{ uri: mkt.logoUrl }} style={styles.topMarketLogo} resizeMode="contain" />
            ) : null}
            <Text style={styles.topMarketName} numberOfLines={1}>{mkt?.name}</Text>
          </View>
          <Text style={styles.topTitle} numberOfLines={1}>{catalog.title}</Text>
          <Text style={styles.topSub}>{start} → {end}</Text>
        </View>
        <View style={styles.topActions}>
          {hasPdf && (
            <TouchableOpacity onPress={handleOpenPdf} style={styles.topIconBtn}>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.topIconBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Alt bar */}
      <Animated.View
        style={[styles.bottomBar, { paddingBottom: bottomInset + 8, opacity: uiOpacity }]}
        pointerEvents={uiVisible ? 'box-none' : 'none'}
      >
        <View style={styles.bottomBarBg} />

        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.pageCounterBtn} onPress={() => setPagePickerOpen(true)}>
            <Text style={styles.pageCounterText}>{currentPage + 1} / {pages.length}</Text>
            <Ionicons name="grid-outline" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <ProgressBar current={currentPage} total={pages.length} color={brandColor} />

          <View style={styles.bottomQuickNav}>
            <TouchableOpacity
              style={[styles.quickNavBtn, currentPage === 0 && styles.quickNavBtnDisabled]}
              onPress={() => goToPage(0)}
              disabled={currentPage === 0}
            >
              <Ionicons name="play-skip-back" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickNavBtn, currentPage >= pages.length - 1 && styles.quickNavBtnDisabled]}
              onPress={() => goToPage(pages.length - 1)}
              disabled={currentPage >= pages.length - 1}
            >
              <Ionicons name="play-skip-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {showThumbStrip ? (
          <FlatList
            ref={thumbListRef}
            data={pages}
            keyExtractor={(item) => `t-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbStrip}
            getItemLayout={(_, index) => ({
              length: THUMB_SIZE + THUMB_GAP,
              offset: (THUMB_SIZE + THUMB_GAP) * index,
              index,
            })}
            renderItem={({ item, index }: { item: CatalogPage; index: number }) => {
              const active = index === currentPage;
              return (
                <TouchableOpacity
                  onPress={() => goToPage(index)}
                  style={[styles.thumb, active && { borderColor: brandColor }]}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: item.thumbnailUrl || item.imageUrl }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                  <Text style={styles.thumbNum}>{index + 1}</Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <TouchableOpacity style={styles.pageListBtn} onPress={() => setPagePickerOpen(true)}>
            <Ionicons name="albums-outline" size={16} color="#fff" />
            <Text style={styles.pageListBtnText}>Tüm sayfaları gör ({pages.length})</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Sayfa seçici modal */}
      <Modal visible={pagePickerOpen} animationType="slide" transparent onRequestClose={() => setPagePickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: bottomInset + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sayfa Seç — {pages.length} sayfa</Text>
              <TouchableOpacity onPress={() => setPagePickerOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={pickerListRef}
              data={pickerColumns}
              keyExtractor={(_, i) => `row-${i}`}
              initialScrollIndex={Math.min(Math.floor(currentPage / 3), pickerColumns.length - 1)}
              getItemLayout={(_, index) => ({ length: 130, offset: 130 * index, index })}
              onScrollToIndexFailed={() => {}}
              contentContainerStyle={styles.pickerGrid}
              renderItem={({ item: row }: { item: CatalogPage[] }) => (
                <View style={styles.pickerRow}>
                  {row.map((page) => {
                    const idx = page.pageNumber - 1;
                    const active = idx === currentPage;
                    return (
                      <TouchableOpacity
                        key={page.id}
                        style={[styles.pickerCell, active && { borderColor: brandColor }]}
                        onPress={() => {
                          goToPage(idx);
                          setPagePickerOpen(false);
                        }}
                      >
                        <Image
                          source={{ uri: page.thumbnailUrl || page.imageUrl }}
                          style={styles.pickerImg}
                          resizeMode="cover"
                        />
                        <Text style={[styles.pickerNum, active && { color: brandColor }]}>
                          {page.pageNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },

  mainViewer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  pageContainer: {
    width: W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageImage: { width: W },

  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    width: 44,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnLeft: { left: 6 },
  navBtnRight: { right: 6 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  topBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  topCenter: { flex: 1, paddingHorizontal: 6 },
  topMarketRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  topMarketLogo: { width: 18, height: 18, borderRadius: 4 },
  topMarketName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 },
  topActions: { flexDirection: 'row', gap: 6 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
  },
  bottomBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 10,
  },
  pageCounterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  bottomQuickNav: { flexDirection: 'row', gap: 6 },
  quickNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickNavBtnDisabled: { opacity: 0.35 },

  thumbStrip: { paddingHorizontal: 12, gap: THUMB_GAP },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.35,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    marginRight: THUMB_GAP,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbNum: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },

  pageListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pageListBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerGrid: { padding: 12 },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pickerCell: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: (W - 48) / 3,
  },
  pickerImg: { width: '100%', height: '100%' },
  pickerNum: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
