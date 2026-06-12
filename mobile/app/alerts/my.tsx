// =====================================================
// Takip Edilen Ürünler — Fiyat Uyarılarım
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PriceAlertCard } from '../../src/components/price-alerts/PriceAlertCard';
import {
  usePriceAlerts,
  usePriceAlertMutations,
  PriceAlertStatus,
} from '../../src/hooks/usePriceAlerts';
import { COLORS } from '../../src/utils/constants';
import { PriceAlert } from '../../src/api/prices';

const FILTERS: { key: PriceAlertStatus; label: string }[] = [
  { key: 'active', label: 'Takipte' },
  { key: 'triggered', label: 'Tetiklendi' },
  { key: 'all', label: 'Tümü' },
];

export default function MyPriceAlertsScreen() {
  const [filter, setFilter] = useState<PriceAlertStatus>('active');
  const { data: alerts = [], isLoading, isError, refetch, isFetching } = usePriceAlerts(filter);
  const { remove } = usePriceAlertMutations();

  const handleDelete = (id: string) => {
    Alert.alert('Takibi Bırak', 'Bu ürün için fiyat uyarısını kaldırmak istiyor musunuz?', [
      { text: 'Vazgeç' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () => remove.mutate(id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Takip Edilen Ürünler', headerBackTitle: 'Profil' }} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTxt, filter === f.key && styles.filterTxtActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={COLORS.border} />
          <Text style={styles.errTitle}>Liste yüklenemedi</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>
            {filter === 'active' ? 'Takip edilen ürün yok' : 'Kayıt bulunamadı'}
          </Text>
          <Text style={styles.emptySub}>
            Ürün detayında hedef fiyat belirleyerek fiyat düşüşlerinden haberdar olun.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item: PriceAlert) => item.id}
          renderItem={({ item }) => (
            <PriceAlertCard alert={item} onDelete={handleDelete} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: { backgroundColor: COLORS.primaryLight },
  filterTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filterTxtActive: { color: COLORS.primary },
  list: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  errTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  retryBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryTxt: { color: COLORS.white, fontWeight: '700' },
});
