// =====================================================
// Topluluk Katkısı Bölümü — Profil sekmesi
// İtibar takibi + son aktiviteler (Tasarruf Takibi ile aynı dil)
// =====================================================

import React from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getMyReputation, ReputationProfile } from '../../api/users';
import { COLORS } from '../../utils/constants';

function formatEventDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return 'Az önce';
  if (diffH < 24) return `${diffH} saat önce`;
  if (diffH < 48) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function eventIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type.includes('VERIFY_CORRECT')) return 'checkmark-circle';
  if (type.includes('VERIFY_INCORRECT')) return 'close-circle';
  if (type.includes('SUBMIT_APPROVED') || type.includes('AUTO')) return 'ribbon';
  if (type.includes('SUBMIT_REJECTED')) return 'alert-circle';
  if (type.includes('SUBMIT')) return 'megaphone';
  return 'star';
}

function ReputationWidget({ data }: { data: ReputationProfile }) {
  return (
    <View style={rw.card}>
      <View style={rw.decor1} />
      <View style={rw.decor2} />

      <View style={rw.topRow}>
        <Text style={rw.levelEmoji}>{data.levelIcon}</Text>
        <View style={rw.topText}>
          <Text style={rw.cardTitle}>Topluluk İtibarım</Text>
          <Text style={rw.levelName}>{data.level}</Text>
        </View>
        <View style={rw.trustBadge}>
          <Text style={rw.trustTxt}>Güven x{data.trustWeight}</Text>
        </View>
      </View>

      <View style={rw.scoreRow}>
        <Text style={rw.scoreBig}>{data.score.toFixed(2)}</Text>
        <Text style={rw.scoreMax}>/ 5.00</Text>
      </View>

      {data.nextLevel && (
        <View style={rw.progressWrap}>
          <View style={rw.progressBar}>
            <View style={[rw.progressFill, { width: `${data.progressPercent}%` }]} />
          </View>
          <Text style={rw.progressHint}>
            {data.nextLevel} seviyesine %{data.progressPercent} — {data.levelPerk}
          </Text>
        </View>
      )}

      <View style={rw.statsRow}>
        <View style={rw.stat}>
          <Text style={rw.statVal}>{data.stats.verifications}</Text>
          <Text style={rw.statLbl}>Doğrulama</Text>
        </View>
        <View style={rw.divLine} />
        <View style={rw.stat}>
          <Text style={rw.statVal}>{data.stats.submissions}</Text>
          <Text style={rw.statLbl}>Bildirim</Text>
        </View>
        <View style={rw.divLine} />
        <View style={rw.stat}>
          <Text style={rw.statVal}>{data.stats.approved}</Text>
          <Text style={rw.statLbl}>Onaylanan</Text>
        </View>
      </View>

      <Text style={rw.note}>
        Katkın arttıkça partner market kuponları açılır — profilde Market Kuponlarım bölümüne bak.
      </Text>
    </View>
  );
}

const QUICK_PICKS = ['Ekmek', 'Süt', 'Su', 'Deterjan'];

