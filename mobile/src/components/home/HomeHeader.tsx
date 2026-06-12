// =====================================================
// Akıllı Sepet - Ana Sayfa Baslik Bilesen i
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

export function HomeHeader() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.appName}>Akıllı Sepet</Text>
        <Text style={styles.tagline}>En iyi fiyatı sen bul</Text>
      </View>
      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => router.push('/ai/chat')}
        accessibilityLabel="YZ Asistanını Aç"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  appName: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  tagline: { fontSize: 12, color: COLORS.textMuted },
  aiButton: { padding: 8 },
});
