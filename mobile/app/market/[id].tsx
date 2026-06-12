// =====================================================
// Ak�ll� Sepet - Market Detay Ekranı
// Şubeler · Kataloglar · Şube Bilgi Kartı · Navigasyon
// =====================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  FlatList, StyleSheet, Linking,
  Modal, Animated, Dimensions, Platform, Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMarket } from '../../src/hooks/useMarkets';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import { MarketBranch, Catalog } from '../../src/types/api';
import { COLORS } from '../../src/utils/constants';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Navigasyon uygulamaları ─────────────────────────
const NAV_APPS = [
  {
    id: 'google',
    label: 'Google Maps',
    icon: 'navigate-circle-outline' as const,
    color: '#1a73e8',
    bg: '#e8f0fe',
    getUrl: (lat: number, lng: number, name: string) =>
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`,
  },
  {
    id: 'yandex',
    label: 'Yandex Maps',
    icon: 'map-outline' as const,
    color: '#f33',
    bg: '#fff0f0',
    getUrl: (lat: number, lng: number) =>
      `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`,
    fallback: (lat: number, lng: number) =>
      `https://yandex.com.tr/maps/?pt=${lng},${lat}&z=15&l=map`,
  },
  {
    id: 'apple',
    label: 'Apple Maps',
    icon: 'compass-outline' as const,
    color: '#0071e3',
    bg: '#e5f2ff',
    getUrl: (lat: number, lng: number, name: string) =>
      `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`,
    iosOnly: true,
  },
];

