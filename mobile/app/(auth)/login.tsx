// =====================================================
// Akıllı Sepet - Giriş Ekranı (Premium Tasarım)
// =====================================================

import React, { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { showAppError } from '../../src/store/messageStore';
import { COLORS } from '../../src/utils/constants';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { icon: 'pricetag-outline',    text: 'Anlık fiyat karşılaştırma' },
  { icon: 'scan-outline',        text: 'Barkod ile anında sorgulama' },
  { icon: 'notifications-outline', text: 'SKT yaklaşan ürün uyarıları' },
];

export default function LoginScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused]   = useState(false);

  useEffect(() => {
    if (typeof emailParam === 'string' && emailParam.trim()) {
      setEmail(emailParam.trim());
    }
  }, [emailParam]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAppError('Eksik bilgi', 'E-posta ve şifre alanları zorunludur.');
      return;
    }
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      showAppError('Giriş başarısız', error.message ?? 'Bilgilerinizi kontrol edin.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Üst Dekoratif Alan ── */}
          <View style={s.hero}>
            {/* Dekoratif daireler */}
            <View style={s.circle1} />
            <View style={s.circle2} />

            <View style={s.logoWrap}>
              <View style={s.logoBox}>
                <Ionicons name="cart" size={38} color="#fff" />
              </View>
              <Text style={s.brand}>Akıllı Sepet</Text>
              <Text style={s.brandSub}>Akıllı alışverişin adresi</Text>
            </View>

            {/* Özellik rozetleri */}
            <View style={s.features}>
              {FEATURES.map((f) => (
                <View key={f.text} style={s.featureRow}>
                  <View style={s.featureIcon}>
                    <Ionicons name={f.icon as any} size={14} color={COLORS.primary} />
                  </View>
                  <Text style={s.featureTxt}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Form Kartı ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Hoş Geldiniz</Text>
            <Text style={s.cardSub}>Hesabınıza giriş yapın</Text>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>E-posta</Text>
              <View style={[s.field, emailFocused && s.fieldFocused]}>
                <Ionicons name="mail-outline" size={18} color={emailFocused ? COLORS.primary : '#94a3b8'} />
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ornek@email.com"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Şifre */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>Şifre</Text>
              <View style={[s.field, passFocused && s.fieldFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={passFocused ? COLORS.primary : '#94a3b8'} />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Şifrenizi girin"
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={s.forgotBtn}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={s.forgotTxt}>Şifremi unuttum</Text>
            </TouchableOpacity>

            {/* Giriş Yap butonu */}
            <TouchableOpacity
              style={[s.primaryBtn, isLoading && s.disabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <Text style={s.primaryBtnTxt}>Giriş Yapılıyor…</Text>
              ) : (
                <>
                  <Text style={s.primaryBtnTxt}>Giriş Yap</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Ayraç */}
            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divTxt}>veya</Text>
              <View style={s.divLine} />
            </View>

            {/* Kayıt ol */}
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
              <Text style={s.secondaryBtnTxt}>Yeni Hesap Oluştur</Text>
            </TouchableOpacity>

            {/* Misafir giriş */}
            <TouchableOpacity style={s.guestBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={s.guestTxt}>Şimdilik giriş yapmadan devam et</Text>
              <Ionicons name="chevron-forward" size={13} color="#94a3b8" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f0f6ff' },
  scroll: { flexGrow: 1 },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -80, right: -50,
  },
  circle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -40, left: -20,
  },
  logoWrap: { alignItems: 'center', gap: 6, marginBottom: 28 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  brand:    { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  brandSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  features: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTxt: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

  // Form kartı
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 14,
    flex: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  cardSub:   { fontSize: 14, color: '#64748b', marginTop: -6 },

  // Form alanları
  fieldGroup: { gap: 6 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  fieldFocused: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  input:        { flex: 1, fontSize: 14, color: '#0f172a' },

  forgotBtn: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 4, paddingVertical: 4 },
  forgotTxt: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Butonlar
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 15,
    marginTop: 4,
    ...Platform.select({
      ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  disabled:       { opacity: 0.6 },
  primaryBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#bfdbfe',
  },
  secondaryBtnTxt: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },

  divider:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine:  { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  divTxt:   { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  guestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  guestTxt: { fontSize: 13, color: '#94a3b8' },
});
