// =====================================================
// Akıllı Sepet — Bildirim Merkezi
// Tüm bildirim tipleri: fiyat düşüşü, ihbar, katalog, AI
// =====================================================

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications, markNotificationsRead, AppNotification } from '../src/api/notifications';
import { useAuthStore } from '../src/store/authStore';
import { COLORS } from '../src/utils/constants';

// ── Bildirim tipi konfigürasyonu ──────────────────────
const TYPE_CONFIG: Record<AppNotification['type'], {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
}> = {
  PRICE_DROP: {
    icon: 'trending-down',
    color: '#16a34a',
    bg: '#f0fdf4',
    label: 'Fiyat Düştü',
  },
  PRICE_ALERT: {
    icon: 'notifications',
    color: '#2563eb',
    bg: '#eff6ff',
    label: 'Fiyat Alarmı',
  },
  REPORT_STATUS: {
    icon: 'document-text',
    color: '#ea580c',
    bg: '#fff7ed',
    label: 'İhbar Güncellendi',
  },
  NEW_CATALOG: {
    icon: 'book',
    color: '#7c3aed',
    bg: '#f5f3ff',
    label: 'Yeni Katalog',
  },
  AI_RECOMMENDATION: {
    icon: 'sparkles',
    color: '#0891b2',
    bg: '#ecfeff',
    label: 'Akıllı Öneri',
  },
  SYSTEM: {
    icon: 'settings',
    color: '#64748b',
    bg: '#f8fafc',
    label: 'Sistem',
  },
};

// ── Zaman formatla ────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Az önce';
  if (mins < 60) return `${mins} dakika önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

// ── Bildirim kartı ────────────────────────────────────
function NotificationCard({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.SYSTEM;

  return (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Sol: ikon */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* İçerik */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
        </View>

        <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardBody} numberOfLines={2}>
          {item.body}
        </Text>
      </View>

      {/* Okunmamış nokta */}
      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
    </TouchableOpacity>
  );
}

// ── Ana ekran ─────────────────────────────────────────
export default function NotificationsScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getMyNotifications(1, 50),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handlePress = useCallback((n: AppNotification) => {
    if (!n.isRead) {
      markRead.mutate([n.id]);
    }
    // Tipe göre yönlendirme
    if (n.type === 'REPORT_STATUS' && n.data?.reportId) {
      router.push('/reports/create' as any);
    } else if (n.type === 'PRICE_DROP' && n.data?.productId) {
      router.push(`/product/${n.data.productId}` as any);
    } else if (n.type === 'NEW_CATALOG') {
      router.push('/markets' as any);
    }
  }, [markRead]);

  const handleMarkAllRead = () => {
    markRead.mutate(undefined);
  };

  const notifications = data?.items ?? [];
  const unreadCount   = data?.unreadCount ?? 0;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: 'Bildirimler' }} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Giriş Gerekli</Text>
          <Text style={styles.emptySubtitle}>Bildirimlerinizi görmek için giriş yapın</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/auth/login' as any)}>
            <Text style={styles.actionBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          title: 'Bildirimler',
          headerBackTitle: 'Profil',
          headerRight: unreadCount > 0
            ? () => (
                <TouchableOpacity onPress={handleMarkAllRead} style={{ marginRight: 16 }}>
                  <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '700' }}>
                    Tümünü Oku
                  </Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      {/* Üst özet */}
      {unreadCount > 0 && (
        <View style={styles.summaryBar}>
          <Ionicons name="notifications" size={16} color={COLORS.primary} />
          <Text style={styles.summaryText}>
            <Text style={{ fontWeight: '800' }}>{unreadCount}</Text> okunmamış bildirim
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Bildirimler yükleniyor…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Yüklenemedi</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => refetch()}>
            <Text style={styles.actionBtnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>Henüz Bildirim Yok</Text>
          <Text style={styles.emptySubtitle}>
            Fiyat düşüşleri, ihbar güncellemeleri ve özel teklifler burada görünecek
          </Text>

          {/* Bildirim tipleri tanıtım */}
          <View style={styles.typeGrid}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <View key={key} style={[styles.typeChip, { backgroundColor: cfg.bg }]}>
                <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                <Text style={[styles.typeChipText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={handlePress} />
          )}
          ListFooterComponent={
            notifications.length > 0 ? (
              <Text style={styles.footerText}>{notifications.length} bildirim</Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}20`,
  },
  summaryText: { fontSize: 13, color: COLORS.primary },

  list: { padding: 14, paddingBottom: 32 },
  separator: { height: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: '#fafbff',
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  timeText: { fontSize: 10, color: COLORS.textMuted },

  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 3,
  },
  cardTitleUnread: { fontWeight: '800' },
  cardBody: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
    marginTop: 4,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typeChipText: { fontSize: 11, fontWeight: '700' },

  actionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  actionBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  loadingText: { fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
  footerText: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 16 },
});
