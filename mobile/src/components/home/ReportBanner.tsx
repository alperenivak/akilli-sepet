// =====================================================
// Akıllı Sepet - SKT Bildir Banner — Premium Tasarım
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export function ReportBanner() {
  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push('/reports/create')}
      activeOpacity={0.85}
      accessibilityLabel="Son kullanma tarihi geçmiş ürün bildir"
    >
      {/* Sol: ikon */}
      <View style={s.iconBox}>
        <Ionicons name="shield-checkmark" size={28} color="#f59e0b" />
      </View>

      {/* Orta: metin */}
      <View style={s.text}>
        <Text style={s.title}>SKT Geçmiş Ürün Gördünüz mü?</Text>
        <Text style={s.sub}>Bildirin — diğer kullanıcıları koruyun 🛡️</Text>
      </View>

      {/* Sağ: ok */}
      <View style={s.arrow}>
        <Ionicons name="chevron-forward" size={18} color="#f59e0b" />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    ...Platform.select({
      ios:     { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text:  { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#92400e', lineHeight: 18 },
  sub:   { fontSize: 11, color: '#b45309', marginTop: 2 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
