// =====================================================
// Akıllı Sepet - Hesap Oluştur Ekranı (Premium Tasarım)
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { sendOtp } from '../../src/api/auth';
import { showAppError, showAppSuccess } from '../../src/store/messageStore';
import { COLORS } from '../../src/utils/constants';

const STEPS = ['Kişisel', 'İletişim', 'Güvenlik'] as const;

type FormState = {
  name: string; surname: string;
  email: string; phone: string;
  verificationCode: string;
  password: string; confirmPassword: string;
};

export default function RegisterScreen() {
  const { register, isLoading } = useAuthStore();
  const [step, setStep]           = useState(0);
  const [showPass, setShowPass]   = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent]     = useState(false);
  const [form, setForm]           = useState<FormState>({
    name: '', surname: '', email: '', phone: '', verificationCode: '',
    password: '', confirmPassword: '',
  });

  const set = (key: keyof FormState) => (val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const validateStep = (): boolean => {
    if (step === 0 && (!form.name.trim() || !form.surname.trim())) {
      showAppError('Eksik bilgi', 'Ad ve soyad zorunludur.'); return false;
    }
    if (step === 1) {
      if (!form.email.trim()) {
        showAppError('Eksik bilgi', 'E-posta zorunludur.'); return false;
      }
      if (!/^\d{6}$/.test(form.verificationCode.trim())) {
        showAppError('Doğrulama gerekli', 'E-postanıza gelen 6 haneli kodu girin.'); return false;
      }
    }
    if (step === 2) {
      if (!form.password) { showAppError('Eksik bilgi', 'Şifre zorunludur.'); return false; }
      if (form.password.length < 6) { showAppError('Hata', 'Şifre en az 6 karakter olmalıdır.'); return false; }
      if (form.password !== form.confirmPassword) { showAppError('Hata', 'Şifreler eşleşmiyor.'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 2) { setStep((s) => s + 1); return; }
    handleRegister();
  };

  const handleRegister = async () => {
    try {
      await register({
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        verificationCode: form.verificationCode.trim(),
      });
      router.replace('/(tabs)');
    } catch (error: any) {
      showAppError('Kayıt başarısız', error.message ?? 'Bir sorun oluştu.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Başlık Barı ── */}
          <View style={s.topBar}>
            <TouchableOpacity style={s.backBtn} onPress={step > 0 ? () => setStep((s) => s - 1) : () => router.back()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.title}>Hesap Oluştur</Text>
              <Text style={s.stepSub}>Adım {step + 1} / {STEPS.length}</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* ── Step Progress ── */}
          <View style={s.progressRow}>
            {STEPS.map((label, i) => (
              <View key={label} style={s.stepItem}>
                <View style={[s.stepDot, i < step && s.stepDone, i === step && s.stepActive]}>
                  {i < step
                    ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : <Text style={[s.stepNum, i === step && { color: '#fff' }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, i === step && { color: COLORS.primary, fontWeight: '700' }]}>{label}</Text>
                {i < STEPS.length - 1 && (
                  <View style={[s.stepLine, i < step && s.stepLineDone]} />
                )}
              </View>
            ))}
          </View>

          {/* ── Form Kartı ── */}
          <View style={s.card}>

            {/* Adım 0 — Kişisel */}
            {step === 0 && (
              <View style={s.stepContent}>
                <View style={s.stepHeader}>
                  <View style={s.stepIconBox}>
                    <Ionicons name="person-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={s.stepTitle}>Adınız nedir?</Text>
                    <Text style={s.stepDesc}>Kimliğinizi doğrulayacağız</Text>
                  </View>
                </View>

                <Field label="Ad *" icon="person-outline" value={form.name} onChange={set('name')} placeholder="Adınız" autoCapitalize="words" />
                <Field label="Soyad *" icon="people-outline" value={form.surname} onChange={set('surname')} placeholder="Soyadınız" autoCapitalize="words" />
              </View>
            )}

            {/* Adım 1 — İletişim */}
            {step === 1 && (
              <View style={s.stepContent}>
                <View style={s.stepHeader}>
                  <View style={s.stepIconBox}>
                    <Ionicons name="mail-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={s.stepTitle}>İletişim bilgileri</Text>
                    <Text style={s.stepDesc}>E-posta ile hesabınıza erişin</Text>
                  </View>
                </View>

                <Field label="E-posta *" icon="mail-outline" value={form.email} onChange={set('email')} placeholder="ornek@email.com" keyboardType="email-address" autoCapitalize="none" />

                <TouchableOpacity
                  style={[s.otpBtn, otpSending && s.otpBtnDisabled]}
                  disabled={otpSending || !form.email.trim()}
                  onPress={async () => {
                    if (!form.email.trim()) return;
                    setOtpSending(true);
                    try {
                      const res = await sendOtp({
                        email: form.email.trim().toLowerCase(),
                        purpose: 'REGISTER',
                      });
                      setOtpSent(true);
                      set('verificationCode')('');
                      showAppSuccess(
                        'Kod gönderildi',
                        res.message ?? 'E-posta adresinize doğrulama kodu gönderildi. Gelen kutunuzu kontrol edin.',
                      );
                    } catch (err: any) {
                      showAppError('Kod gönderilemedi', err?.response?.data?.message ?? err.message);
                    } finally {
                      setOtpSending(false);
                    }
                  }}
                >
                  <Ionicons name="mail-unread-outline" size={18} color="#fff" />
                  <Text style={s.otpBtnTxt}>
                    {otpSending ? 'Gönderiliyor…' : otpSent ? 'Kodu Tekrar Gönder' : 'Doğrulama Kodu Gönder'}
                  </Text>
                </TouchableOpacity>

                <Field
                  label="E-posta doğrulama kodu (6 hane) *"
                  icon="keypad-outline"
                  value={form.verificationCode}
                  onChange={set('verificationCode')}
                  placeholder="123456"
                  keyboardType="number-pad"
                />
                <Field label="Telefon (isteğe bağlı)" icon="call-outline" value={form.phone} onChange={set('phone')} placeholder="+90 555 000 00 00" keyboardType="phone-pad" />
              </View>
            )}

            {/* Adım 2 — Güvenlik */}
            {step === 2 && (
              <View style={s.stepContent}>
                <View style={s.stepHeader}>
                  <View style={s.stepIconBox}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={s.stepTitle}>Şifre oluşturun</Text>
                    <Text style={s.stepDesc}>En az 8 karakter olmalıdır</Text>
                  </View>
                </View>

                {/* Şifre — özel render */}
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Şifre *</Text>
                  <View style={s.field}>
                    <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                    <TextInput
                      style={s.input}
                      value={form.password}
                      onChangeText={set('password')}
                      placeholder="Şifreniz"
                      placeholderTextColor="#cbd5e1"
                      secureTextEntry={!showPass}
                    />
                    <TouchableOpacity onPress={() => setShowPass((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Şifre Tekrar *</Text>
                  <View style={s.field}>
                    <Ionicons name="lock-open-outline" size={18} color="#94a3b8" />
                    <TextInput
                      style={s.input}
                      value={form.confirmPassword}
                      onChangeText={set('confirmPassword')}
                      placeholder="Şifrenizi tekrar girin"
                      placeholderTextColor="#cbd5e1"
                      secureTextEntry={!showPass}
                    />
                    {form.confirmPassword.length > 0 && (
                      <Ionicons
                        name={form.password === form.confirmPassword ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={form.password === form.confirmPassword ? '#16a34a' : '#dc2626'}
                      />
                    )}
                  </View>
                </View>

                {/* Şifre gücü göstergesi */}
                {form.password.length > 0 && (
                  <PasswordStrength password={form.password} />
                )}
              </View>
            )}

            {/* ── İleri / Kayıt Ol butonu ── */}
            <TouchableOpacity
              style={[s.primaryBtn, isLoading && s.disabled]}
              onPress={handleNext}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {step < 2 ? (
                <>
                  <Text style={s.primaryBtnTxt}>İleri</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              ) : isLoading ? (
                <Text style={s.primaryBtnTxt}>Kayıt Yapılıyor…</Text>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.primaryBtnTxt}>Hesap Oluştur</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Giriş yap linki */}
            <TouchableOpacity style={s.loginLink} onPress={() => router.push('/(auth)/login')}>
              <Text style={s.loginLinkTxt}>Zaten hesabın var mı? </Text>
              <Text style={[s.loginLinkTxt, { color: COLORS.primary, fontWeight: '700' }]}>Giriş Yap</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Yardımcı bileşenler ─────────────────────────────

function Field({ label, icon, value, onChange, placeholder, keyboardType, autoCapitalize, secureTextEntry }: {
  label: string; icon: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.field, focused && s.fieldFocused]}>
        <Ionicons name={icon as any} size={18} color={focused ? COLORS.primary : '#94a3b8'} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#cbd5e1"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const strength =
    password.length >= 10 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) ? 3
    : password.length >= 6 ? 2
    : 1;
  const labels = ['Zayıf (≥6 karakter gerekli)', 'Orta', 'Güçlü'];
  const colors = ['#dc2626', '#f59e0b', '#16a34a'];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
            n <= strength && { backgroundColor: colors[strength - 1] }]} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: colors[strength - 1], fontWeight: '600' }}>
        Şifre gücü: {labels[strength - 1]}
      </Text>
    </View>
  );
}

// ── Stiller ────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f0f6ff' },
  scroll: { flexGrow: 1 },

  // Üst bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    backgroundColor: COLORS.primary,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:   { fontSize: 17, fontWeight: '800', color: '#fff' },
  stepSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  // Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingBottom: 20,
    paddingHorizontal: 32,
    gap: 0,
  },
  stepItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot:     { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepActive:  { backgroundColor: '#fff' },
  stepDone:    { backgroundColor: '#22c55e' },
  stepNum:     { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  stepLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  stepLine:    { width: 28, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  stepLineDone:{ backgroundColor: '#22c55e' },

  // Kart
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    gap: 16,
    flex: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },

  // Step içeriği
  stepContent: { gap: 14 },
  stepHeader:  { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  stepIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  stepTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  stepDesc:  { fontSize: 13, color: '#64748b', marginTop: 2 },

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
  otpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  otpBtnDisabled: { opacity: 0.55 },
  otpBtnTxt: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  loginLink:    { flexDirection: 'row', justifyContent: 'center', paddingVertical: 8 },
  loginLinkTxt: { fontSize: 14, color: '#64748b' },
});
