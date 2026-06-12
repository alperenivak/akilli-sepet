// =====================================================
// Akıllı Sepet - Ürün Kartı — Premium Tasarım + Marka
// =====================================================
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Product } from '../types/api';
import { PriceTag } from './PriceTag';
import { COLORS } from '../utils/constants';

interface Props {
  product: Product;
  onAddToCart?: (product: Product) => void;
  horizontal?: boolean;
}

function brandInitial(brand?: string | null): string {
  if (!brand?.trim()) return '?';
  return brand.trim().charAt(0).toUpperCase();
}

function formatUnit(unit?: string | null, unitValue?: number | null): string | null {
  if (!unit) return null;
  if (unitValue == null) return unit;
  const v = Number.isInteger(unitValue) ? unitValue : unitValue;
  return `${v} ${unit}`;
}

function ProductImage({
  product,
  style,
  compact,
}: {
  product: Product;
  style: object;
  compact?: boolean;
}) {
  const unitLabel = formatUnit(product.unit, product.unitValue);

  return (
    <View style={[style, styles.imgWrap]}>
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.imgFill} resizeMode="contain" />
      ) : (
        <View style={[styles.imgFill, styles.imgPlaceholder]}>
          <Text style={[styles.brandInitial, compact && styles.brandInitialSm]}>
            {brandInitial(product.brand)}
          </Text>
          <Ionicons name="cube-outline" size={compact ? 20 : 28} color="#cbd5e1" />
        </View>
      )}
      {product.brand ? (
        <View style={[styles.brandPill, compact && styles.brandPillSm]}>
          <Text style={[styles.brandPillTxt, compact && styles.brandPillTxtSm]} numberOfLines={1}>
            {product.brand}
          </Text>
        </View>
      ) : null}
      {unitLabel ? (
        <View style={[styles.unitPill, compact && styles.unitPillSm]}>
          <Text style={[styles.unitPillTxt, compact && styles.unitPillTxtSm]}>{unitLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const ProductCard: React.FC<Props> = ({ product, onAddToCart, horizontal = false }) => {
  const handlePress = () => router.push(`/product/${product.id}`);

  if (horizontal) {
    return (
      <TouchableOpacity style={styles.hCard} onPress={handlePress} activeOpacity={0.8}>
        <ProductImage product={product} style={styles.hImg} compact />
        <View style={styles.hInfo}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          {product.lowestPrice != null && (
            <View style={styles.priceRow}>
              <PriceTag amount={product.lowestPrice} size="sm" />
              {product.lowestPriceMarket && (
                <Text style={styles.mktName}>{product.lowestPriceMarket.name}</Text>
              )}
            </View>
          )}
        </View>
        {onAddToCart && (
          <TouchableOpacity style={styles.hAddBtn} onPress={(e) => { e.stopPropagation(); onAddToCart(product); }}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.82}>
      <ProductImage product={product} style={styles.img} />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

        {product.lowestPrice != null ? (
          <View style={styles.priceRow}>
            <PriceTag amount={product.lowestPrice} size="sm" />
            {product.lowestPriceMarket && (
              <View style={styles.mktBadge}>
                <Text style={styles.mktBadgeTxt} numberOfLines={1}>{product.lowestPriceMarket.name}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.noPrice}>Fiyat güncellenmedi</Text>
        )}
      </View>

      {onAddToCart && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={(e) => { e.stopPropagation(); onAddToCart(product); }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={COLORS.primary} />
          <Text style={styles.addTxt}>Market Seç & Ekle</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
    margin: 6,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  img: { width: '100%', height: 130 },
  imgWrap: { position: 'relative', backgroundColor: '#f8fafc', overflow: 'hidden' },
  imgFill: { width: '100%', height: '100%' },
  imgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  brandInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    opacity: 0.85,
  },
  brandInitialSm: { fontSize: 16 },
  brandPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '72%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brandPillSm: { top: 4, left: 4, paddingHorizontal: 6 },
  brandPillTxt: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  brandPillTxtSm: { fontSize: 9 },
  unitPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unitPillSm: { bottom: 4, right: 4 },
  unitPillTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },
  unitPillTxtSm: { fontSize: 8 },
  info:    { padding: 10, paddingBottom: 6 },
  name:    { fontSize: 13, fontWeight: '600', color: '#1e293b', lineHeight: 18 },
  priceRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  mktBadge:{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  mktBadgeTxt:{ fontSize: 9, color: '#64748b', fontWeight: '600' },
  noPrice: { fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
  },
  addTxt: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  hCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    alignItems: 'center',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  hImg:  { width: 88, height: 88 },
  hInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  mktName:{ fontSize: 10, color: COLORS.textMuted },
  hAddBtn:{
    backgroundColor: COLORS.primary, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
});
