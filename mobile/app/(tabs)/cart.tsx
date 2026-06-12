// =====================================================
// Akıllı Sepet - Sepet Ekrani
// Market bazli gruplama + akilli optimizasyon
// =====================================================

import React, { useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../src/store/cartStore';
import { useAuthStore } from '../../src/store/authStore';
import { CartItem, CartOptimizationResult } from '../../src/types/api';
import { COLORS, formatPrice } from '../../src/utils/constants';
import { CartItemRow } from '../../src/components/cart/CartItemRow';
import { OptimizationResult } from '../../src/components/cart/OptimizationResult';

interface CartSection {
  title: string;
  marketId: string;
  brandColor?: string | null;
  subtotal: number;
  data: CartItem[];
}

export default function CartScreen() {
  const { cart, optimize, updateItem, removeItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [optimization, setOptimization] = useState<CartOptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const items = cart?.items ?? [];
  const totalItems = cart?.totalItems ?? 0;
  const totalCost = cart?.totalCost ?? 0;

  const sections = useMemo<CartSection[]>(() => {
    const groups = new Map<string, CartSection>();
    for (const item of items) {
      const key = item.market.id;
      const existing = groups.get(key);
      const lineTotal = (item.unitPrice ?? 0) * item.quantity;
      if (existing) {
        existing.data.push(item);
        existing.subtotal += lineTotal;
      } else {
        groups.set(key, {
          title: item.market.name,
          marketId: item.market.id,
          brandColor: item.market.brandColor,
          subtotal: lineTotal,
          data: [item],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.subtotal - a.subtotal);
  }, [items]);

  const handleOptimize = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Giriş Gerekli',
        'Sepet analizi için giriş yapmanız gerekiyor.',
        [
          { text: 'Vazgeç' },
          { text: 'Giriş Yap', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }

    setOptimizing(true);
    try {
      const result = await optimize();
      setOptimization(result);
    } catch {
      Alert.alert('Hata', 'Sepet analizi hesaplanırken bir sorun oluştu');
    } finally {
      setOptimizing(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty === 0) {
      await removeItem(itemId);
    } else {
      await updateItem(itemId, newQty);
    }
    setOptimization(null);
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Sepetiniz Boş</Text>
          <Text style={styles.emptySubtitle}>
            Ürün eklerken market seçerek sepetinizi düzenli tutun
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push('/(tabs)/search')}
            accessibilityLabel="Alışverişe başla"
            accessibilityRole="button"
          >
            <Text style={styles.shopButtonText}>Alışverişe Başla</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Sepetim</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalItems} ürün</Text>
              </View>
            </View>
            <Text style={styles.headerHint}>
              Ürünler seçtiğiniz marketlere göre gruplandı
            </Text>
            {totalCost > 0 && (
              <View style={styles.totalBar}>
                <Text style={styles.totalLabel}>Tahmini Toplam</Text>
                <Text style={styles.totalValue}>{formatPrice(totalCost)}</Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: section.brandColor ?? COLORS.primary }]} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtotal}>{formatPrice(section.subtotal)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <CartItemRow item={item} onUpdateQuantity={handleUpdateQuantity} />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.optimizeButton, optimizing && styles.optimizeButtonDisabled]}
              onPress={handleOptimize}
              disabled={optimizing}
              accessibilityLabel="Sepet analizi yap"
              accessibilityRole="button"
            >
              {optimizing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="analytics" size={18} color={COLORS.white} />
                  <Text style={styles.optimizeButtonText}>Sepet Analizi Yap</Text>
                </>
              )}
            </TouchableOpacity>
            <OptimizationResult result={optimization} />
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  shopButton: {
    marginTop: 8, backgroundColor: COLORS.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  shopButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  header: { padding: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  countBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  headerHint: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
  },
  totalLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text },
  sectionSubtotal: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  listContent: { paddingBottom: 30 },
  footer: { padding: 16 },
  optimizeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  optimizeButtonDisabled: { opacity: 0.6 },
  optimizeButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
