// =====================================================
// Senin İçin — baktığın ürünler ve satın alma niyeti
// =====================================================

import React, { useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard } from '../ProductCard';
import { useViewHistoryStore } from '../../store/viewHistoryStore';
import { useHomeRecommendations, RecommendedProduct } from '../../hooks/useHomeRecommendations';
import { Product } from '../../types/api';
import { COLORS } from '../../utils/constants';

function IntentProductCard({
  item,
  onAddToCart,
}: {
  item: RecommendedProduct;
  onAddToCart?: (p: Product) => void;
}) {
  return (
    <View style={s.cardWrap}>
      {item.badge && (
        <View style={[s.badge, { backgroundColor: item.badge.color }]}>
          <Text style={s.badgeTxt} numberOfLines={1}>{item.badge.label}</Text>
        </View>
      )}
      <ProductCard product={item.product} onAddToCart={onAddToCart} horizontal />
      {item.pitch && (
        <Text style={s.pitch} numberOfLines={2}>{item.pitch}</Text>
      )}
    </View>
  );
}

function ProductRow({
  title,
  subtitle,
  items,
  onAddToCart,
  loading,
}: {
  title: string;
  subtitle?: string;
  items: RecommendedProduct[];
  onAddToCart?: (p: Product) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View style={s.rowSection}>
        <Text style={s.rowTitle}>{title}</Text>
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
      </View>
    );
  }
  if (items.length === 0) return null;

  return (
    <View style={s.rowSection}>
      <View style={s.rowHeader}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowScroll}>
        {items.map((item) => (
          <IntentProductCard key={item.product.id} item={item} onAddToCart={onAddToCart} />
        ))}
      </ScrollView>
    </View>
  );
}

export function ForYouSection({ onAddToCart }: { onAddToCart?: (p: Product) => void }) {
  const hydrate = useViewHistoryStore((st) => st.hydrate);
  const hasRecords = useViewHistoryStore((st) => st.records.length > 0);
  const {
    hasHistory, hydrated, pitch, viewedProducts, relatedProducts, isLoading, refetch,
  } = useHomeRecommendations();

  useEffect(() => { void hydrate(); }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
      refetch();
    }, [hydrate, refetch]),
  );

  if (!hydrated) return null;

  if (!hasHistory) {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>👀</Text>
          <Text style={s.emptyTitle}>Sana Özel Öneriler</Text>
          <Text style={s.emptySub}>
            Ürün detaylarına baktıkça ilgilendiğin ürünler ve benzerleri burada listelenir.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>SANA ÖZEL</Text>
          <Text style={s.title}>Senin İçin Seçtiklerimiz</Text>
          <Text style={s.pitchMain}>{pitch}</Text>
        </View>
        {hasRecords && (
          <View style={s.sparkBadge}>
            <Ionicons name="sparkles" size={14} color="#7c3aed" />
          </View>
        )}
      </View>

      <ProductRow
        title="Baktığın Ürünler"
        subtitle="Tekrar bak, fiyatı karşılaştır, sepete ekle"
        items={viewedProducts}
        onAddToCart={onAddToCart}
        loading={isLoading && viewedProducts.length === 0}
      />

      <ProductRow
        title="Bunları Da Sevebilirsin"
        subtitle="İlgi alanına göre benzer ürünler"
        items={relatedProducts}
        onAddToCart={onAddToCart}
        loading={isLoading && relatedProducts.length === 0}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  pitchMain: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, lineHeight: 15 },
  sparkBadge: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#faf5ff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#ede9fe',
  },
  rowSection: { marginBottom: 14 },
  rowHeader: { paddingHorizontal: 16, marginBottom: 8 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  rowScroll: { paddingHorizontal: 16, gap: 10 },
  cardWrap: { width: 268 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: '100%',
  },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  pitch: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  emptyWrap: { paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  emptyCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ede9fe',
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  emptySub: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
});
