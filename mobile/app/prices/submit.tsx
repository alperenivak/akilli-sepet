// =====================================================
// Akıllı Sepet - Crowdsource Fiyat Bildir Ekranı
// Kullanici herhangi bir marketteki urun fiyatini bildirebilir
// =====================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, formatPrice } from '../../src/utils/constants';
import { showAppSuccess, showAppError } from '../../src/store/messageStore';
import { useQueryClient } from '@tanstack/react-query';
import { submitCrowdsourcePrice } from '../../src/api/prices';
import { useMarkets } from '../../src/hooks/useMarkets';

export default function SubmitPriceScreen() {
  const queryClient = useQueryClient();
  const { productId, productName, marketId: presetMarketId } = useLocalSearchParams<{
    productId: string;
    productName: string;
    marketId?: string;
    marketName?: string;
  }>();

  const { data: markets, isLoading: marketsLoading } = useMarkets();

  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(presetMarketId ?? null);

  useEffect(() => {
    if (presetMarketId) setSelectedMarketId(presetMarketId);
  }, [presetMarketId]);
  const [priceText, setPriceText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nonMigrosMarkets = (markets ?? []).filter(
    (m) => m.isActive && m.slug !== 'migros',
  );

  const handleSubmit = async () => {
    if (!selectedMarketId) {
      showAppError('Market seçin', 'Lütfen bir market seçin');
      return;
    }

    const priceValue = parseFloat(priceText.replace(',', '.'));
    if (!priceText || isNaN(priceValue) || priceValue <= 0) {
      showAppError('Geçersiz fiyat', 'Lütfen geçerli bir fiyat girin (örnek: 24.99)');
      return;
    }

    const amountInKurus = Math.round(priceValue * 100);
    setSubmitting(true);

    try {
      const result = await submitCrowdsourcePrice({
        productId,
        marketId: selectedMarketId,
        amount: amountInKurus,
        note: note.trim() || undefined,
      });

      const rep = result?.reputation as { points?: number; level?: string } | undefined;
      queryClient.invalidateQueries({ queryKey: ['my-reputation'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });

      const outcome = result?.outcome as string | undefined;
      const title = outcome?.includes('AUTO_APPROVED')
        ? 'Fiyat onaylandı!'
        : outcome === 'PROVISIONAL'
          ? 'Geçici yansıtıldı'
          : outcome === 'ADMIN_REVIEW'
            ? 'İncelemeye alındı'
            : 'Teşekkürler!';

      showAppSuccess(title, result?.message ?? 'Bildiriminiz alındı.');
      router.back();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      showAppError('Hata', msg ?? 'Bildirim gönderilemedi. Tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMarket = nonMigrosMarkets.find((m) => m.id === selectedMarketId);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: 'Fiyat Bildir', headerBackTitle: 'Geri' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Ürün Bilgisi */}
          <View style={styles.productCard}>
            <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
            <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
          </View>

          {/* Bilgi Notu */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Markette gördüğünüz gerçek fiyatı bildirin. Sistem otomatik işler:
              {'\n'}• Güvenilir kullanıcılar → anında onay
              {'\n'}• Benzer bildirimler → topluluk konsensusu
              {'\n'}• Diğerleri → geçici yansıtma + doğrulama
            </Text>
          </View>

          {/* Market Seçimi */}
          <Text style={styles.label}>Market *</Text>
          {marketsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.marketGrid}>
              {nonMigrosMarkets.map((market) => (
                <TouchableOpacity
                  key={market.id}
                  style={[
                    styles.marketChip,
                    selectedMarketId === market.id && styles.marketChipSelected,
                    { borderColor: market.brandColor ?? COLORS.border },
                  ]}
                  onPress={() => setSelectedMarketId(market.id)}
                  accessibilityLabel={market.name}
                  accessibilityState={{ selected: selectedMarketId === market.id }}
                >
                  <View
                    style={[styles.marketDot, { backgroundColor: market.brandColor ?? COLORS.primary }]}
                  />
                  <Text style={[
                    styles.marketChipText,
                    selectedMarketId === market.id && styles.marketChipTextSelected,
                  ]}>
                    {market.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fiyat Girişi */}
          <Text style={styles.label}>Fiyat (TL) *</Text>
          <View style={styles.priceInputRow}>
            <Text style={styles.currencySymbol}>₺</Text>
            <TextInput
              style={styles.priceInput}
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="next"
              accessibilityLabel="Fiyat girin"
            />
          </View>
          {priceText && !isNaN(parseFloat(priceText.replace(',', '.'))) && (
            <Text style={styles.pricePreview}>
              = {formatPrice(Math.round(parseFloat(priceText.replace(',', '.')) * 100))}
            </Text>
          )}

          {/* Opsiyonel Not */}
          <Text style={styles.label}>Not (opsiyonel)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Şube adı, tarih, kampanya vb..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
            maxLength={300}
            accessibilityLabel="Opsiyonel not girin"
          />
          <Text style={styles.charCount}>{note.length}/300</Text>

          {/* Gönder Butonu */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selectedMarketId || !priceText || submitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedMarketId || !priceText || submitting}
            accessibilityLabel="Fiyat bildir"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={COLORS.white} />
                <Text style={styles.submitBtnText}>
                  {selectedMarket
                    ? `${selectedMarket.name} için Bildir`
                    : 'Bildir'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Gizlilik Notu */}
          <Text style={styles.privacyNote}>
            Bildiriminiz topluluğun doğrulamasına sunulacak. Tekrarlayan yanlış bildirimler kullanıcı
            itibar puanınızı düşürebilir.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 16, paddingBottom: 40 },

  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },

  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },

  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  marketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: COLORS.white,
  },
  marketChipSelected: { backgroundColor: COLORS.primaryLight },
  marketDot: { width: 8, height: 8, borderRadius: 4 },
  marketChipText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  marketChipTextSelected: { color: COLORS.primary, fontWeight: '700' },

  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  currencySymbol: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginRight: 4 },
  priceInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 14,
  },
  pricePreview: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16, marginLeft: 4 },

  noteInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginBottom: 20 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  privacyNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
