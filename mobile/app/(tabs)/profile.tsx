// =====================================================
// Akıllı Sepet - Profil Ekranı (Premium)
// Kullanıcı bilgileri · Düzenleme · Tasarruf · İhbarlar
// =====================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity,
  TextInput, Modal, Animated, Dimensions, Platform,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/authStore';
import { getMyReports } from '../../src/api/reports';
import { getMyNotifications } from '../../src/api/notifications';
import { usePriceAlerts } from '../../src/hooks/usePriceAlerts';
import { updateProfile, getMyProfile } from '../../src/api/users';
import { ContributionSection } from '../../src/components/reputation/ContributionSection';
import { CouponsSummaryCard } from '../../src/components/reputation/CouponsSummaryCard';
import { COLORS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '../../src/utils/constants';
import { GuestBanner } from '../../src/components/profile/GuestBanner';
import { Report } from '../../src/types/api';

const { height: SH } = Dimensions.get('window');

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Süper Yönetici', ADMIN: 'Yönetici',
  INSPECTOR: 'Denetçi', MARKET_MANAGER: 'Market Yöneticisi', USER: 'Kullanıcı',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#7c3aed', ADMIN: '#1d4ed8', INSPECTOR: '#0369a1',
  MARKET_MANAGER: '#065f46', USER: '#374151',
};

// ── Profil Düzenleme Bottom Sheet ───────────────────
function EditProfileSheet({ visible, user, onClose, onSaved }: {
  visible: boolean;
  user: { name?: string; surname?: string; phone?: string; email?: string } | null;
  onClose: () => void;
  onSaved: (u: any) => void;
}) {
  const slideAnim = useRef(new Animated.Value(SH)).current;
  const [form, setForm] = useState({ name: '', surname: '', phone: '' });
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (visible && user) {
      setForm({ name: user.name ?? '', surname: user.surname ?? '', phone: user.phone ?? '' });
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SH, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, user]);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      onSaved(updated);
      onClose();
    },
    onError: () => Alert.alert('Hata', 'Güncelleme başarısız. Tekrar deneyin.'),
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={es.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[es.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={es.handle} />
        <Text style={es.title}>Profili Düzenle</Text>

        {[
          { label: 'Ad', key: 'name' as const, icon: 'person-outline', placeholder: 'Adınız', autoCapitalize: 'words' as const },
          { label: 'Soyad', key: 'surname' as const, icon: 'people-outline', placeholder: 'Soyadınız', autoCapitalize: 'words' as const },
          { label: 'Telefon', key: 'phone' as const, icon: 'call-outline', placeholder: '+90 5xx xxx xx xx', autoCapitalize: 'none' as const },
        ].map((f) => (
          <View key={f.key} style={es.field}>
            <Text style={es.label}>{f.label}</Text>
            <View style={es.inputWrap}>
              <Ionicons name={f.icon as any} size={16} color="#94a3b8" />
              <TextInput
                style={es.input}
                value={form[f.key]}
                onChangeText={set(f.key)}
                placeholder={f.placeholder}
                placeholderTextColor="#cbd5e1"
                autoCapitalize={f.autoCapitalize}
                keyboardType={f.key === 'phone' ? 'phone-pad' : 'default'}
              />
            </View>
          </View>
        ))}

        {/* E-posta (salt okunur) */}
        <View style={es.field}>
          <Text style={es.label}>E-posta (değiştirilemez)</Text>
          <View style={[es.inputWrap, { backgroundColor: '#f1f5f9' }]}>
            <Ionicons name="mail-outline" size={16} color="#94a3b8" />
            <Text style={[es.input, { color: '#94a3b8' }]}>{user?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[es.saveBtn, mutation.isPending && { opacity: 0.6 }]}
          onPress={() => mutation.mutate(form)}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={es.saveTxt}>Kaydet</Text></>}
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}

// ── Tasarruf Widget ──────────────────────────────────
function SavingsWidget({ reportCount, alertCount }: { reportCount: number; alertCount: number }) {
  const estimatedSaving = reportCount * 4 + alertCount * 12;
  const priceChecks = alertCount + reportCount;
  const hasActivity = reportCount > 0 || alertCount > 0;

  return (
    <View style={sw.wrap}>
      <View style={sw.sectionHeader}>
        <Text style={sw.sectionTitle}>Tasarruf Takibim</Text>
        <Text style={sw.sectionSub}>Sepet ve fiyat alarmı bazlı tahmin</Text>
      </View>
      <View style={sw.card}>
        <View style={sw.decor1} />
        <View style={sw.decor2} />

        <View style={sw.topRow}>
          <Ionicons name="trending-down" size={20} color="#fff" />
          <Text style={sw.cardTitle}>Tahmini Tasarruf</Text>
          <View style={sw.betaBadge}><Text style={sw.betaTxt}>BETA</Text></View>
        </View>

        <Text style={sw.bigAmount}>{estimatedSaving}₺</Text>
        <Text style={sw.bigSub}>
          {hasActivity
            ? 'Bu ay sepet ve alarmlarınla yaklaşık tasarruf'
            : 'Fiyat alarmı veya SKT ihbarı ekledikçe tasarrufun burada görünür'}
        </Text>

        <View style={sw.statsRow}>
          <View style={sw.stat}>
            <Text style={sw.statVal}>{alertCount}</Text>
            <Text style={sw.statLbl}>Fiyat alarmı</Text>
          </View>
          <View style={sw.divLine} />
          <View style={sw.stat}>
            <Text style={sw.statVal}>{priceChecks}</Text>
            <Text style={sw.statLbl}>Takip</Text>
          </View>
          <View style={sw.divLine} />
          <View style={sw.stat}>
            <Text style={sw.statVal}>{reportCount}</Text>
            <Text style={sw.statLbl}>SKT ihbarı</Text>
          </View>
        </View>

        <Text style={sw.note}>
          * Sepet optimizasyonu ve alarm verilerinize göre hesaplanır.
        </Text>
      </View>
    </View>
  );
}

