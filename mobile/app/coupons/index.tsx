// =====================================================
// Kuponlarım — İtibar ödülleri tam ekran
// =====================================================

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMyCoupons } from '../../src/hooks/useMyCoupons';
import { CouponCard } from '../../src/components/reputation/CouponCard';
import { CouponClaimModal } from '../../src/components/reputation/CouponClaimModal';

export default function CouponsScreen() {
  const {
    data, isLoading, isError, refetch, isRefetching,
    claimedModal, setClaimedModal, claimingId, handleCouponPress,
  } = useMyCoupons();

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
        <Text style={s.errTxt}>Kuponlar yüklenemedi</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} colors={['#7c3aed']} />
        }
      >
        <View style={s.hero}>
          <Text style={s.heroEmoji}>{data.levelIcon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.heroLevel}>{data.level}</Text>
            <Text style={s.heroScore}>{data.score.toFixed(2)} itibar puanı</Text>
          </View>
          {data.stats.claimable > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{data.stats.claimable} hazır</Text>
            </View>
          )}
        </View>

        <View style={s.pitchCard}>
          <Ionicons name="sparkles" size={18} color="#7c3aed" />
          <Text style={s.pitchText}>{data.pitch}</Text>
        </View>

        <View style={s.noticeCard}>
          <Ionicons name="storefront-outline" size={20} color="#7c3aed" />
          <View style={{ flex: 1 }}>
            <Text style={s.noticeTitle}>Mağazada Kullanım</Text>
            <Text style={s.noticeBody}>{data.storeUsageNotice}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Tüm Kuponlar</Text>
        <View style={s.list}>
          {data.rewards.map((r) => (
            <CouponCard
              key={r.id}
              item={r}
              onPress={handleCouponPress}
              claiming={claimingId}
            />
          ))}
        </View>
      </ScrollView>

      <CouponClaimModal
        visible={!!claimedModal}
        code={claimedModal?.code ?? ''}
        title={claimedModal?.title ?? ''}
        instructions={claimedModal?.instructions}
        storeUsageNotice={claimedModal?.storeUsageNotice ?? data.storeUsageNotice}
        onClose={() => setClaimedModal(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errTxt: { color: '#64748b', fontSize: 14 },
  content: { padding: 16, paddingBottom: 32 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12,
  },
  heroEmoji: { fontSize: 32 },
  heroLevel: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  heroScore: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { backgroundColor: '#15803d', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pitchCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#faf5ff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ede9fe', marginBottom: 12,
  },
  pitchText: { flex: 1, fontSize: 12, color: '#5b21b6', lineHeight: 17 },
  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#c4b5fd', marginBottom: 16,
  },
  noticeTitle: { fontSize: 13, fontWeight: '800', color: '#5b21b6' },
  noticeBody: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  list: { gap: 10 },
});
