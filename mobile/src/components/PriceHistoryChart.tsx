// =====================================================
// Basit fiyat geçmişi grafiği (ek kütüphane yok)
// =====================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PriceHistory } from '../types/api';
import { COLORS } from '../utils/constants';

interface Props {
  history: PriceHistory[];
  marketName?: string;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export function PriceHistoryChart({ history, marketName }: Props) {
  const points = [...history]
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-12);

  if (points.length < 2) {
    return (
      <Text style={styles.empty}>Grafik için yeterli geçmiş veri yok</Text>
    );
  }

  const amounts = points.map((p) => p.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const chartHeight = 80;

  return (
    <View>
      {marketName && (
        <Text style={styles.subtitle}>{marketName} — son {points.length} kayıt</Text>
      )}
      <View style={styles.chartRow}>
        {points.map((p, i) => {
          const h = ((p.amount - min) / range) * chartHeight + 8;
          const isLast = i === points.length - 1;
          return (
            <View key={p.id ?? i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: h },
                  isLast && styles.barActive,
                ]}
              />
              <Text style={styles.barLabel}>{formatShortDate(p.recordedAt)}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          Min: ₺{(min / 100).toFixed(2)} · Max: ₺{(max / 100).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: COLORS.textMuted },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center' },
  bar: {
    width: '80%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 4,
    minHeight: 4,
  },
  barActive: { backgroundColor: COLORS.primary },
  barLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 4 },
  legend: { marginTop: 8 },
  legendText: { fontSize: 11, color: COLORS.textMuted },
});
