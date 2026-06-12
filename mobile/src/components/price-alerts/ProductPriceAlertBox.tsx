// =====================================================
// Ürün Detay — Fiyat Uyarısı Bölümü
// Market seçimi · mevcut uyarı · güncelleme / silme
// =====================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Price } from '../../types/api';
import { PriceTag } from '../PriceTag';
import { COLORS, formatPrice } from '../../utils/constants';
import { showAppSuccess, showAppError } from '../../store/messageStore';
import {
  useProductPriceAlert,
  usePriceAlertMutations,
  getAlertStatusLabel,
  getAlertStatusColor,
} from '../../hooks/usePriceAlerts';

interface Props {
  productId: string;
  prices: Price[];
  isAuthenticated: boolean;
}

export function ProductPriceAlertBox({ productId, prices, isAuthenticated }: Props) {
  const { data: existingAlert, isLoading } = useProductPriceAlert(productId, isAuthenticated);
  const { create, update, remove } = usePriceAlertMutations();

  const [expanded, setExpanded] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [marketScope, setMarketScope] = useState<string | null>(null);

  const lowestPrice = prices[0];

  useEffect(() => {
    if (existingAlert) {
      setTargetPrice((existingAlert.targetAmount / 100).toFixed(2).replace('.', ','));
      setMarketScope(existingAlert.marketId ?? null);
      setExpanded(true);
    }
  }, [existingAlert?.id, existingAlert?.targetAmount, existingAlert?.marketId]);

  const scopedCurrent = useMemo(() => {
    if (marketScope) {
      return prices.find((p) => p.market?.id === marketScope) ?? null;
    }
    return lowestPrice ?? null;
  }, [marketScope, prices, lowestPrice]);

  const suggestTarget = () => {
    const base = scopedCurrent?.amount ?? lowestPrice?.amount;
    if (!base) return;
    const suggested = Math.max(1, Math.round(base * 0.95));
    setTargetPrice((suggested / 100).toFixed(2).replace('.', ','));
  };

  const handleSave = async () => {
    const parsed = parseFloat(targetPrice.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      showAppError('Geçersiz fiyat', 'Örn: 24,99');
      return;
    }
    const targetAmount = Math.round(parsed * 100);
    const marketId = marketScope;

    try {
      if (existingAlert?.isActive && !existingAlert.triggeredAt) {
        await update.mutateAsync({ id: existingAlert.id, targetAmount, marketId });
        showAppSuccess('Güncellendi', 'Fiyat uyarısı güncellendi');
      } else {
        await create.mutateAsync({ productId, targetAmount, marketId });
        showAppSuccess('Takibe alındı', `${formatPrice(targetAmount)} altına düşünce bildirim alırsınız`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showAppError('Kaydedilemedi', msg ?? 'Tekrar deneyin');
    }
  };

  const handleDelete = async () => {
    if (!existingAlert) return;
    try {
      await remove.mutateAsync(existingAlert.id);
      setTargetPrice('');
      setMarketScope(null);
      showAppSuccess('Takip bırakıldı', 'Fiyat uyarısı kaldırıldı');
    } catch {
      showAppError('Hata', 'Uyarı silinemedi');
    }
  };

  if (!isAuthenticated) return null;
  if (prices.length === 0) return null;

  const saving = create.isPending || update.isPending;
  const statusColor = existingAlert ? getAlertStatusColor(existingAlert) : COLORS.primary;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>
            {existingAlert?.isActive ? 'Fiyat takibi aktif' : 'Fiyat uyarısı kur'}
          </Text>
          {existingAlert && (
            <Text style={styles.toggleSub}>
              Hedef {formatPrice(existingAlert.targetAmount)}
              {' · '}
              {existingAlert.market?.name ?? 'Tüm marketler'}
            </Text>
          )}
        </View>
        {existingAlert && (
          <View style={[styles.badge, { backgroundColor: statusColor + '18' }]}>
            <Text style={[styles.badgeTxt, { color: statusColor }]}>
              {getAlertStatusLabel(existingAlert)}
            </Text>
          </View>
        )}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.box}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 8 }} />
          ) : (
            <>
              <Text style={styles.label}>Hangi markette takip edilsin?</Text>
              <View style={styles.chips}>
                <TouchableOpacity
                  style={[styles.chip, marketScope === null && styles.chipActive]}
                  onPress={() => setMarketScope(null)}
                >
                  <Text style={[styles.chipTxt, marketScope === null && styles.chipTxtActive]}>
                    Tüm marketler
                  </Text>
                </TouchableOpacity>
                {prices.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.chip, marketScope === p.marketId && styles.chipActive]}
                    onPress={() => setMarketScope(p.marketId)}
                  >
                    <Text
                      style={[styles.chipTxt, marketScope === p.marketId && styles.chipTxtActive]}
                      numberOfLines={1}
                    >
                      {p.market?.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {scopedCurrent && (
                <View style={styles.currentRow}>
                  <Text style={styles.currentLabel}>Güncel fiyat</Text>
                  <PriceTag amount={scopedCurrent.amount} size="md" />
                  <TouchableOpacity onPress={suggestTarget} style={styles.suggestBtn}>
                    <Text style={styles.suggestTxt}>%5 altı öner</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>Hedef fiyat (TL)</Text>
              <Text style={styles.hint}>Bu fiyatın altına düşünce bildirim alırsınız</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="24,99"
                  keyboardType="decimal-pad"
                  value={targetPrice}
                  onChangeText={setTargetPrice}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.disabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.saveTxt}>{existingAlert ? 'Güncelle' : 'Takibe Al'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {existingAlert && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={remove.isPending}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.deleteTxt}>Takibi bırak</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  box: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  hint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8, marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipTxt: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', maxWidth: 100 },
  chipTxtActive: { color: COLORS.primary },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  currentLabel: { fontSize: 12, color: COLORS.textMuted },
  suggestBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  suggestTxt: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: COLORS.white,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  saveTxt: { color: COLORS.white, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  deleteTxt: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
});
