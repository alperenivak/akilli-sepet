// =====================================================
// Akıllı Sepet - Arama Çubuğu — Premium Tasarım
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { openBarcodeScanner } from '../../utils/openBarcodeScanner';

export function HomeSearchBar() {
  return (
    <View style={s.wrapper}>
      <TouchableOpacity
        style={s.bar}
        onPress={() => router.push('/(tabs)/search')}
        activeOpacity={0.85}
        accessibilityLabel="Ürün veya marka ara"
        accessibilityRole="search"
      >
        <View style={s.iconWrap}>
          <Ionicons name="search" size={17} color={COLORS.primary} />
        </View>
        <Text style={s.placeholder}>Ürün, marka veya market ara…</Text>
      </TouchableOpacity>

      {/* Barkod tara kısayolu */}
      <TouchableOpacity
        style={s.scanBtn}
        onPress={openBarcodeScanner}
        activeOpacity={0.8}
        accessibilityLabel="Barkod Tara"
      >
        <Ionicons name="scan-outline" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#fff',
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { flex: 1, color: '#94a3b8', fontSize: 14, fontWeight: '400' },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
});
