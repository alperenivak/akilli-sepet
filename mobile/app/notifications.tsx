// Kullanici bildirimleri — ihbar durum guncellemeleri
import React from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getMyReports } from '../src/api/reports';
import { Report } from '../src/types/api';
import { COLORS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '../src/utils/constants';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  UNDER_REVIEW: 'search-outline',
  APPROVED: 'checkmark-circle-outline',
  REJECTED: 'close-circle-outline',
  RESOLVED: 'checkmark-done-outline',
};

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: 'İhbarınız alındı ve inceleme bekliyor.',
  UNDER_REVIEW: 'İhbarınız yetkili tarafından inceleniyor.',
  APPROVED: 'İhbarınız onaylandı. Teşekkürler!',
  REJECTED: 'İhbarınız incelendi ancak onaylanmadı.',
  RESOLVED: 'İhbarınız çözüme kavuşturuldu.',
};

export default function NotificationsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-reports-notifications'],
    queryFn: () => getMyReports(1, 50),
  });

  const reports = (data?.items ?? []).slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Bildirimler', headerBackTitle: 'Profil' }} />

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {!isLoading && isError && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Bildirimler yüklenemedi</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && reports.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Henüz bildirim yok</Text>
          <Text style={styles.emptySubtitle}>
            İhbarlarınızın durumu değiştiğinde burada görünecek
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.push('/reports/create')}
          >
            <Text style={styles.retryBtnText}>İhbar Oluştur</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && reports.length > 0 && (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: Report }) => {
            const color = REPORT_STATUS_COLORS[item.status] ?? COLORS.textMuted;
            const icon = STATUS_ICONS[item.status] ?? 'notifications-outline';
            const message = STATUS_MESSAGES[item.status] ?? '';
            return (
              <View style={[styles.card, { borderLeftColor: color }]}>
                <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={22} color={color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <Text style={[styles.statusLabel, { color }]}>
                      {REPORT_STATUS_LABELS[item.status]}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                    </Text>
                  </View>
                  <Text style={styles.message}>{message}</Text>
                  <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                  {item.userNote ? (
                    <View style={styles.adminNote}>
                      <Ionicons name="information-circle-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.adminNoteText}>{item.userNote}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  list: { padding: 14, gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  date: { fontSize: 11, color: COLORS.textMuted },
  message: { fontSize: 13, color: COLORS.text, marginBottom: 4, lineHeight: 18 },
  description: { fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  adminNote: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
    marginTop: 6,
    backgroundColor: COLORS.primaryLight ?? '#EEF2FF',
    padding: 7,
    borderRadius: 8,
  },
  adminNoteText: { flex: 1, fontSize: 12, color: COLORS.primary },
});
