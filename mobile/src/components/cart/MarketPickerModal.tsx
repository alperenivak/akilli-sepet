// =====================================================
// Market Secim Modali — market sec + miktar + onay
// =====================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProduct } from '../../hooks/useProducts';
import { Price } from '../../types/api';
import { PriceTag } from '../PriceTag';
import { COLORS, formatPrice } from '../../utils/constants';

interface Props {
  visible: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
  onConfirm: (marketId: string, quantity: number) => void;
  loading?: boolean;
}

const WEIGHT_UNITS = new Set(['kg', 'g', 'litre', 'lt', 'l', 'ml']);

function isWeightUnit(unit?: string | null) {
  return unit ? WEIGHT_UNITS.has(unit.toLowerCase()) : false;
}

export function MarketPickerModal({
  visible,
  productId,
  productName,
  onClose,
  onConfirm,
  loading = false,
}: Props) {
  const { data: product, isLoading, isError } = useProduct(visible ? productId : '');
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const prices = useMemo(
    () =>
      (product?.prices ?? [])
        .filter((p) => p.isAvailable && p.market)
        .sort((a, b) => a.amount - b.amount),
    [product?.prices],
  );

  const selectedPrice = prices.find((p) => p.marketId === selectedMarketId) ?? null;
  const unit = product?.unit;
  const unitValue = product?.unitValue;
  const useWeightLabel = isWeightUnit(unit);

  useEffect(() => {
    if (visible) {
      setSelectedMarketId(null);
      setQuantity(1);
    }
  }, [visible, productId]);

  const quantityLabel = useWeightLabel ? 'Miktar' : 'Adet';
  const unitHint = useWeightLabel && unit
    ? unitValue
      ? `Her biri ${unitValue} ${unit}`
      : `Birim: ${unit}`
    : undefined;

  const totalHint = useMemo(() => {
    if (!selectedPrice) return null;
    const lineTotal = selectedPrice.amount * quantity;
    if (useWeightLabel && unit) {
      const totalAmount = unitValue ? quantity * unitValue : quantity;
      return `${quantity} × ${unitValue ?? 1} ${unit} · ${formatPrice(lineTotal)}`;
    }
    return `${quantity} adet · ${formatPrice(lineTotal)}`;
  }, [selectedPrice, quantity, useWeightLabel, unit, unitValue]);

  const handleConfirm = () => {
    if (!selectedMarketId || loading) return;
    onConfirm(selectedMarketId, quantity);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Market Seçin</Text>
          <Text style={styles.subtitle} numberOfLines={2}>{productName}</Text>
          <Text style={styles.hint}>
            Marketi seçin, miktarı belirleyin ve sepete ekleyin
          </Text>

          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} style={styles.loader} />
          ) : isError || prices.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>
                Bu ürün için aktif market fiyatı bulunamadı
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={prices}
                keyExtractor={(item) => item.id}
                style={styles.list}
                renderItem={({ item, index }) => (
                  <MarketPriceRow
                    price={item}
                    isCheapest={index === 0}
                    isSelected={item.marketId === selectedMarketId}
                    onPress={() => setSelectedMarketId(item.marketId)}
                  />
                )}
              />

              {selectedPrice && (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmMarket}>
                    {selectedPrice.market?.name}
                  </Text>

                  <View style={styles.qtyRow}>
                    <Text style={styles.qtyLabel}>{quantityLabel}</Text>
                    {unitHint && <Text style={styles.qtyHint}>{unitHint}</Text>}
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        accessibilityLabel="Azalt"
                      >
                        <Ionicons name="remove" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQuantity((q) => Math.min(99, q + 1))}
                        disabled={quantity >= 99}
                        accessibilityLabel="Artır"
                      >
                        <Ionicons name="add" size={18} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {totalHint && (
                    <Text style={styles.totalHint}>{totalHint}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
                    onPress={handleConfirm}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="cart" size={18} color={COLORS.white} />
                        <Text style={styles.confirmBtnText}>Sepete Ekle</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Vazgeç</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MarketPriceRow({
  price,
  isCheapest,
  isSelected,
  onPress,
}: {
  price: Price;
  isCheapest: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const color = price.market?.brandColor ?? COLORS.primary;

  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.secondary} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <View style={styles.rowInfo}>
          <Text style={[styles.marketName, isSelected && styles.marketNameSelected]}>
            {price.market?.name}
          </Text>
          {isCheapest && (
            <View style={styles.cheapestBadge}>
              <Text style={styles.cheapestText}>En Ucuz</Text>
            </View>
          )}
        </View>
      </View>
      <PriceTag amount={price.amount} size="md" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, marginBottom: 12 },
  loader: { marginVertical: 32 },
  list: { maxHeight: 260 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  rowSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: '#F0FDF4',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1, gap: 4 },
  marketName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  marketNameSelected: { color: '#166534' },
  cheapestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cheapestText: { fontSize: 10, color: '#b45309', fontWeight: '700' },
  confirmBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmMarket: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 12,
  },
  qtyRow: { marginBottom: 8 },
  qtyLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  qtyHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: { padding: 6 },
  qtyValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    minWidth: 32,
    textAlign: 'center',
  },
  totalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textMuted },
});
