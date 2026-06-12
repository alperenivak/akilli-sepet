// =====================================================
// Akıllı Sepet - Misafir Kullanici Tanitim Banner Bileseni
// =====================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../../utils/constants';

export function GuestBanner() {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Ionicons name="cart" size={36} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Hesabınıza Giriş Yapın</Text>
      <Text style={styles.subtitle}>
        Sepet optimizasyonu, ihbar takibi ve kişisel öneriler için giriş yapın
      </Text>
      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => router.push('/(auth)/login')}
        accessibilityLabel="Giriş yap"
        accessibilityRole="button"
      >
        <Text style={styles.loginText}>Giriş Yap</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => router.push('/(auth)/register')}
        accessibilityLabel="Kayıt ol"
        accessibilityRole="button"
      >
        <Text style={styles.registerText}>Hesap Oluştur</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 32, gap: 12,
  },
  iconBox: {
    marginBottom: 8,
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  loginButton: {
    width: '100%', backgroundColor: COLORS.primary,
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  loginText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  registerButton: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.primary,
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  registerText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
});
