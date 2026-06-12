import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getMyRewards } from '../../api/rewards';

export function CouponsSummaryCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={s.wrap}>
        <ActivityIndicator color="#7c3aed" style={{ marginVertical: 16 }} />
      </View>
    );
  }

  if (isError || !data) return null;

  return (
    <TouchableOpacity style={s.card} onPress={() => router.push('/coupons')} activeOpacity={0.85}>
      <View style={s.left}>
        <View style={s.iconWrap}>
          <Ionicons name="gift" size={22} color="#7c3aed" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Kuponlarım</Text>
          <Text style={s.sub} numberOfLines={2}>{data.pitch}</Text>
        </View>
      </View>
      <View style={s.right}>
        {data.stats.claimable > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{data.stats.claimable}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 16 },
  card: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#faf5ff', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  badge: {
    backgroundColor: '#15803d', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
