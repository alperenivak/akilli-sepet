// =====================================================
// Akıllı Sepet - Ürün Detay Ekranı
// Fiyat karşılaştırma, geçmiş grafik, geri bildirim, uyarı
// =====================================================

import React from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useProduct, usePriceHistory } from '../../src/hooks/useProducts';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import { PriceTag } from '../../src/components/PriceTag';
import { PriceHistoryChart } from '../../src/components/PriceHistoryChart';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/utils/constants';
import { showAppSuccess, showAppError } from '../../src/store/messageStore';
import { useAddToCartWithMarket } from '../../src/hooks/useAddToCartWithMarket';
import { MarketPickerModal } from '../../src/components/cart/MarketPickerModal';
import { submitPriceFeedback } from '../../src/api/prices';
import { ProductPriceAlertBox } from '../../src/components/price-alerts/ProductPriceAlertBox';
import {
  computePriceFreshness, freshnessLabel, freshnessColor,
} from '../../src/utils/priceFreshness';
import { useViewHistoryStore } from '../../src/store/viewHistoryStore';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: product, isLoading, isError, refetch } = useProduct(id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { picker, adding, openPicker, closePicker, confirmAdd } = useAddToCartWithMarket();
  const [feedbackMarketId, setFeedbackMarketId] = React.useState<string | null>(null);

  const prices = (product?.prices ?? []).filter((p) => p.isAvailable);
  const lowestPrice = prices[0];
  const historyMarketId = lowestPrice?.market?.id;

  const { data: historyData, isLoading: historyLoading } = usePriceHistory(
    id,
    historyMarketId,
  );
  const trackView = useViewHistoryStore((s) => s.trackView);

  React.useEffect(() => {
    if (product?.id) void trackView(product);
  }, [product?.id, trackView]);

  if (isLoading) return <LoadingScreen message="Ürün yükleniyor..." />;
  if (isError || !product) return <ErrorView message="Ürün bulunamadı" onRetry={refetch} />;

  const handleAddToCart = () => openPicker(product);

  const handleFeedback = async (marketId: string, marketName: string, isCorrect: boolean) => {
    if (!isAuthenticated) {
      showAppError('Giriş gerekli', 'Fiyat doğrulaması için giriş yapın');
      return;
    }
    setFeedbackMarketId(marketId);
    try {
      const result = await submitPriceFeedback({ productId: product.id, marketId, isCorrect });
      const rep = result?.reputation as { points?: number; level?: string } | undefined;
      const repMsg = rep?.points ? ` +${rep.points} itibar` : '';

      queryClient.invalidateQueries({ queryKey: ['product', id] });

      if (isCorrect) {
        showAppSuccess('Doğrulandı!', `Güven skoru yükseldi${repMsg}.`);
      } else {
        showAppSuccess('İşaretlendi', `Yanlış fiyat kaydedildi${repMsg}. Doğru fiyatı bildirerek daha fazla puan kazan!`);
        router.push({
          pathname: '/prices/submit',
          params: { productId: product.id, productName: product.name, marketId, marketName },
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showAppError('Hata', msg ?? 'Geri bildirim gönderilemedi');
    } finally {
      setFeedbackMarketId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: product.name, headerBackTitle: 'Geri' }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cube-outline" size={64} color={COLORS.border} />
          </View>
        )}

        <View style={styles.infoCard}>
          {product.brand && (
            <View style={styles.brandRow}>
              <View style={styles.brandChip}>
                <Text style={styles.brandChipTxt}>{product.brand}</Text>
              </View>
            </View>
          )}
          <Text style={styles.name}>{product.name}</Text>
          {product.unit && (
            <Text style={styles.unit}>{product.unitValue} {product.unit}</Text>
          )}
          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}
          {product.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {product.category.parent
                  ? `${product.category.parent.name} › ${product.category.name}`
                  : product.category.name}
              </Text>
            </View>
          )}

          <View style={styles.bestPriceRow}>
            {lowestPrice ? (
              <View>
                <Text style={styles.bestPriceLabel}>En Düşük Fiyat</Text>
                <PriceTag amount={lowestPrice.amount} size="lg" />
                <Text style={styles.bestPriceMarket}>{lowestPrice.market?.name}</Text>
                {(() => {
                  const level = lowestPrice.freshness ?? computePriceFreshness(
                    lowestPrice.lastUpdated,
                    lowestPrice.needsVerification,
                  );
                  const label = freshnessLabel(level);
                  if (!label) return null;
                  return (
                    <Text style={[styles.freshnessHint, { color: freshnessColor(level) }]}>
                      {label}
                    </Text>
                  );
                })()}
              </View>
            ) : (
              <View style={styles.noPriceInfo}>
                <Ionicons name="pricetag-outline" size={18} color={COLORS.textMuted} />
                <Text style={styles.noPriceText}>Fiyat bilgisi henüz eklenmemiş</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.addButton, (adding || prices.length === 0) && styles.addButtonDisabled]}
              onPress={handleAddToCart}
              disabled={adding || prices.length === 0}
              accessibilityLabel="Market seç ve sepete ekle"
              accessibilityRole="button"
            >
              <Ionicons name="storefront-outline" size={20} color={COLORS.white} />
              <Text style={styles.addButtonText}>
                {adding ? 'Ekleniyor...' : 'Market Seç & Ekle'}
              </Text>
            </TouchableOpacity>
          </View>

          <ProductPriceAlertBox
            productId={product.id}
            prices={prices}
            isAuthenticated={isAuthenticated}
          />
        </View>

        {lowestPrice && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fiyat Geçmişi</Text>
            {historyLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : (
              <PriceHistoryChart
                history={historyData?.history ?? []}
                marketName={lowestPrice.market?.name}
              />
            )}
          </View>
        )}

        {prices.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>
                Fiyat Karşılaştırması ({prices.length} market)
              </Text>
              {isAuthenticated && (
                <TouchableOpacity
                  style={styles.submitPriceBtn}
                  onPress={() => router.push({
                    pathname: '/prices/submit',
                    params: { productId: product.id, productName: product.name },
                  })}
                  accessibilityLabel="Fiyat bildir"
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.submitPriceBtnText}>Fiyat Bildir</Text>
                </TouchableOpacity>
              )}
            </View>
            {isAuthenticated && (
              <Text style={styles.compareHint}>
                Doğru/Yanlış ile fiyat güvenilirliğini artır. Yanlış fiyatları bildirerek sistemi koru.
              </Text>
            )}
            {prices.map((price, index) => {
              const reliabilityColor = (price as unknown as { reliabilityColor?: string }).reliabilityColor ?? 'gray';
              const reliabilityLabel = (price as unknown as { reliabilityLabel?: string }).reliabilityLabel;
              const isSeed = (price as unknown as { isSeedData?: boolean }).isSeedData;
              const badgeStyle = reliabilityColor === 'green'
                ? styles.reliabilityBadgeGreen
                : reliabilityColor === 'yellow'
                  ? styles.reliabilityBadgeYellow
                  : reliabilityColor === 'orange'
                    ? styles.reliabilityBadgeOrange
                    : styles.reliabilityBadgeGray;
              const badgeTextStyle = reliabilityColor === 'green'
                ? styles.reliabilityTextGreen
                : reliabilityColor === 'yellow'
                  ? styles.reliabilityTextYellow
                  : reliabilityColor === 'orange'
                    ? styles.reliabilityTextOrange
                    : styles.reliabilityTextGray;
              const marketId = price.market?.id;
              const marketName = price.market?.name ?? '';
              const isVerifying = marketId != null && feedbackMarketId === marketId;

              return (
                <View
                  key={price.id}
                  style={[styles.priceCard, index === 0 && styles.priceCardBest]}
                >
                  <View style={styles.priceCardTop}>
                    <View style={styles.priceCardLeft}>
                      {index === 0 && (
                        <View style={styles.bestBadge}>
                          <Text style={styles.bestBadgeText}>En Ucuz</Text>
                        </View>
                      )}
                      <View style={styles.marketRow}>
                        <View style={[
                          styles.marketDot,
                          { backgroundColor: price.market?.brandColor ?? COLORS.primary },
                        ]} />
                        <Text style={styles.marketName}>{price.market?.name}</Text>
                      </View>
                      {reliabilityLabel && (
                        <View style={[styles.reliabilityBadge, badgeStyle]}>
                          <Text style={[styles.reliabilityLabel, badgeTextStyle]}>
                            {isSeed && reliabilityColor === 'gray'
                              ? '🔘 ' + reliabilityLabel
                              : reliabilityColor === 'green'
                                ? '✓ ' + reliabilityLabel
                                : reliabilityColor === 'yellow'
                                  ? '✓ ' + reliabilityLabel
                                  : '○ ' + reliabilityLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                    <PriceTag amount={price.amount} size="md" />
                  </View>

                  {marketId && isAuthenticated && (
                    <View style={styles.verifyBar}>
                      <View style={styles.verifyBarLabel}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
                        <Text style={styles.verifyBarText}>Bu fiyat doğru mu?</Text>
                      </View>
                      {isVerifying ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <View style={styles.verifySegment}>
                          <TouchableOpacity
                            style={[styles.verifySegmentBtn, styles.verifySegmentOk]}
                            onPress={() => handleFeedback(marketId, marketName, true)}
                            activeOpacity={0.75}
                            accessibilityLabel={`${marketName} fiyatı doğru`}
                          >
                            <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                            <Text style={styles.verifySegmentOkText}>Doğru</Text>
                          </TouchableOpacity>
                          <View style={styles.verifySegmentDivider} />
                          <TouchableOpacity
                            style={[styles.verifySegmentBtn, styles.verifySegmentNo]}
                            onPress={() => handleFeedback(marketId, marketName, false)}
                            activeOpacity={0.75}
                            accessibilityLabel={`${marketName} fiyatı yanlış`}
                          >
                            <Ionicons name="close-circle" size={18} color="#b91c1c" />
                            <Text style={styles.verifySegmentNoText}>Yanlış</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {product.barcodes && product.barcodes.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Barkodlar</Text>
            {product.barcodes.map((bc) => (
              <View key={bc.id} style={styles.barcodeRow}>
                <Ionicons name="barcode-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.barcodeText}>{bc.code}</Text>
                <Text style={styles.barcodeFormat}>{bc.format}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => router.push({
            pathname: '/reports/create',
            params: { productId: product.id, productName: product.name },
          })}
          accessibilityLabel="Son kullanma tarihi ihbar et"
          accessibilityRole="button"
        >
          <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
          <Text style={styles.reportButtonText}>Son Kullanma Tarihi Geçmiş mi?</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      <MarketPickerModal
        visible={!!picker}
        productId={picker?.productId ?? product.id}
        productName={picker?.productName ?? product.name}
        onClose={closePicker}
        onConfirm={confirmAdd}
        loading={adding}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  image: { width: '100%', height: 220, backgroundColor: COLORS.white },
  imagePlaceholder: {
    height: 180,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: { backgroundColor: COLORS.white, padding: 16, marginBottom: 8 },
  brandRow: { marginBottom: 8 },
  brandChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  brandChipTxt: { fontSize: 12, color: COLORS.primary, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text, lineHeight: 26 },
  unit: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  description: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginTop: 10,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  categoryText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  bestPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bestPriceLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  bestPriceMarket: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  freshnessHint: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  noPriceInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  noPriceText: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { color: COLORS.white, fontWeight: '700' },
  alertToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
  },
  alertToggleText: { flex: 1, fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  alertBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  alertHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  alertRow: { flexDirection: 'row', gap: 8 },
  alertInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: COLORS.white,
  },
  alertBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  alertBtnText: { color: COLORS.white, fontWeight: '700' },
  card: { backgroundColor: COLORS.white, padding: 16, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  compareHint: {
    fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 17,
  },
  priceCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fafafa',
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  priceCardBest: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  priceCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceCardLeft: { flex: 1, marginRight: 12, gap: 6 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  submitPriceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  submitPriceBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  marketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  verifyBarLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  verifyBarText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  verifySegment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  verifySegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  verifySegmentOk: { backgroundColor: '#dcfce7' },
  verifySegmentNo: { backgroundColor: '#fee2e2' },
  verifySegmentDivider: { width: 1, height: 22, backgroundColor: '#cbd5e1' },
  verifySegmentOkText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  verifySegmentNoText: { fontSize: 12, fontWeight: '700', color: '#b91c1c' },
  bestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestBadgeText: { fontSize: 10, color: COLORS.white, fontWeight: '700' },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  marketName: { fontSize: 14, color: COLORS.text },
  // Guvenilirlik badge
  reliabilityBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  reliabilityBadgeGreen: { backgroundColor: '#DCFCE7' },
  reliabilityBadgeYellow: { backgroundColor: '#FEF9C3' },
  reliabilityBadgeOrange: { backgroundColor: '#FFF7ED' },
  reliabilityBadgeGray: { backgroundColor: '#F3F4F6' },
  reliabilityLabel: { fontSize: 10, fontWeight: '600' },
  reliabilityTextGreen: { color: '#166534' },
  reliabilityTextYellow: { color: '#854D0E' },
  reliabilityTextOrange: { color: '#9A3412' },
  reliabilityTextGray: { color: '#6B7280' },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  barcodeText: { flex: 1, fontSize: 13, color: COLORS.text, fontFamily: 'monospace' },
  barcodeFormat: { fontSize: 11, color: COLORS.textMuted },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reportButtonText: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
});
