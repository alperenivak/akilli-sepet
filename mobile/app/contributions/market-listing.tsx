// =====================================================
// Markete Ürün Ekleme — kullanıcı katkısı
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
import { submitMarketListing } from '../../src/api/contributions';
import { showAppSuccess, showAppError } from '../../src/store/messageStore';
import { useAuthStore } from '../../src/store/authStore';
import { useMarkets } from '../../src/hooks/useMarkets';
import { useProduct } from '../../src/hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';

export default function MarketListingScreen() {
  const { productId, productName } = useLocalSearchParams<{
    productId: string;
    productName: string;
  }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const { data: productDetail } = useProduct(productId);
  const queryClient = useQueryClient();
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const listedMarketIds = new Set(
    (productDetail?.prices ?? []).filter((p) => p.isAvailable).map((p) => p.market?.id).filter(Boolean),
  );
  const activeMarkets = (markets ?? []).filter((m) => m.isActive && !listedMarketIds.has(m.id));

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      showAppError('Giriş gerekli', 'Ürün eklemek için giriş yapın');
      router.push('/(auth)/login');
      return;
    }
    if (!selectedMarketId) {
      showAppError('Market seçin', 'Lütfen bir market seçin');
      return;
    }
    const priceValue = parseFloat(priceText.replace(',', '.'));
    if (!priceText || isNaN(priceValue) || priceValue <= 0) {
      showAppError('Geçersiz fiyat', 'Market etiketindeki fiyatı girin (örn: 24.99)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitMarketListing({
        productId,
        marketId: selectedMarketId,
        amount: Math.round(priceValue * 100),
        note: note.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['my-reputation'] });
      queryClient.invalidateQueries({ queryKey: ['my-contributions'] });
      showAppSuccess('Talep gönderildi!', result.message ?? 'Onay sonrası ürün markette görünecek.');
      router.replace(`/product/${productId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showAppError('Gönderilemedi', msg ?? 'Talep kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Markete Ekle', headerBackTitle: 'Geri' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Ionicons name="storefront" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Ürünü Markete Ekle</Text>
            <Text style={styles.subtitle}>
              {productName ?? 'Bu ürün'} henüz hiçbir markette listelenmiyor.
              Gördüğün marketi ve fiyatı bildir — onaylandığında +0.40 itibar.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Market Seç</Text>
            {marketsLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : activeMarkets.length === 0 ? (
              <Text style={styles.emptyMarkets}>
                Bu ürün tüm aktif marketlerde zaten listeleniyor veya bekleyen talebin var.
              </Text>
            ) : (
              <View style={styles.marketGrid}>
                {activeMarkets.map((m) => {
                  const selected = selectedMarketId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.marketChip, selected && styles.marketChipActive]}
                      onPress={() => setSelectedMarketId(m.id)}
                    >
                      <Text style={[styles.marketChipText, selected && styles.marketChipTextActive]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Market Fiyatı (TL)</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="29.99"
              keyboardType="decimal-pad"
              value={priceText}
              onChangeText={setPriceText}
            />
            <Text style={styles.label}>Not (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Şube, raf konumu vb."
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
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.submitText}>Markete Ekleme Talebi Gönder</Text>
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
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  marketChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  marketChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  marketChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  marketChipTextActive: { color: COLORS.primary },
  priceInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, fontSize: 22, fontWeight: '700', color: COLORS.text,
  },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, minHeight: 72, textAlignVertical: 'top', fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, paddingVertical: 16, borderRadius: 12,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyMarkets: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
});
