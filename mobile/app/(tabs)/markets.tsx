import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, SectionList, TouchableOpacity,
  Image, StyleSheet, RefreshControl, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMarkets, useActiveCatalogs } from '../../src/hooks/useMarkets';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import { Market, Catalog } from '../../src/types/api';
import { COLORS } from '../../src/utils/constants';

type Tab = 'markets' | 'catalogs';
const CARD_W = Math.min(160, Dimensions.get('window').width * 0.42);

function formatCatalogRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function isCatalogCurrent(catalog: Catalog) {
  const now = Date.now();
  return new Date(catalog.startDate).getTime() <= now && new Date(catalog.endDate).getTime() >= now;
}

function CatalogCard({ item, width = CARD_W }: { item: Catalog; width?: number }) {
  const brandColor = item.market?.brandColor ?? COLORS.primary;
  const pageCount = item.pageCount ?? item._count?.pages ?? 0;
  const current = isCatalogCurrent(item);

  return (
    <TouchableOpacity
      style={[styles.catalogCard, { width }]}
      onPress={() => router.push(`/catalogs/${item.id}`)}
      activeOpacity={0.92}
    >
      <View style={styles.catalogImageWrap}>
        {item.coverImageUrl ? (
          <Image source={{ uri: item.coverImageUrl }} style={styles.catalogImage} />
        ) : (
          <View style={[styles.catalogImage, styles.catalogImageFallback]}>
            <Ionicons name="newspaper-outline" size={32} color={COLORS.border} />
          </View>
        )}
        <View style={[styles.catalogAccent, { backgroundColor: brandColor }]} />
        {current && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Güncel</Text>
          </View>
        )}
        {pageCount > 0 && (
          <View style={styles.pageCountBadge}>
            <Ionicons name="layers-outline" size={9} color="#fff" />
            <Text style={styles.pageCountText}>{pageCount}</Text>
          </View>
        )}
        {!!item.pdfUrl && (
          <View style={styles.pdfBadge}>
            <Text style={styles.pdfBadgeText}>PDF</Text>
          </View>
        )}
      </View>
      <View style={styles.catalogInfo}>
        <Text style={styles.catalogTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.catalogDate}>{formatCatalogRange(item.startDate, item.endDate)}</Text>
        <View style={[styles.catalogCta, { backgroundColor: `${brandColor}18` }]}>
          <Text style={[styles.catalogCtaText, { color: brandColor }]}>Görüntüle</Text>
          <Ionicons name="arrow-forward" size={12} color={brandColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CatalogsTab() {
  const { data: catalogs, isLoading, isError, refetch, isRefetching } = useActiveCatalogs();
  const [filterMarketId, setFilterMarketId] = useState<string | null>(null);

  const marketFilters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; brandColor?: string; count: number }>();
    for (const c of catalogs ?? []) {
      if (!c.market) continue;
      const prev = map.get(c.market.id);
      if (prev) prev.count += 1;
      else map.set(c.market.id, {
        id: c.market.id,
        name: c.market.name,
        brandColor: c.market.brandColor,
        count: 1,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [catalogs]);

  const sections = useMemo(() => {
    const filtered = filterMarketId
      ? (catalogs ?? []).filter((c) => c.marketId === filterMarketId)
      : (catalogs ?? []);

    const map = new Map<string, { title: string; market: Catalog['market']; catalogs: Catalog[] }>();
    for (const c of filtered) {
      const mid = c.marketId;
      if (!map.has(mid)) {
        map.set(mid, { title: c.market?.name ?? 'Market', market: c.market, catalogs: [] });
      }
      map.get(mid)!.catalogs.push(c);
    }

    return Array.from(map.values())
      .sort((a, b) => a.title.localeCompare(b.title, 'tr'))
      .map((s) => ({
        title: s.title,
        market: s.market,
        data: [s.catalogs],
      }));
  }, [catalogs, filterMarketId]);

  const featured = useMemo(() => {
    const list = catalogs ?? [];
    return [...list]
      .filter((c) => c.coverImageUrl && (c.pageCount ?? 0) > 0)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 6);
  }, [catalogs]);

  if (isLoading) return <LoadingScreen />;
  if (isError) return <ErrorView onRetry={refetch} />;

  const total = catalogs?.length ?? 0;
  const marketCount = marketFilters.length;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(_, index) => `section-${index}`}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.catalogContainer}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
      }
      ListHeaderComponent={
        <>
          <View style={styles.catalogHero}>
            <View style={styles.catalogHeroIcon}>
              <Ionicons name="newspaper" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.catalogHeroText}>
              <Text style={styles.catalogHeroTitle}>Aktüel Kataloglar</Text>
              <Text style={styles.catalogHeroSub}>
                {total} katalog · {marketCount} market
              </Text>
            </View>
          </View>

          {featured.length > 0 && (
            <View style={styles.featuredBlock}>
              <Text style={styles.sectionLabel}>Öne Çıkanlar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
                {featured.map((item) => (
                  <CatalogCard key={`feat-${item.id}`} item={item} width={148} />
                ))}
              </ScrollView>
            </View>
          )}

          {marketFilters.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[styles.filterChip, !filterMarketId && styles.filterChipActive]}
                onPress={() => setFilterMarketId(null)}
              >
                <Text style={[styles.filterChipText, !filterMarketId && styles.filterChipTextActive]}>
                  Tümü ({total})
                </Text>
              </TouchableOpacity>
              {marketFilters.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.filterChip,
                    filterMarketId === m.id && styles.filterChipActive,
                    filterMarketId === m.id && m.brandColor ? { borderColor: m.brandColor } : null,
                  ]}
                  onPress={() => setFilterMarketId(filterMarketId === m.id ? null : m.id)}
                >
                  <View style={[styles.filterDot, { backgroundColor: m.brandColor ?? COLORS.primary }]} />
                  <Text style={[
                    styles.filterChipText,
                    filterMarketId === m.id && styles.filterChipTextActive,
                    filterMarketId === m.id && m.brandColor ? { color: m.brandColor } : null,
                  ]}>
                    {m.name} ({m.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyText}>Aktif katalog bulunamadı</Text>
          <Text style={styles.emptySub}>
            Marketler yeni kampanya katalogları yüklediğinde burada görünecek
          </Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.marketSectionHeader}>
          <View style={styles.marketSectionLeft}>
            {section.market?.logoUrl ? (
              <Image source={{ uri: section.market.logoUrl }} style={styles.marketSectionLogo} />
            ) : (
              <View style={[
                styles.marketSectionLogoFallback,
                { backgroundColor: section.market?.brandColor ?? COLORS.primary },
              ]}>
                <Text style={styles.marketSectionLogoText}>
                  {section.title.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.marketSectionTitle}>{section.title}</Text>
              <Text style={styles.marketSectionMeta}>{section.data[0].length} katalog</Text>
            </View>
          </View>
          <View style={[
            styles.marketSectionLine,
            { backgroundColor: section.market?.brandColor ?? COLORS.primary },
          ]} />
        </View>
      )}
      renderItem={({ item: marketCatalogs }: { item: Catalog[] }) => (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.marketCatalogRow}
        >
          {marketCatalogs.map((catalog) => (
            <CatalogCard key={catalog.id} item={catalog} />
          ))}
        </ScrollView>
      )}
    />
  );
}

