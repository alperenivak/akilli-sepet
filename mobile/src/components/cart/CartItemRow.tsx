// =====================================================
// Akıllı Sepet - Sepet Urun Satiri Bileseni
// Market bilgisi + fiyat gosterimi
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CartItem } from '../../types/api';
import { COLORS, formatPrice } from '../../utils/constants';
import { PriceTag } from '../PriceTag';

interface Props {
  item: CartItem;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
}

export function CartItemRow({ item, onUpdateQuantity }: Props) {
  const lineTotal = (item.unitPrice ?? 0) * item.quantity;
  const marketColor = item.market.brandColor ?? COLORS.primary;

  const handleDecrease = () => {
    if (item.quantity === 1) {
      Alert.alert('Ürünü Kaldır', 'Bu ürünü sepetten çıkarmak istiyor musunuz?', [
        { text: 'Hayır' },
        { text: 'Evet', onPress: () => onUpdateQuantity(item.id, 0) },
      ]);
    } else {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.imageBox}>
        {item.product.imageUrl ? (
          <Image source={{ uri: item.product.imageUrl }} style={styles.image} />
        ) : (
          <Ionicons name="cube-outline" size={28} color={COLORS.border} />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.marketBadge}>
          <View style={[styles.marketDot, { backgroundColor: marketColor }]} />
          <Text style={styles.marketName}>{item.market.name}</Text>
        </View>
        {item.product.brand && (
          <Text style={styles.brand}>{item.product.brand}</Text>
        )}
        <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
        {item.product.unit && (
          <Text style={styles.unit}>{item.product.unitValue} {item.product.unit}</Text>
        )}
        {item.unitPrice != null && (
          <View style={styles.priceRow}>
            <PriceTag amount={item.unitPrice} size="sm" />
            <Text style={styles.lineTotal}>× {item.quantity} = {formatPrice(lineTotal)}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={handleDecrease}
          accessibilityLabel={item.quantity === 1 ? 'Ürünü kaldır' : 'Adet azalt'}
        >
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={16}
            color={item.quantity === 1 ? COLORS.danger : COLORS.primary}
          />
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          accessibilityLabel="Adet artır"
        >
          <Ionicons name="add" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  imageBox: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  info: { flex: 1 },
  marketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  marketName: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  brand: { fontSize: 11, color: COLORS.textMuted },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.text, lineHeight: 18 },
  unit: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  lineTotal: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  controls: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.background, borderRadius: 8, padding: 4,
    marginTop: 4,
  },
  qtyButton: { padding: 6 },
  qty: { fontSize: 14, fontWeight: '700', color: COLORS.text, minWidth: 20, textAlign: 'center' },
});
