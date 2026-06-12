// =====================================================
// Fiyat Uyarısı Kartı
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PriceAlert } from '../../api/prices';
import { PriceTag } from '../PriceTag';
import { COLORS, formatPrice } from '../../utils/constants';
import { getAlertStatusColor, getAlertStatusLabel } from '../../hooks/usePriceAlerts';

interface Props {
  alert: PriceAlert;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function PriceAlertCard({ alert, onDelete, compact = false }: Props) {
  const statusColor = getAlertStatusColor(alert);
  const statusLabel = getAlertStatusLabel(alert);
  const marketLabel = alert.market?.name ?? 'Tüm marketler';

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() => router.push(`/product/${alert.productId}`)}
      activeOpacity={0.85}
    >
      <View style={styles.imageBox}>
        {alert.product?.imageUrl ? (
          <Image source={{ uri: alert.product.imageUrl }} style={styles.image} />
        ) : (
          <Ionicons name="cube-outline" size={24} color={COLORS.border} />
        )}
      </View>

      <View style={styles.info}>
        {alert.product?.brand && (
          <Text style={styles.brand} numberOfLines={1}>{alert.product.brand}</Text>
        )}
        <Text style={styles.name} numberOfLines={2}>{alert.product?.name}</Text>
        <Text style={styles.market}>{marketLabel}</Text>

        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Hedef</Text>
            <PriceTag amount={alert.targetAmount} size="sm" />
          </View>
          {alert.currentAmount != null && (
            <View>
              <Text style={styles.priceLabel}>Güncel</Text>
              <PriceTag amount={alert.currentAmount} size="sm" />
            </View>
          )}
        </View>

        {alert.gapAmount != null && alert.gapAmount > 0 && alert.isActive && (
          <Text style={styles.gap}>
            Hedefe {formatPrice(alert.gapAmount)} kaldı
          </Text>
        )}
        {alert.isTargetReached && alert.isActive && !alert.triggeredAt && (
          <Text style={styles.reached}>Hedef fiyata ulaşıldı — bildirim bekleniyor</Text>
        )}
      </View>

      <View style={styles.right}>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(alert.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Takibi bırak"
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardCompact: { marginBottom: 8 },
  imageBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  info: { flex: 1 },
  brand: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.text, lineHeight: 18 },
  market: { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  priceRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  priceLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  gap: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  reached: { fontSize: 11, color: '#d97706', fontWeight: '600', marginTop: 6 },
  right: { alignItems: 'flex-end', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTxt: { fontSize: 10, fontWeight: '700' },
  deleteBtn: { padding: 4, marginTop: 8 },
});
