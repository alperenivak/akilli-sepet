// =====================================================
// Akıllı Sepet - Ana Sayfa
// Premium kullanıcı odaklı tasarım
// =====================================================

import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, StyleSheet, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCategories, useProducts } from '../../src/hooks/useProducts';
import { useMarkets, useActiveCatalogs } from '../../src/hooks/useMarkets';
import { ProductCard } from '../../src/components/ProductCard';
import { ActivityIndicator } from 'react-native';
import { StateView, ConnectionErrorView } from '../../src/components/ui/StateViews';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { HomeSearchBar } from '../../src/components/home/HomeSearchBar';
import { HeroBanner } from '../../src/components/home/HeroBanner';
import { CategoryCarousel } from '../../src/components/home/CategoryCarousel';
import { CatalogCarousel } from '../../src/components/home/CatalogCarousel';
import { MarketChipList } from '../../src/components/home/MarketChipList';
import { QuickActions } from '../../src/components/home/QuickActions';
import { ForYouSection } from '../../src/components/home/ForYouSection';
import { Product } from '../../src/types/api';
import { COLORS } from '../../src/utils/constants';
import { useAddToCartWithMarket } from '../../src/hooks/useAddToCartWithMarket';
import { MarketPickerModal } from '../../src/components/cart/MarketPickerModal';

export default function HomeScreen() {
  const { data: categoriesData, isLoading: catsLoading }   = useCategories();
  const {
    data: productsData,
    isLoading: prodsLoading,
    isError: prodsError,
    refetch: refetchProds,
  } = useProducts({ limit: 12 });
  const { data: markets, isLoading: marketsLoading, refetch: refetchMarkets }   = useMarkets();
  const { data: catalogs, refetch: refetchCatalogs }        = useActiveCatalogs();
  const { picker, adding, openPicker, closePicker, confirmAdd } = useAddToCartWithMarket();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchProds(), refetchMarkets(), refetchCatalogs()]);
    setRefreshing(false);
  }, [refetchProds, refetchMarkets, refetchCatalogs]);

  const handleAddToCart = useCallback((product: Product) => openPicker(product), [openPicker]);

  const categories = categoriesData ?? [];
  const products   = productsData?.items ?? [];
  const marketList = markets ?? [];
  const catalogList = catalogs ?? [];
  const initialLoading = (catsLoading || prodsLoading || marketsLoading) && !refreshing;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Sabit üst kısım */}
      <HomeHeader />
      <HomeSearchBar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* ── Promosyon / Reklam Bannerlari ── */}
        <HeroBanner />

        {/* ── Kategoriler ── */}
        {catsLoading && !categories.length ? (
          <View style={styles.inlineLoader}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <CategoryCarousel categories={categories} />
        )}

        {/* ── Aktüel Kataloglar ── */}
        <CatalogCarousel catalogs={catalogList} />

        {/* ── Marketler ── */}
        {marketsLoading && !marketList.length ? (
          <View style={styles.inlineLoader}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <MarketChipList markets={marketList} />
        )}

        {/* ── Senin için (baktığın ürünler) ── */}
        <ForYouSection onAddToCart={handleAddToCart} />

        {/* ── Öne Çıkan Ürünler ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Öne Çıkan Ürünler</Text>
              <Text style={styles.sectionSub}>Çok aranan ve güncellenen ürünler</Text>
            </View>
            {products.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/search')} style={styles.seeAllBtn}>
                <Text style={styles.seeAll}>Tümü</Text>
              </TouchableOpacity>
            )}
          </View>

          {prodsLoading && !products.length ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingHint}>Ürünler yükleniyor…</Text>
            </View>
          ) : prodsError ? (
            <ConnectionErrorView onRetry={() => refetchProds()} />
          ) : products.length > 0 ? (
            <View style={styles.productGrid}>
              {products.map((item) => (
                <View key={item.id} style={styles.productCell}>
                  <ProductCard product={item} onAddToCart={handleAddToCart} />
                </View>
              ))}
            </View>
          ) : initialLoading ? null : (
            <StateView
              kind="empty"
              title="Henüz ürün bulunmuyor"
              subtitle="Backend bağlantısını kontrol edin veya seed verisini yükleyin."
              compact
            />
          )}
        </View>

        {/* ── Hızlı Erişim ── */}
        <QuickActions />

        {/* ── Alt Bilgi Şeridi ── */}
        <View style={styles.strip}>
          {[
            { icon: '🏪', text: 'Yüzlerce market' },
            { icon: '🔄', text: 'Anlık fiyat takibi' },
            { icon: '🛡️', text: 'SKT uyarıları' },
          ].map((item, i, arr) => (
            <React.Fragment key={item.icon}>
              <View style={styles.stripItem}>
                <Text style={styles.stripIcon}>{item.icon}</Text>
                <Text style={styles.stripText}>{item.text}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.stripDiv} />}
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <MarketPickerModal
        visible={!!picker}
        productId={picker?.productId ?? ''}
        productName={picker?.productName ?? ''}
        onClose={closePicker}
        onConfirm={confirmAdd}
        loading={adding}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, marginBottom: 10, marginTop: 20,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectionSub:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  seeAllBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.primaryLight, borderRadius: 20, marginTop: 2 },
  seeAll:    { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  productCell: {
    width: '50%',
  },
  strip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
    backgroundColor: COLORS.background, borderRadius: 14,
  },
  stripItem: { flex: 1, alignItems: 'center', gap: 4 },
  stripIcon: { fontSize: 18 },
  stripText: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500', textAlign: 'center' },
  stripDiv:  { width: 1, height: 28, backgroundColor: COLORS.border },
  inlineLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 8 },
  loadingHint: { fontSize: 13, color: COLORS.textMuted },
});