export default function MarketsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('markets');
  const { data: markets, isLoading: ml, isError: me, refetch: rm } = useMarkets();

  const isLoading = activeTab === 'markets' ? ml : false;
  const isError = activeTab === 'markets' ? me : false;
  const refetch = activeTab === 'markets' ? rm : () => {};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'markets' && styles.tabActive]}
          onPress={() => setActiveTab('markets')}
        >
          <Ionicons
            name="storefront-outline"
            size={16}
            color={activeTab === 'markets' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'markets' && styles.tabTextActive]}>
            Marketler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'catalogs' && styles.tabActive]}
          onPress={() => setActiveTab('catalogs')}
        >
          <Ionicons
            name="newspaper-outline"
            size={16}
            color={activeTab === 'catalogs' ? COLORS.primary : COLORS.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'catalogs' && styles.tabTextActive]}>
            Kataloglar
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'markets' && isLoading && <LoadingScreen />}
      {activeTab === 'markets' && isError && <ErrorView onRetry={refetch} />}

      {activeTab === 'markets' && !isLoading && !isError && (
        <FlatList
          data={markets ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Market bulunamadı</Text>
            </View>
          }
          renderItem={({ item }: { item: Market }) => (
            <TouchableOpacity
              style={styles.marketRow}
              onPress={() => router.push(`/market/${item.id}`)}
              activeOpacity={0.8}
            >
              <View style={[styles.marketLogoWrap, { borderColor: item.brandColor ?? COLORS.border }]}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={styles.marketLogo} />
                ) : (
                  <View style={[styles.marketLogoFallback, { backgroundColor: item.brandColor ?? COLORS.primary }]}>
                    <Text style={styles.marketLogoText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.marketInfo}>
                <Text style={styles.marketName}>{item.name}</Text>
                <Text style={styles.marketMeta}>
                  {item._count?.branches ?? 0} şube
                  {item._count?.catalogs ? ` · ${item._count.catalogs} katalog` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}

      {activeTab === 'catalogs' && <CatalogsTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  tabTextActive: { color: COLORS.primary, fontWeight: '700' },

  list: { padding: 12 },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
    gap: 12,
  },
  marketLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  marketLogo: { width: '100%', height: '100%' },
  marketLogoFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketLogoText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  marketInfo: { flex: 1 },
  marketName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  marketMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  catalogContainer: { paddingBottom: 32 },
  catalogHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catalogHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogHeroText: { flex: 1 },
  catalogHeroTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  catalogHeroSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  featuredBlock: { marginTop: 4, marginBottom: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginLeft: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  featuredRow: { paddingHorizontal: 12, gap: 10 },

  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  filterChipTextActive: { color: COLORS.primary },

  marketSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  marketSectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marketSectionLogo: { width: 36, height: 36, borderRadius: 8 },
  marketSectionLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketSectionLogoText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  marketSectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  marketSectionMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  marketSectionLine: { width: 32, height: 3, borderRadius: 2 },
  marketCatalogRow: { paddingHorizontal: 12, gap: 10, paddingBottom: 4 },

  catalogCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  catalogImageWrap: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#f3f4f6',
  },
  catalogImage: { width: '100%', height: '100%' },
  catalogImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  catalogAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  currentBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  currentBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  pageCountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pageCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pdfBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(220,38,38,0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pdfBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  catalogInfo: { padding: 10, gap: 4 },
  catalogTitle: { fontSize: 12, color: COLORS.text, lineHeight: 16, fontWeight: '700', minHeight: 32 },
  catalogDate: { fontSize: 10, color: COLORS.textMuted },
  catalogCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 6,
    borderRadius: 8,
  },
  catalogCtaText: { fontSize: 11, fontWeight: '700' },

  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  emptySub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', opacity: 0.7 },
});