// ── Ana Ekran ────────────────────────────────────────
export default function ProfileScreen() {
  const { user: authUser, isAuthenticated, logout } = useAuthStore();
  const [editVisible, setEditVisible] = useState(false);
  const [localUser, setLocalUser] = useState(authUser);
  const queryClient = useQueryClient();

  // Ekrana her odaklanıldığında kullanıcı verisini taze tut
  useFocusEffect(
    useCallback(() => {
      setLocalUser(authUser);
    }, [authUser])
  );

  // Profilim detaylı sorgula
  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: getMyProfile,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const displayUser = profileData ?? localUser ?? authUser;

  // Son 3 ihbar
  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['my-reports', 1, 5],
    queryFn: () => getMyReports(1, 5),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const reports = reportsData?.items ?? [];
  const reportTotal = reportsData?.total ?? 0;

  const { data: activeAlerts = [], refetch: refetchAlerts } = usePriceAlerts('active');
  const alertTotal = activeAlerts.length;

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getMyNotifications(1, 50),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const unreadNotifCount = notifData?.unreadCount ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchProfile(),
      refetchReports(),
      refetchAlerts(),
      queryClient.invalidateQueries({ queryKey: ['my-reputation'] }),
    ]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'İptal' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        await logout();
        router.replace('/(tabs)');
      }},
    ]);
  };

  if (!isAuthenticated) {
    return <SafeAreaView style={s.safe}><GuestBanner /></SafeAreaView>;
  }

  const initials = `${displayUser?.name?.slice(0, 1) ?? ''}${displayUser?.surname?.slice(0, 1) ?? ''}`.toUpperCase() || '?';
  const roleColor = ROLE_COLORS[displayUser?.role ?? ''] ?? '#374151';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Kullanıcı Kartı (tıklanabilir) ── */}
        <TouchableOpacity style={s.userCard} onPress={() => setEditVisible(true)} activeOpacity={0.9}>
          {/* Avatar */}
          <View style={[s.avatar, { backgroundColor: COLORS.primary }]}>
            <Text style={s.avatarTxt}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.userName} numberOfLines={1}>
              {displayUser?.name} {displayUser?.surname}
            </Text>
            <Text style={s.userEmail} numberOfLines={1}>{displayUser?.email}</Text>
            <View style={[s.roleBadge, { backgroundColor: roleColor + '15' }]}>
              <Text style={[s.roleTxt, { color: roleColor }]}>
                {ROLE_LABELS[displayUser?.role ?? ''] ?? displayUser?.role}
              </Text>
            </View>
          </View>

          <View style={s.editHint}>
            <Ionicons name="pencil" size={14} color={COLORS.primary} />
            <Text style={s.editHintTxt}>Düzenle</Text>
          </View>
        </TouchableOpacity>

        {/* ── Topluluk Katkım (İtibar + Fiyat Bildirimi) ── */}
        <ContributionSection />
        <CouponsSummaryCard />

        {/* ── Tasarruf Takibim ── */}
        <SavingsWidget reportCount={reportTotal} alertCount={alertTotal} />

        {/* ── Son İhbarlar ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Son İhbarlarım</Text>
            {reportTotal > 0 && (
              <TouchableOpacity onPress={() => router.push('/reports/my')}>
                <Text style={s.seeAll}>Tümü ({reportTotal})</Text>
              </TouchableOpacity>
            )}
          </View>

          {reportsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
          ) : reports.length === 0 ? (
            <TouchableOpacity style={s.emptyReport} onPress={() => router.push('/reports/create')} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
              <Text style={s.emptyReportTxt}>Henüz ihbar oluşturmadınız</Text>
              <Text style={s.emptyReportSub}>Markette SKT geçmiş ürün gördünüz mü? Bildirin!</Text>
            </TouchableOpacity>
          ) : (
            reports.slice(0, 3).map((r: Report) => (
              <View key={r.id} style={s.reportRow}>
                <View style={[s.statusDot, { backgroundColor: REPORT_STATUS_COLORS[r.status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.reportDesc} numberOfLines={2}>{r.description}</Text>
                  <Text style={s.reportDate}>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: REPORT_STATUS_COLORS[r.status] + '18' }]}>
                  <Text style={[s.statusTxt, { color: REPORT_STATUS_COLORS[r.status] }]}>
                    {REPORT_STATUS_LABELS[r.status]}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Hesabım Menüsü ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Hesabım</Text>
          <View style={s.menuList}>
            <MenuRow icon="pricetags-outline" label="Takip Edilen Ürünler" badge={alertTotal > 0 ? String(alertTotal) : undefined} onPress={() => router.push('/alerts/my')} />
            <MenuRow icon="document-text-outline" label="Tüm İhbarlarım"      badge={reportTotal > 0 ? String(reportTotal) : undefined} onPress={() => router.push('/reports/my')} />
            <MenuRow icon="ribbon-outline" label="Katkılarım" onPress={() => router.push('/contributions/mine')} />
            <MenuRow icon="notifications-outline" label="Bildirimler" badge={unreadNotifCount > 0 ? String(unreadNotifCount) : undefined} onPress={() => router.push('/notifications')} />
            <MenuRow icon="chatbubble-ellipses-outline" label="Akıllı Asistan" onPress={() => router.push('/ai/chat')} />
            <MenuRow icon="scan-outline"          label="Barkod Tara"          onPress={() => router.push('/scan' as any)} />
          </View>
        </View>

        {/* ── Uygulama Menüsü ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Uygulama</Text>
          <View style={s.menuList}>
            <MenuRow icon="information-circle-outline" label="Hakkında"        onPress={() => router.push('/about' as any)} />
            <MenuRow icon="log-out-outline"            label="Çıkış Yap"       onPress={handleLogout} danger />
          </View>
        </View>
      </ScrollView>

      {/* ── Profil Düzenleme Sheet ── */}
      <EditProfileSheet
        visible={editVisible}
        user={displayUser}
        onClose={() => setEditVisible(false)}
        onSaved={(updated) => {
          setLocalUser((prev: any) => ({ ...prev, ...updated }));
          queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        }}
      />
    </SafeAreaView>
  );
}

