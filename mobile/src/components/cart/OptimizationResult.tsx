// =====================================================
// Akıllı Sepet - Sepet Optimizasyon Sonuclari
// Secilen marketler + tek market alternatifi + tasarruf onerileri
// =====================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CartOptimizationResult,
  MarketCartGroup,
  MarketCartResult,
  CartItemSuggestion,
} from '../../types/api';
import { COLORS, formatPrice } from '../../utils/constants';

interface Props {
  result: CartOptimizationResult | null;
}

export function OptimizationResult({ result }: Props) {
  if (!result) return null;

  const { chosenTotalCost, marketGroups, singleMarketOptions, potentialSavings, itemSuggestions } = result;
  const bestSingle = singleMarketOptions[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sepet Analizi</Text>

      {/* Secilen marketlere gore ozet */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Seçtiğiniz marketlerde toplam</Text>
        <Text style={styles.summaryValue}>{formatPrice(chosenTotalCost)}</Text>
        {marketGroups.map((group) => (
          <MarketGroupRow key={group.marketId} group={group} />
        ))}
      </View>

      {/* Tek market alternatifi */}
      {bestSingle && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tek markette alışveriş</Text>
          <Text style={styles.sectionHint}>
            Tüm ürünleri tek marketten alsanız ne olurdu?
          </Text>
          {singleMarketOptions.slice(0, 4).map((option, index) => (
            <SingleMarketCard key={option.marketId} result={option} isBest={index === 0} />
          ))}
          {potentialSavings > 0 && bestSingle && (
            <View style={styles.savingsTip}>
              <Ionicons name="bulb" size={16} color={COLORS.secondary} />
              <Text style={styles.savingsTipText}>
                {bestSingle.marketName} marketinden alsanız{' '}
                <Text style={styles.savingsHighlight}>{formatPrice(potentialSavings)}</Text>
                {' '}tasarruf edebilirsiniz
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Urun bazli oneriler */}
      {itemSuggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ürün bazlı tasarruf fırsatları</Text>
          {itemSuggestions.slice(0, 5).map((s) => (
            <SuggestionRow key={s.itemId} suggestion={s} />
          ))}
        </View>
      )}
    </View>
  );
}

function MarketGroupRow({ group }: { group: MarketCartGroup }) {
  const color = group.marketBrandColor ?? COLORS.primary;
  return (
    <View style={styles.groupRow}>
      <View style={[styles.groupDot, { backgroundColor: color }]} />
      <Text style={styles.groupName}>{group.marketName}</Text>
      <Text style={styles.groupMeta}>{group.itemCount} ürün</Text>
      <Text style={styles.groupTotal}>{formatPrice(group.subtotal)}</Text>
    </View>
  );
}

function SingleMarketCard({ result, isBest }: { result: MarketCartResult; isBest: boolean }) {
  const coveragePct = Math.round(result.coverageRate * 100);
  return (
    <View style={[styles.card, isBest && styles.cardBest]}>
      <View style={styles.cardHeader}>
        {isBest && result.coverageRate === 1 && (
          <View style={styles.bestBadge}>
            <Ionicons name="trophy" size={10} color={COLORS.white} />
            <Text style={styles.bestBadgeText}>Önerilen</Text>
          </View>
        )}
        <Text style={styles.marketName}>{result.marketName}</Text>
      </View>
      <View style={styles.stats}>
        <StatItem label="Toplam" value={formatPrice(result.totalCost)} highlight={isBest} />
        <StatItem label="Kapsama" value={`%${coveragePct} (${result.foundItems}/${result.totalItems})`} />
      </View>
      {result.missingProducts.length > 0 && (
        <Text style={styles.missing}>
          Eksik: {result.missingProducts.slice(0, 3).join(', ')}
          {result.missingProducts.length > 3 ? '...' : ''}
        </Text>
      )}
    </View>
  );
}

function SuggestionRow({ suggestion }: { suggestion: CartItemSuggestion }) {
  return (
    <View style={styles.suggestionRow}>
      <Text style={styles.suggestionProduct} numberOfLines={1}>{suggestion.productName}</Text>
      <Text style={styles.suggestionDetail}>
        {suggestion.currentMarketName} → {suggestion.suggestedMarketName}
      </Text>
      <Text style={styles.suggestionSave}>
        {formatPrice(suggestion.savings)} tasarruf
      </Text>
    </View>
  );
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: COLORS.secondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  summaryCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted },
  summaryValue: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginVertical: 6 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupName: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  groupMeta: { fontSize: 11, color: COLORS.textMuted },
  groupTotal: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  card: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  cardBest: { borderColor: COLORS.secondary, backgroundColor: '#F0FDF4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  bestBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  marketName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  stats: { flexDirection: 'row', gap: 16 },
  statItem: { flex: 1 },
  statLabel: { fontSize: 11, color: COLORS.textMuted },
  statValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  missing: { fontSize: 11, color: COLORS.textMuted, marginTop: 6, fontStyle: 'italic' },
  savingsTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  savingsTipText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  savingsHighlight: { fontWeight: '800', color: COLORS.secondary },
  suggestionRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionProduct: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  suggestionDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  suggestionSave: { fontSize: 12, fontWeight: '700', color: COLORS.secondary, marginTop: 4 },
});
