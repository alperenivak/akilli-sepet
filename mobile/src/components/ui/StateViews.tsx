// =====================================================
// Akıllı Sepet - Boş / hata / bağlantı durumları (premium)
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, COLORS } from '../../utils/constants';

type StateKind = 'empty' | 'error' | 'offline' | 'search';

const PRESETS: Record<StateKind, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  defaultTitle: string;
}> = {
  empty:   { icon: 'cube-outline',           color: COLORS.primary, bg: COLORS.primaryLight, defaultTitle: 'İçerik bulunamadı' },
  error:   { icon: 'alert-circle-outline',   color: '#ef4444',      bg: '#fef2f2',           defaultTitle: 'Bir sorun oluştu' },
  offline: { icon: 'cloud-offline-outline',  color: '#f59e0b',      bg: '#fffbeb',           defaultTitle: 'Bağlantı kurulamadı' },
  search:  { icon: 'search-outline',         color: '#64748b',      bg: '#f1f5f9',           defaultTitle: 'Sonuç bulunamadı' },
};

interface StateViewProps {
  kind?: StateKind;
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

export function StateView({
  kind = 'empty',
  title,
  subtitle,
  onRetry,
  retryLabel = 'Tekrar Dene',
  compact = false,
}: StateViewProps) {
  const p = PRESETS[kind];
  return (
    <View style={[s.wrap, compact && s.wrapCompact]}>
      <View style={[s.iconBox, { backgroundColor: p.bg }]}>
        <Ionicons name={p.icon} size={compact ? 36 : 48} color={p.color} />
      </View>
      <Text style={s.title}>{title ?? p.defaultTitle}</Text>
      {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.85}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={s.retryTxt}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** @deprecated ErrorView yerine StateView kullanın */
export function ConnectionErrorView({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateView
      kind="offline"
      title="Sunucuya ulaşılamıyor"
      subtitle={`Backend çalışıyor mu? Telefon ve bilgisayar aynı Wi‑Fi ağında olmalı.\n\nDenenen adres:\n${API_BASE_URL}`}
      onRetry={onRetry}
    />
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 10,
    minHeight: 200,
  },
  wrapCompact: { padding: 24, minHeight: 160 },
  iconBox: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  sub: {
    fontSize: 13, color: '#64748b', textAlign: 'center',
    lineHeight: 20, maxWidth: 300,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, backgroundColor: COLORS.primary,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  retryTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
