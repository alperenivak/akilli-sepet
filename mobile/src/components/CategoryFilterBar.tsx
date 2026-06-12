// =====================================================
// İki katmanlı kategori filtresi — ana + alt kategori
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../types/api';
import { CATEGORY_ICONS } from '../utils/constants';
import { getCategoryProductCount } from '../utils/categories';

const PARENT_COLORS: Record<string, string> = {
  'Meyve & Sebze':  '#16a34a',
  'Süt Ürünleri':   '#ca8a04',
  'Et & Tavuk':     '#dc2626',
  'İçecekler':      '#2563eb',
  'Gıda':           '#d97706',
  'Temizlik':       '#7c3aed',
  'Kişisel Bakım':  '#db2777',
  'Dondurulmuş':    '#0284c7',
  'Atıştırmalık':   '#ea580c',
  default:          '#2563eb',
};

interface Props {
  tree: Category[];
  parentId: string;
  categoryId: string;
  onParentChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
}

function Chip({
  label,
  active,
  color,
  iconName,
  emoji,
  count,
  onPress,
  compact,
}: {
  label: string;
  active: boolean;
  color: string;
  iconName?: string;
  emoji?: string;
  count?: number;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        s.chip,
        compact && s.chipCompact,
        active && { backgroundColor: color, borderColor: color },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {emoji ? (
        <Text style={s.emoji}>{emoji}</Text>
      ) : iconName ? (
        <Ionicons name={iconName as any} size={compact ? 12 : 13} color={active ? '#fff' : color} />
      ) : null}
      <Text style={[s.chipTxt, compact && s.chipTxtCompact, active && s.chipTxtActive]} numberOfLines={1}>
        {label}
      </Text>
      {count != null && count > 0 && (
        <View style={[s.countBadge, active && s.countBadgeActive]}>
          <Text style={[s.countTxt, active && s.countTxtActive]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function CategoryFilterBar({
  tree, parentId, categoryId, onParentChange, onCategoryChange,
}: Props) {
  if (tree.length === 0) return null;

  const activeParent = tree.find((c) => c.id === parentId);
  const subcategories = activeParent?.children ?? [];
  const parentColor = PARENT_COLORS[activeParent?.name ?? ''] ?? PARENT_COLORS.default;

  return (
    <View style={s.wrap}>
      <Text style={s.sectionLabel}>ANA KATEGORİ</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        <Chip
          label="Tümü"
          active={!parentId}
          color="#64748b"
          iconName="apps-outline"
          onPress={() => { onParentChange(''); onCategoryChange(''); }}
        />
        {tree.map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            active={parentId === item.id}
            color={PARENT_COLORS[item.name] ?? PARENT_COLORS.default}
            iconName={(CATEGORY_ICONS[item.name] ?? CATEGORY_ICONS.default) as string}
            count={getCategoryProductCount(item)}
            onPress={() => { onParentChange(item.id); onCategoryChange(''); }}
          />
        ))}
      </ScrollView>

      {subcategories.length > 0 && (
        <View style={s.subSection}>
          <Text style={s.subLabel}>
            {activeParent?.icon} {activeParent?.name} › Alt kategori
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.subRow}
          >
            <Chip
              label="Tümü"
              active={!categoryId}
              color={parentColor}
              onPress={() => onCategoryChange('')}
              compact
            />
            {subcategories.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                active={categoryId === item.id}
                color={parentColor}
                emoji={item.icon}
                count={getCategoryProductCount(item)}
                onPress={() => onCategoryChange(item.id)}
                compact
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  row: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: 'center' },
  subSection: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    letterSpacing: 0.3,
  },
  subRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#334155', maxWidth: 120 },
  chipTxtCompact: { fontSize: 12 },
  chipTxtActive: { color: '#fff' },
  emoji: { fontSize: 13 },
  countBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countTxt: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  countTxtActive: { color: '#fff' },
});