// ── Menu Row ─────────────────────────────────────────
function MenuRow({ icon, label, onPress, danger, badge }: {
  icon: string; label: string; onPress: () => void; danger?: boolean; badge?: string;
}) {
  return (
    <TouchableOpacity style={[s.menuRow, danger && s.menuRowDanger]} onPress={onPress} activeOpacity={0.78}>
      <View style={[s.menuIcon, { backgroundColor: danger ? '#fef2f2' : COLORS.primaryLight }]}>
        <Ionicons name={icon as any} size={18} color={danger ? '#dc2626' : COLORS.primary} />
      </View>
      <Text style={[s.menuLabel, danger && { color: '#dc2626' }]}>{label}</Text>
      {badge && <View style={s.badge}><Text style={s.badgeTxt}>{badge}</Text></View>}
      {!danger && <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />}
    </TouchableOpacity>
  );
}

// ── Stiller ────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', padding: 20, margin: 16,
    borderRadius: 20,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontSize: 22, fontWeight: '800' },
  userName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  userEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  roleTxt:   { fontSize: 10, fontWeight: '700' },
  editHint:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  editHintTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  section: { marginHorizontal: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // İhbarlar
  emptyReport: {
    alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14,
    padding: 20, borderWidth: 1.5, borderColor: '#bfdbfe', borderStyle: 'dashed',
  },
  emptyReportTxt: { fontSize: 14, fontWeight: '700', color: '#1e40af' },
  emptyReportSub: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 } }) },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  reportDesc: { fontSize: 13, color: '#374151', lineHeight: 18 },
  reportDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt:  { fontSize: 10, fontWeight: '700' },

  // Menü
  menuList: { gap: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 } }) },
  menuRowDanger: { backgroundColor: '#fff7f7' },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  badge: { backgroundColor: COLORS.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
});

// Edit Sheet stilleri
const es = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 }, android: { elevation: 24 } }),
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  title:  { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  field:  { marginBottom: 14 },
  label:  { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 11 },
  input:  { flex: 1, fontSize: 14, color: '#0f172a' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 14, marginTop: 6,
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }, android: { elevation: 6 } }) },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// Savings Widget stilleri
const sw = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  card: {
    backgroundColor: COLORS.primary, borderRadius: 20, padding: 20, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 }, android: { elevation: 10 } }),
  },
  decor1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  decor2: { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  betaBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  betaTxt:   { fontSize: 10, fontWeight: '800', color: '#fff' },
  bigAmount: { fontSize: 40, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bigSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stat:      { flex: 1, alignItems: 'center' },
  statVal:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLbl:   { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
  divLine:   { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  note:      { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
});