// ── Şube Bilgi Kartı (Bottom Sheet) ─────────────────
function BranchSheet({
  branch,
  brandColor,
  onClose,
}: {
  branch: MarketBranch;
  brandColor: string;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, []);

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_H,
      duration: 250,
      useNativeDriver: true,
    }).start(onClose);
  };

  const hasCoords = !!(branch.latitude && branch.longitude);

  const openNav = async (app: (typeof NAV_APPS)[number]) => {
    if (!hasCoords) {
      // Koordinat yoksa adresle Google Maps aç
      const query = encodeURIComponent(`${branch.address}, ${branch.district ?? ''} ${branch.city}`);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      dismiss();
      return;
    }
    const lat = branch.latitude!;
    const lng = branch.longitude!;
    const url = app.getUrl(lat, lng, branch.name);

    if (app.iosOnly && Platform.OS !== 'ios') return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        Linking.openURL(url);
      } else if ('fallback' in app && app.fallback) {
        Linking.openURL(app.fallback(lat, lng));
      } else {
        // Uygulama kurulu değil → web
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        Linking.openURL(webUrl);
      }
    } catch {
      Alert.alert('Hata', 'Harita uygulaması açılamadı.');
    }
    dismiss();
  };

  const copyAddress = () => {
    const full = [branch.address, branch.district, branch.city].filter(Boolean).join(', ');
    Clipboard.setString(full);
    Alert.alert('Kopyalandı', 'Adres panoya kopyalandı.');
  };

  const callPhone = () => {
    if (branch.phone) Linking.openURL(`tel:${branch.phone.replace(/\s/g, '')}`);
  };

  const fullAddress = [branch.address, branch.district, branch.city].filter(Boolean).join(', ');

  return (
    <Modal transparent animationType="none" onRequestClose={dismiss}>
      {/* Overlay */}
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={dismiss} />

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Başlık */}
        <View style={s.sheetHeader}>
          <View style={[s.sheetDot, { backgroundColor: brandColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.sheetName}>{branch.name}</Text>
            <Text style={s.sheetCity}>
              {branch.district ? `${branch.district}, ` : ''}{branch.city}
            </Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={dismiss}>
            <Ionicons name="close" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Adres satırı */}
        <View style={s.infoRow}>
          <View style={s.infoIcon}>
            <Ionicons name="location" size={16} color={brandColor} />
          </View>
          <Text style={s.infoTxt} numberOfLines={2}>{fullAddress}</Text>
          <TouchableOpacity style={s.copyBtn} onPress={copyAddress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="copy-outline" size={15} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Çalışma saatleri */}
        {branch.workingHours && (
          <View style={s.infoRow}>
            <View style={s.infoIcon}>
              <Ionicons name="time" size={16} color={brandColor} />
            </View>
            <Text style={s.infoTxt}>{branch.workingHours}</Text>
          </View>
        )}

        {/* Telefon */}
        {branch.phone && (
          <TouchableOpacity style={s.infoRow} onPress={callPhone} activeOpacity={0.75}>
            <View style={s.infoIcon}>
              <Ionicons name="call" size={16} color={brandColor} />
            </View>
            <Text style={[s.infoTxt, { color: COLORS.primary, fontWeight: '600' }]}>{branch.phone}</Text>
            <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
          </TouchableOpacity>
        )}

        {/* Koordinatlar */}
        {hasCoords && (
          <View style={s.coordRow}>
            <Ionicons name="navigate-outline" size={13} color="#94a3b8" />
            <Text style={s.coordTxt}>
              {branch.latitude!.toFixed(5)}, {branch.longitude!.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Bölme çizgisi */}
        <View style={s.divider} />

        {/* Yol tarifi başlığı */}
        <Text style={s.navTitle}>Yol Tarifi Al</Text>

        {/* Navigasyon butonları */}
        <View style={s.navGrid}>
          {NAV_APPS.filter((a) => !a.iosOnly || Platform.OS === 'ios').map((app) => (
            <TouchableOpacity
              key={app.id}
              style={[s.navBtn, { backgroundColor: app.bg }]}
              onPress={() => openNav(app)}
              activeOpacity={0.8}
            >
              <Ionicons name={app.icon} size={22} color={app.color} />
              <Text style={[s.navBtnTxt, { color: app.color }]}>{app.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Varsayılan harita uygulaması */}
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: '#f0fdf4', flex: undefined, width: '100%' }]}
            onPress={() => {
              if (hasCoords) {
                const url = Platform.OS === 'ios'
                  ? `maps://maps.apple.com/?daddr=${branch.latitude},${branch.longitude}`
                  : `geo:${branch.latitude},${branch.longitude}?q=${encodeURIComponent(branch.name)}`;
                Linking.openURL(url).catch(() => {
                  const query = encodeURIComponent(fullAddress);
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                });
              } else {
                const query = encodeURIComponent(fullAddress);
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
              }
              dismiss();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={22} color="#16a34a" />
            <Text style={[s.navBtnTxt, { color: '#16a34a' }]}>Varsayılan Harita</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </Animated.View>
    </Modal>
  );
}

// ── Ana Ekran ────────────────────────────────────────
export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: market, isLoading, isError, refetch } = useMarket(id);
  const [selectedBranch, setSelectedBranch] = useState<MarketBranch | null>(null);

  if (isLoading) return <LoadingScreen message="Market yükleniyor..." />;
  if (isError || !market) return <ErrorView message="Market bulunamadı" onRetry={refetch} />;

  const catalogs = market.catalogs ?? [];
  const branches = market.branches ?? [];
  const brandColor = market.brandColor ?? COLORS.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: market.name, headerBackTitle: 'Marketler' }} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Market Başlığı ── */}
        <View style={[styles.header, { backgroundColor: brandColor }]}>
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
          {market.logoUrl ? (
            <Image source={{ uri: market.logoUrl }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoText}>{market.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.marketName}>{market.name}</Text>
          {market.website && (
            <TouchableOpacity onPress={() => Linking.openURL(market.website!)}>
              <Text style={styles.website}>{market.website}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.headerPills}>
            <View style={styles.pill}>
              <Ionicons name="location" size={12} color={brandColor} />
              <Text style={[styles.pillTxt, { color: brandColor }]}>{branches.length} şube</Text>
            </View>
            {catalogs.length > 0 && (
              <View style={styles.pill}>
                <Ionicons name="book" size={12} color={brandColor} />
                <Text style={[styles.pillTxt, { color: brandColor }]}>{catalogs.length} katalog</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Aktüel Kataloglar ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktüel Kataloglar</Text>
          {catalogs.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="book-outline" size={28} color={COLORS.border} />
              <Text style={styles.emptyTxt}>Aktif katalog bulunmuyor</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              data={catalogs}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 4, gap: 10 }}
              renderItem={({ item }: { item: Catalog }) => (
                <TouchableOpacity style={styles.catalogCard} onPress={() => router.push(`/catalogs/${item.id}`)}>
                  {item.coverImageUrl ? (
                    <Image source={{ uri: item.coverImageUrl }} style={styles.catalogImg} />
                  ) : (
                    <View style={[styles.catalogImg, styles.catalogFallback]}>
                      <Ionicons name="book-outline" size={22} color={COLORS.border} />
                    </View>
                  )}
                  <Text style={styles.catalogTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.catalogDate}>
                    {new Date(item.endDate).toLocaleDateString('tr-TR')} tarihine kadar
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* ── Şubeler ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Şubeler ({branches.length})</Text>
          {branches.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Ionicons name="location-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyTxt}>Henüz şube eklenmemiş</Text>
            </View>
          ) : (
            branches.map((branch: MarketBranch) => (
              <TouchableOpacity
                key={branch.id}
                style={styles.branchCard}
                onPress={() => setSelectedBranch(branch)}
                activeOpacity={0.82}
              >
                {/* Sol renk şeridi */}
                <View style={[styles.branchAccent, { backgroundColor: brandColor }]} />

                <View style={styles.branchBody}>
                  <View style={styles.branchTopRow}>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    {branch.distanceKm !== undefined && (
                      <View style={styles.distanceBadge}>
                        <Ionicons name="walk-outline" size={11} color={COLORS.primary} />
                        <Text style={styles.distanceTxt}>{branch.distanceKm.toFixed(1)} km</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.branchAddrRow}>
                    <Ionicons name="location-outline" size={13} color="#94a3b8" />
                    <Text style={styles.branchAddress} numberOfLines={1}>{branch.address}</Text>
                  </View>

                  <Text style={styles.branchCity}>
                    {branch.district ? `${branch.district}, ` : ''}{branch.city}
                  </Text>

                  <View style={styles.branchFooter}>
                    {branch.workingHours && (
                      <View style={styles.branchMeta}>
                        <Ionicons name="time-outline" size={12} color="#94a3b8" />
                        <Text style={styles.branchMetaTxt}>{branch.workingHours}</Text>
                      </View>
                    )}
                    {branch.phone && (
                      <View style={styles.branchMeta}>
                        <Ionicons name="call-outline" size={12} color="#94a3b8" />
                        <Text style={styles.branchMetaTxt}>{branch.phone}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Yol tarifi ikonu */}
                <View style={[styles.dirIcon, { backgroundColor: brandColor + '15' }]}>
                  <Ionicons name="navigate" size={18} color={brandColor} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Şube Bottom Sheet ── */}
      {selectedBranch && (
        <BranchSheet
          branch={selectedBranch}
          brandColor={brandColor}
          onClose={() => setSelectedBranch(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Stiller ──────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: { padding: 28, alignItems: 'center', gap: 8, overflow: 'hidden' },
  headerDecor1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40,
  },
  headerDecor2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, left: -20,
  },
  logo: { width: 76, height: 76, borderRadius: 18, backgroundColor: COLORS.white },
  logoFallback: {
    width: 76, height: 76, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoText:   { color: COLORS.white, fontSize: 26, fontWeight: '800' },
  marketName: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  website:    { fontSize: 13, color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
  headerPills:{ flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  pillTxt: { fontSize: 12, fontWeight: '700' },

  // Bölümler
  section: { backgroundColor: COLORS.white, marginBottom: 8, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 14 },

  // Katalog
  catalogCard: { width: 130 },
  catalogImg:  { width: '100%', height: 92, borderRadius: 10 },
  catalogFallback: { backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  catalogTitle: { fontSize: 11, color: COLORS.text, marginTop: 6, lineHeight: 15 },
  catalogDate:  { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  // Şube Kartı
  branchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#f1f5f9',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  branchAccent: { width: 4, alignSelf: 'stretch' },
  branchBody:   { flex: 1, padding: 12, gap: 3 },
  branchTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  branchName:   { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  distanceBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primaryLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  distanceTxt:  { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  branchAddrRow:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchAddress:{ fontSize: 12, color: '#64748b', flex: 1 },
  branchCity:   { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  branchFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  branchMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  branchMetaTxt:{ fontSize: 11, color: '#94a3b8' },
  dirIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },

  // Boş durum
  emptyRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  emptyCenter: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTxt:    { fontSize: 13, color: COLORS.textMuted },
});

// ── Bottom Sheet Stilleri ─────────────────────────────
const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },

  // Header
  sheetHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sheetDot:   { width: 12, height: 12, borderRadius: 6 },
  sheetName:  { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sheetCity:  { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },

  // Bilgi satırları
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  infoIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center',
  },
  infoTxt: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  copyBtn: { padding: 4 },

  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  coordTxt: { fontSize: 11, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },

  navTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
  navGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  navBtn: {
    flex: 1, minWidth: '45%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  navBtnTxt: { fontSize: 13, fontWeight: '700' },
});
