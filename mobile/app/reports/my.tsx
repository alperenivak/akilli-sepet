// =====================================================
// Akıllı Sepet - İhbarlarım Ekranı (Premium)
// Durum takibi · Detay görünümü · Filtreleme
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Modal, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyReports } from '../../src/api/reports';
import { Report } from '../../src/types/api';
import { COLORS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '../../src/utils/constants';

const { width } = Dimensions.get('window');

// Durum ikonu
const STATUS_ICONS: Record<string, string> = {
  PENDING:      'time-outline',
  UNDER_REVIEW: 'search-outline',
  APPROVED:     'checkmark-circle-outline',
  REJECTED:     'close-circle-outline',
  RESOLVED:     'shield-checkmark-outline',
};

// Filtre seçenekleri
const FILTERS = [
  { key: '',             label: 'Tümü' },
  { key: 'PENDING',      label: 'Beklemede' },
  { key: 'UNDER_REVIEW', label: 'İnceleniyor' },
  { key: 'APPROVED',     label: 'Onaylı' },
  { key: 'RESOLVED',     label: 'Çözüldü' },
  { key: 'REJECTED',     label: 'Reddedildi' },
];

// ── Rapor Detay Modalı ───────────────────────────────
function ReportDetailModal({ report, onClose }: { report: Report | null; onClose: () => void }) {
  if (!report) return null;
  const color  = REPORT_STATUS_COLORS[report.status];
  const label  = REPORT_STATUS_LABELS[report.status];
  const icon   = STATUS_ICONS[report.status];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose} />
      <View style={m.sheet}>
        <View style={m.handle} />

        {/* Durum başlığı */}
        <View style={[m.statusHeader, { backgroundColor: color + '12' }]}>
          <View style={[m.statusIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View>
            <Text style={[m.statusLabel, { color }]}>{label}</Text>
            <Text style={m.statusDate}>
              {new Date(report.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Açıklama */}
          <View style={m.section}>
            <Text style={m.sLabel}>Açıklama</Text>
            <Text style={m.sValue}>{report.description}</Text>
          </View>

          {/* Barkod */}
          {report.barcodeCode && (
            <View style={m.row}>
              <Ionicons name="barcode-outline" size={16} color="#94a3b8" />
              <Text style={m.rowTxt}>Barkod: <Text style={m.rowBold}>{report.barcodeCode}</Text></Text>
            </View>
          )}

          {/* SKT */}
          {report.expiryDate && (
            <View style={m.row}>
              <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
              <Text style={m.rowTxt}>Son Kullanma: <Text style={m.rowBold}>{report.expiryDate}</Text></Text>
            </View>
          )}

          {/* Market */}
          {report.market && (
            <View style={m.row}>
              <Ionicons name="storefront-outline" size={16} color="#94a3b8" />
              <Text style={m.rowTxt}>Market: <Text style={m.rowBold}>{report.market.name}</Text></Text>
            </View>
          )}

          {/* Anonim */}
          <View style={m.row}>
            <Ionicons name={report.isAnonymous ? 'eye-off-outline' : 'eye-outline'} size={16} color="#94a3b8" />
            <Text style={m.rowTxt}>{report.isAnonymous ? 'Anonim gönderildi' : 'İsimli gönderildi'}</Text>
          </View>

          {/* Inceleme yaniti */}
          {report.userNote && (
            <View style={m.noteBox}>
              <View style={m.noteHeader}>
                <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />
                <Text style={m.noteHeaderTxt}>İnceleme Yanıtı</Text>
              </View>
              <Text style={m.noteTxt}>{report.userNote}</Text>
            </View>
          )}

          {/* Durum zaman çizelgesi */}
          <Text style={[m.sLabel, { marginTop: 16, marginBottom: 8 }]}>Durum Geçmişi</Text>
          <View style={m.timeline}>
            {(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'RESOLVED'] as const).map((st, i) => {
              const passed = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'RESOLVED', 'REJECTED'].indexOf(report.status) >= i;
              const isCurrent = report.status === st;
              return (
                <View key={st} style={m.timelineItem}>
                  <View style={m.timelineLeft}>
                    <View style={[m.timelineDot, passed && { backgroundColor: REPORT_STATUS_COLORS[st] }, isCurrent && m.timelineDotActive]}>
                      {passed && <Ionicons name="checkmark" size={10} color="#fff" />}
                    </View>
                    {i < 3 && <View style={[m.timelineLine, passed && { backgroundColor: REPORT_STATUS_COLORS[st] + '60' }]} />}
                  </View>
                  <Text style={[m.timelineTxt, isCurrent && { color: REPORT_STATUS_COLORS[st], fontWeight: '700' }]}>
                    {REPORT_STATUS_LABELS[st]}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity style={m.closeBtn} onPress={onClose}>
          <Text style={m.closeBtnTxt}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Ana Ekran ────────────────────────────────────────
export default function MyReportsScreen() {
  const [filter, setFilter]   = useState('');
  const [selected, setSelected] = useState<Report | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => getMyReports(),
  });

  const allReports = data?.items ?? [];
  const reports = filter ? allReports.filter((r: Report) => r.status === filter) : allReports;

  // Özet istatistikleri
  const pending  = allReports.filter((r: Report) => r.status === 'PENDING').length;
  const approved = allReports.filter((r: Report) => ['APPROVED', 'RESOLVED'].includes(r.status)).length;
  const total    = allReports.length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Üst Bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.topTitle}>İhbarlarım</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push('/reports/create')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Özet kartlar */}
      {!isLoading && total > 0 && (
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[s.statVal, { color: '#2563eb' }]}>{total}</Text>
            <Text style={s.statLbl}>Toplam</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fff7ed' }]}>
            <Text style={[s.statVal, { color: '#ea580c' }]}>{pending}</Text>
            <Text style={s.statLbl}>Beklemede</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[s.statVal, { color: '#16a34a' }]}>{approved}</Text>
            <Text style={s.statLbl}>Onaylı</Text>
          </View>
        </View>
      )}

      {/* Filtre satırı */}
      {!isLoading && total > 0 && (
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[s.filterChip, filter === f.key && s.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterTxt, filter === f.key && s.filterTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={52} color="#cbd5e1" />
          <Text style={s.emptyTitle}>Yüklenemedi</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={s.emptyTitle}>Henüz ihbar oluşturmadınız</Text>
          <Text style={s.emptySub}>Markette SKT geçmiş ürün fark ettiniz mi?</Text>
          <TouchableOpacity style={s.createBtn} onPress={() => router.push('/reports/create')}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={s.createBtnTxt}>İlk İhbarı Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : reports.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>Bu filtrede ihbar yok</Text>
          <TouchableOpacity onPress={() => setFilter('')}>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Tümünü göster</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item: Report) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: Report }) => {
            const color = REPORT_STATUS_COLORS[item.status];
            const icon  = STATUS_ICONS[item.status];
            return (
              <TouchableOpacity style={s.card} onPress={() => setSelected(item)} activeOpacity={0.82}>
                {/* Renk şeridi */}
                <View style={[s.accent, { backgroundColor: color }]} />

                <View style={s.cardBody}>
                  <View style={s.cardTop}>
                    <View style={[s.statusBadge, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon as any} size={12} color={color} />
                      <Text style={[s.statusTxt, { color }]}>{REPORT_STATUS_LABELS[item.status]}</Text>
                    </View>
                    <Text style={s.date}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
                  </View>

                  <Text style={s.desc} numberOfLines={2}>{item.description}</Text>

                  <View style={s.cardMeta}>
                    {item.market && (
                      <View style={s.metaChip}>
                        <Ionicons name="storefront-outline" size={11} color="#94a3b8" />
                        <Text style={s.metaTxt}>{item.market.name}</Text>
                      </View>
                    )}
                    {item.barcodeCode && (
                      <View style={s.metaChip}>
                        <Ionicons name="barcode-outline" size={11} color="#94a3b8" />
                        <Text style={s.metaTxt}>{item.barcodeCode}</Text>
                      </View>
                    )}
                    {item.isAnonymous && (
                      <View style={s.metaChip}>
                        <Ionicons name="eye-off-outline" size={11} color="#94a3b8" />
                        <Text style={s.metaTxt}>Anonim</Text>
                      </View>
                    )}
                  </View>

                  {item.userNote && (
                    <View style={s.notePreview}>
                      <Ionicons name="chatbubble-outline" size={12} color={COLORS.primary} />
                      <Text style={s.notePreviewTxt} numberOfLines={1}>{item.userNote}</Text>
                    </View>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ alignSelf: 'center', marginRight: 12 }} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <ReportDetailModal report={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  newBtn:   { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  statVal:  { fontSize: 22, fontWeight: '800' },
  statLbl:  { fontSize: 11, color: '#64748b', fontWeight: '500' },

  filterChip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTxt:        { fontSize: 12, color: '#64748b', fontWeight: '500' },
  filterTxtActive:  { color: '#fff', fontWeight: '700' },

  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 }, android: { elevation: 2 } }) },
  accent:   { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt:   { fontSize: 11, fontWeight: '700' },
  date:    { fontSize: 11, color: '#94a3b8' },
  desc:    { fontSize: 13, color: '#374151', lineHeight: 18 },
  cardMeta:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  metaTxt: { fontSize: 11, color: '#64748b' },
  notePreview: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  notePreviewTxt: { flex: 1, fontSize: 11, color: COLORS.primary },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle:{ fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  emptySub:  { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  retryBtn:  { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryTxt:  { color: '#fff', fontWeight: '700' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  createBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const m = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '80%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 0,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 }, android: { elevation: 24 } }) },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 14 },

  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 14, marginBottom: 14 },
  statusIcon:   { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusLabel:  { fontSize: 16, fontWeight: '800' },
  statusDate:   { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  section: { marginBottom: 12 },
  sLabel:  { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sValue:  { fontSize: 14, color: '#374151', lineHeight: 21 },

  row:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  rowTxt: { fontSize: 13, color: '#64748b' },
  rowBold:{ fontWeight: '700', color: '#374151' },

  noteBox:    { backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12, marginVertical: 10, gap: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteHeaderTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  noteTxt:    { fontSize: 13, color: '#1e40af', lineHeight: 19 },

  timeline:     { gap: 0, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 20 },
  timelineDot:  { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  timelineDotActive: { transform: [{ scale: 1.2 }] },
  timelineLine: { width: 2, height: 24, backgroundColor: '#e2e8f0', marginTop: 2 },
  timelineTxt:  { fontSize: 13, color: '#94a3b8', paddingTop: 2, paddingBottom: 26 },

  closeBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center', margin: 16 },
  closeBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
