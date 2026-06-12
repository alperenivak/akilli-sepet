// =====================================================
// Akıllı Sepet - Şifremi Unuttum (e-posta OTP)
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { sendOtp, resetPassword } from '../../src/api/auth';
import { showAppError, showAppSuccess } from '../../src/store/messageStore';
import { getApiErrorMessage, COLORS } from '../../src/utils/constants';

const inputCls = {
  field: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  fieldFocused: { borderColor: COLORS.primary, backgroundColor: '#eff6ff' },
  input: { flex: 1, fontSize: 14, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600' as const, color: '#374151', marginBottom: 6 },
};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email.trim()) {
      showAppError('Eksik bilgi', 'E-posta adresinizi girin.');
      return;
    }
    setOtpSending(true);
    try {
      const res = await sendOtp({ email: email.trim().toLowerCase(), purpose: 'PASSWORD_RESET' });
      setOtpSent(true);
      setCode('');
      showAppSuccess(
        'Kod gönderildi',
        res.message ?? 'E-posta adresinize 6 haneli doğrulama kodu gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.',
      );
    } catch (err) {
      showAppError('Kod gönderilemedi', getApiErrorMessage(err, 'Bir sorun oluştu.'));
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !/^\d{6}$/.test(code.trim())) {
      showAppError('Eksik bilgi', 'E-posta ve 6 haneli doğrulama kodunu girin.');
      return;
    }
    if (password.length < 6) {
      showAppError('Hata', 'Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirm) {
      showAppError('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword({
        email: email.trim().toLowerCase(),
        verificationCode: code.trim(),
        newPassword: password,
      });
      showAppSuccess('Şifre güncellendi', result.message);
      router.replace({ pathname: '/(auth)/login', params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      showAppError('Sıfırlama başarısız', getApiErrorMessage(err, 'Kod veya bilgiler hatalı.'));
    } finally {
      setLoading(false);
    }
  };

  const Field = ({
    id, label, value, onChange, placeholder, secure, keyboard,
  }: {
    id: string; label: string; value: string; onChange: (v: string) => void;
    placeholder: string; secure?: boolean; keyboard?: 'email-address' | 'phone-pad' | 'number-pad' | 'default';
  }) => (
    <View style={s.fieldGroup}>
      <Text style={inputCls.label}>{label}</Text>
      <View style={[inputCls.field, focused === id && inputCls.fieldFocused]}>
        <TextInput
          style={inputCls.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#cbd5e1"
          secureTextEntry={secure}
          keyboardType={keyboard}
          autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
          maxLength={keyboard === 'number-pad' ? 6 : undefined}
          onFocus={() => setFocused(id)}
          onBlur={() => setFocused(null)}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
            <Text style={s.backTxt}>Girişe dön</Text>
          </TouchableOpacity>

          <View style={s.hero}>
            <View style={s.iconBox}>
              <Ionicons name="key-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={s.title}>Şifremi Unuttum</Text>
            <Text style={s.sub}>
              E-posta adresinize gönderilen 6 haneli kod ile yeni şifre belirleyin.
            </Text>
          </View>

          <View style={s.card}>
            <Field
              id="email"
              label="E-posta *"
              value={email}
              onChange={setEmail}
              placeholder="kullanici@marketapp.com"
              keyboard="email-address"
            />

            <TouchableOpacity
              style={[s.otpBtn, otpSending && s.disabled]}
              onPress={handleSendCode}
              disabled={otpSending}
            >
              <Text style={s.otpBtnTxt}>
                {otpSending ? 'Gönderiliyor…' : otpSent ? 'Kodu Tekrar Gönder' : 'Sıfırlama Kodu Gönder'}
              </Text>
            </TouchableOpacity>

            <Field
              id="code"
              label="E-posta doğrulama kodu *"
              value={code}
              onChange={setCode}
              placeholder="6 haneli kod"
              keyboard="number-pad"
            />

            <Field
              id="pass"
              label="Yeni şifre *"
              value={password}
              onChange={setPassword}
              placeholder="En az 6 karakter"
              secure={!showPass}
            />
            <Field
              id="confirm"
              label="Yeni şifre tekrar *"
              value={confirm}
              onChange={setConfirm}
              placeholder="Şifreyi tekrar girin"
              secure={!showPass}
            />

            <TouchableOpacity
              style={[s.submitBtn, loading && s.disabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={s.submitTxt}>{loading ? 'Güncelleniyor…' : 'Şifremi Sıfırla'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f6ff' },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 32 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backTxt: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  hero: { alignItems: 'center', marginBottom: 20 },
  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 320 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },
  fieldGroup: { gap: 0 },
  otpBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary,
  },
  otpBtnTxt: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  disabled: { opacity: 0.6 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