function QuickActionsPanel() {
  return (
    <View style={qa.wrap}>
      <Text style={qa.title}>Hızlı Katkı</Text>

      <View style={qa.card}>
        <View style={qa.cardHead}>
          <View style={[qa.iconWrap, qa.iconVerify]}>
            <Ionicons name="checkmark-done-outline" size={20} color="#7c3aed" />
          </View>
          <View style={qa.cardText}>
            <Text style={qa.cardTitle}>Fiyatları Doğrula</Text>
            <Text style={qa.cardSub}>Ürün seç → fiyatların altında Doğru / Yanlış (+0.05)</Text>
          </View>
        </View>
        <View style={qa.btnRow}>
          <TouchableOpacity
            style={qa.btn}
            onPress={() => router.push({ pathname: '/scan', params: { intent: 'verify' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="scan-outline" size={16} color="#7c3aed" />
            <Text style={qa.btnTxt}>Barkod</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[qa.btn, qa.btnPrimary]}
            onPress={() => router.push({ pathname: '/(tabs)/search', params: { intent: 'verify' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color="#fff" />
            <Text style={[qa.btnTxt, qa.btnTxtPrimary]}>Ürün Ara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[qa.card, qa.cardSubmit]}>
        <View style={qa.cardHead}>
          <View style={[qa.iconWrap, qa.iconSubmit]}>
            <Ionicons name="megaphone-outline" size={20} color="#fff" />
          </View>
          <View style={qa.cardText}>
            <Text style={[qa.cardTitle, qa.cardTitleLight]}>Fiyat Bildir</Text>
            <Text style={[qa.cardSub, qa.cardSubLight]}>Markette gördüğün fiyatı paylaş (+0.08)</Text>
          </View>
        </View>
        <View style={qa.btnRow}>
          <TouchableOpacity
            style={[qa.btn, qa.btnOnPurple]}
            onPress={() => router.push({ pathname: '/scan', params: { intent: 'submit' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="scan-outline" size={16} color="#fff" />
            <Text style={[qa.btnTxt, qa.btnTxtPrimary]}>Barkod</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[qa.btn, qa.btnOnPurpleSolid]}
            onPress={() => router.push({ pathname: '/(tabs)/search', params: { intent: 'submit' } })}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={16} color="#7c3aed" />
            <Text style={[qa.btnTxt, qa.btnTxtOnSolid]}>Ürün Ara</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={qa.picksRow}>
        <Text style={qa.picksLbl}>Hızlı:</Text>
        {QUICK_PICKS.map((term) => (
          <TouchableOpacity
            key={term}
            style={qa.pickChip}
            onPress={() => router.push({
              pathname: '/(tabs)/search',
              params: { intent: 'verify', q: term },
            })}
            activeOpacity={0.85}
          >
            <Text style={qa.pickTxt}>{term}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ActivityFeed({ events }: { events: ReputationProfile['recentEvents'] }) {
  if (events.length === 0) {
    return (
      <TouchableOpacity
        style={af.empty}
        onPress={() => router.push({ pathname: '/scan', params: { intent: 'verify' } })}
        activeOpacity={0.85}
      >
        <Ionicons name="scan-outline" size={24} color={COLORS.primary} />
        <Text style={af.emptyTitle}>Henüz katkın yok</Text>
        <Text style={af.emptySub}>
          Barkod tara veya ürün ara — fiyatları doğrula, market fiyatı bildir.
        </Text>
        <View style={af.emptyBtn}>
          <Text style={af.emptyBtnTxt}>Barkod Tara</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={af.list}>
      {events.slice(0, 4).map((ev) => (
        <View key={ev.id} style={af.row}>
          <View style={[af.iconWrap, ev.points >= 0 ? af.iconPos : af.iconNeg]}>
            <Ionicons
              name={eventIcon(ev.type)}
              size={16}
              color={ev.points >= 0 ? '#7c3aed' : '#dc2626'}
            />
          </View>
          <View style={af.rowBody}>
            <Text style={af.rowTitle} numberOfLines={1}>{ev.title}</Text>
            {ev.description ? (
              <Text style={af.rowDesc} numberOfLines={1}>{ev.description}</Text>
            ) : null}
          </View>
          <View style={af.rowRight}>
            <Text style={[af.points, ev.points >= 0 ? af.pointsPos : af.pointsNeg]}>
              {ev.points >= 0 ? '+' : ''}{ev.points.toFixed(2)}
            </Text>
            <Text style={af.date}>{formatEventDate(ev.createdAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ContributionSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-reputation'],
    queryFn: getMyReputation,
    staleTime: 60_000,
  });

  return (
    <View style={cs.wrap}>
      <View style={cs.sectionHeader}>
        <Text style={cs.sectionTitle}>Topluluk Katkım</Text>
        <Text style={cs.sectionSub}>Fiyat doğrulama & bildirim itibarı</Text>
      </View>

      {isLoading ? (
        <View style={cs.loading}>
          <ActivityIndicator color="#7c3aed" size="large" />
        </View>
      ) : isError || !data ? (
        <View style={cs.loading}>
          <Text style={cs.errorTxt}>İtibar bilgisi yüklenemedi</Text>
        </View>
      ) : (
        <>
          <ReputationWidget data={data} />

          <QuickActionsPanel />

          <View style={cs.activityHeader}>
            <Text style={cs.activityTitle}>Son Aktiviteler</Text>
          </View>
          <ActivityFeed events={data.recentEvents} />

          <View style={cs.tipsCard}>
            <Ionicons name="bulb-outline" size={16} color="#7c3aed" />
            <Text style={cs.tipsText}>{data.engagementTips[0]}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 6 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  loading: { padding: 32, alignItems: 'center' },
  errorTxt: { color: '#64748b', fontSize: 13 },
  activityHeader: { marginBottom: 8 },
  activityTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  tipsCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#faf5ff', borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#ede9fe',
  },
  tipsText: { flex: 1, fontSize: 11, color: '#6d28d9', lineHeight: 16 },
});

const rw = StyleSheet.create({
  card: {
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 },
      android: { elevation: 10 },
    }),
  },
  decor1: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -30 },
  decor2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -25, left: -15 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  levelEmoji: { fontSize: 28 },
  topText: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  levelName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  trustBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  trustTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 },
  scoreBig: { fontSize: 36, fontWeight: '800', color: '#fff' },
  scoreMax: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  progressWrap: { marginBottom: 14 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  progressHint: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
  divLine: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  note: { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
});

const qa = StyleSheet.create({
  wrap: { marginBottom: 16, gap: 10 },
  title: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#ede9fe',
    ...Platform.select({
      ios: { shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  cardSubmit: { backgroundColor: '#7c3aed', borderColor: '#6d28d9' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconVerify: { backgroundColor: '#f5f3ff' },
  iconSubmit: { backgroundColor: 'rgba(255,255,255,0.2)' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  cardTitleLight: { color: '#fff' },
  cardSub: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 15 },
  cardSubLight: { color: 'rgba(255,255,255,0.8)' },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, backgroundColor: '#f5f3ff',
    borderWidth: 1, borderColor: '#ddd6fe',
  },
  btnPrimary: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  btnOnPurple: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  btnOnPurpleSolid: { backgroundColor: '#fff', borderColor: '#fff' },
  btnTxt: { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
  btnTxtPrimary: { color: '#fff' },
  btnTxtOnSolid: { color: '#7c3aed' },
  picksRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  picksLbl: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  pickChip: {
    backgroundColor: '#f5f3ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ddd6fe',
  },
  pickTxt: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
});

const af = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  iconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  iconPos: { backgroundColor: '#f5f3ff' },
  iconNeg: { backgroundColor: '#fef2f2' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  rowDesc: { fontSize: 11, color: '#64748b', marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  points: { fontSize: 13, fontWeight: '800' },
  pointsPos: { color: '#7c3aed' },
  pointsNeg: { color: '#dc2626' },
  date: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  empty: {
    alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14,
    padding: 24, borderWidth: 1.5, borderColor: '#ddd6fe', borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#5b21b6' },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4,
  },
  emptyBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
