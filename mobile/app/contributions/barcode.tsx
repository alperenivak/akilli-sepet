// =====================================================
// Barkod Katkısı — tarama sonrası onay ekranı
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/utils/constants';
import { submitBarcodeContribution } from '../../src/api/contributions';
import { showAppSuccess, showAppError } from '../../src/store/messageStore';
import { useAuthStore } from '../../src/store/authStore';
import { useQueryClient } from '@tanstack/react-query';

export default function BarcodeContributionScreen() {
  const { productId, productName, barcode } = useLocalSearchParams<{
    productId: string;
    productName: string;
    barcode: string;
  }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      showAppError('Giriş gerekli', 'Barkod eklemek için giriş yapın');
      router.push('/(auth)/login');
      return;
    }
    if (!productId || !barcode) return;

    setSubmitting(true);
    try {
      const result = await submitBarcodeContribution({
        productId,
        code: barcode,
        note: note.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['my-reputation'] });
      queryClient.invalidateQueries({ queryKey: ['my-contributions'] });
      showAppSuccess('Katki gönderildi!', result.message ?? 'İnceleme sonrası itibar kazanacaksın.');
      router.replace(`/product/${productId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showAppError('Gönderilemedi', msg ?? 'Barkod katkısı kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Barkod Ekle', headerBackTitle: 'Geri' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons name="barcode" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Barkod Katkısı</Text>
            <Text style={styles.subtitle}>
              {productName ?? 'Ürün'} için taranan barkodu sisteme öneriyorsun.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Taranan Barkod</Text>
            <Text style={styles.barcode}>{barcode}</Text>
            <Text style={styles.hint}>
              Onaylandığında +0.35 itibar kazanırsın (fiyat doğrulamadan 7× daha fazla).
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Not (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Migros Kadıköy raf etiketi"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitText}>Katkiyi Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  barcode: { fontSize: 22, fontWeight: '800', fontFamily: 'monospace', color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
