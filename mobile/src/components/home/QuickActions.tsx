// =====================================================
// Akıllı Sepet - Hızlı Erişim Kartları
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { openBarcodeScanner } from '../../utils/openBarcodeScanner';
import { Ionicons } from '@expo/vector-icons';

const CARD_W = (Dimensions.get('window').width - 16 * 2 - 10) / 2;

const ACTIONS = [
  { icon: 'sparkles',       color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    label: 'Akıllı Asistan', sub: 'Akıllı Sepet ile alışverişe sor', route: '/ai/chat' },
  { icon: 'warning',        color: '#d97706', bg: '#fffbeb', border: '#fde68a',
    label: 'SKT Bildir',    sub: 'Tarihi geçmiş ürün gördün mü?', route: '/reports/create' },
  { icon: 'barcode-outline',color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd',
    label: 'Barkod Tara',   sub: 'Fiyatı anında öğren', action: 'scan' as const },
  { icon: 'bag-outline',    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0',
    label: 'Sepetim',       sub: 'En ucuz kombinasyonu bul', route: '/(tabs)/cart' },
] as const;

function navigateAction(a: (typeof ACTIONS)[number]) {
  if ('action' in a && a.action === 'scan') {
    openBarcodeScanner();
    return;
  }
  if ('route' in a) router.push(a.route as any);
}

export function QuickActions() {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Hızlı Erişim</Text>
      <View style={styles.grid}>
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.card, { backgroundColor: a.bg, borderColor: a.border }]}
            onPress={() => navigateAction(a)}
            activeOpacity={0.78}
          >
            <View style={[styles.iconWrap, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon as any} size={22} color={a.color} />
            </View>
            <Text style={styles.label}>{a.label}</Text>
            <Text style={styles.sub} numberOfLines={2}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: CARD_W, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 11, color: '#6b7280', lineHeight: 15 },
});
