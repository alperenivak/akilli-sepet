// =====================================================
// Katkılarım — barkod ve market listeleme geçmişi
// =====================================================

import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyContributions, ContributionItem } from '../../src/api/contributions';
import { COLORS } from '../../src/utils/constants';
import { useAuthStore } from '../../src/store/authStore';

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'İnceleniyor', color: '#b45309', bg: '#fef3c7' },
  APPROVED: { label: 'Onaylandı', color: '#047857', bg: '#d1fae5' },
  REJECTED: { label: 'Reddedildi', color: '#b91c1c', bg: '#fee2e2' },
};

function ContributionRow({ item }: { item: ContributionItem }) {
  const st = STATUS[item.status] ?? STATUS.PENDING;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/product/${item.product.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.rowTop}>
        <View style={[styles.typeBadge, item.type === 'BARCODE' ? styles.typeBarcode : styles.typeMarket]}>
          <Text style={styles.typeBadgeText}>
            {item.type === 'BARCODE' ? 'Barkod' : 'Markete Ekleme'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={styles.productName} numberOfLines={2}>{item.product.name}</Text>
      {item.type === 'BARCODE' && item.barcode ? (
        <Text style={styles.detail}>Barkod: {item.barcode}</Text>
      ) : null}
      {item.type === 'MARKET_LISTING' && item.market ? (
        <Text style={styles.detail}>
          {item.market.name}
          {item.amount ? ` — ₺${(item.amount / 100).toFixed(2)}` : ''}
        </Text>
      ) : null}
      <Text style={styles.date}>
        {new Date(item.createdAt).toLocaleString('tr-TR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })}
      </Text>
    </TouchableOpacity>
  );
}

export default function MyContributionsScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => getMyContributions(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Katkılarım', headerBackTitle: 'Geri' }} />
        <View style={styles.center}>
          <Ionicons name="log-in-outline" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Giriş gerekli</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const items = data?.items ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Katkılarım', headerBackTitle: 'Geri' }} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <ContributionRow item={item} />}
          contentContainerStyle={items.length === 0 ? styles.center : styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="ribbon-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>Henüz katkın yok</Text>
              <Text style={styles.emptyHint}>
                Barkod ekle veya ürünü markete ekleyerek itibar kazanmaya başla.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 10 },
  row: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBarcode: { backgroundColor: '#dbeafe' },
  typeMarket: { backgroundColor: '#d1fae5' },
  typeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  detail: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, fontFamily: 'monospace' },
  date: { fontSize: 11, color: COLORS.textMuted, marginTop: 8 },
  emptyWrap: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  loginBtn: {
    marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  loginBtnText: { color: '#fff', fontWeight: '700' },
});
