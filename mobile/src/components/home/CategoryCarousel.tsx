// =====================================================
// Akıllı Sepet - Kategori Karuzeli — Premium Tasarım
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../../types/api';
import { COLORS, CATEGORY_ICONS } from '../../utils/constants';
import { getCategoryProductCount } from '../../utils/categories';

// Her kategoriye özgü renk tonu
const CAT_COLORS: Record<string, { bg: string; icon: string }> = {
  'Meyve & Sebze': { bg: '#dcfce7', icon: '#16a34a' },
  'Sut Urunleri':  { bg: '#fef9c3', icon: '#ca8a04' },
  'Et & Tavuk':    { bg: '#fee2e2', icon: '#dc2626' },
  'Icecekler':     { bg: '#dbeafe', icon: '#2563eb' },
  'Unlu Mamuller': { bg: '#fef3c7', icon: '#d97706' },
  'Temizlik':      { bg: '#ede9fe', icon: '#7c3aed' },
  'Kisisel Bakim': { bg: '#fce7f3', icon: '#db2777' },
  'Dondurulmus':   { bg: '#e0f2fe', icon: '#0284c7' },
  'Atistirmalik':  { bg: '#ffedd5', icon: '#ea580c' },
  'Konserve':      { bg: '#f1f5f9', icon: '#475569' },
  default:         { bg: '#eff6ff', icon: '#2563eb' },
};

interface Props { categories: Category[] }

export function CategoryCarousel({ categories }: Props) {
  if (categories.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title}>Kategoriler</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
          <Text style={s.more}>Tümü →</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const theme = CAT_COLORS[item.name] ?? CAT_COLORS.default;
          const count = getCategoryProductCount(item);
          const subCount = item.children?.length ?? 0;
          return (
            <TouchableOpacity
              style={s.chip}
              onPress={() => router.push({
                pathname: '/(tabs)/search',
                params: { categoryId: item.id, categoryName: item.name },
              })}
              activeOpacity={0.75}
            >
              <View style={[s.iconCircle, { backgroundColor: theme.bg }]}>
                <Ionicons name={(CATEGORY_ICONS[item.name] ?? CATEGORY_ICONS.default) as any} size={22} color={theme.icon} />
              </View>
              <Text style={s.chipLabel} numberOfLines={2}>{item.name}</Text>
              {subCount > 0 && (
                <Text style={s.subHint}>{subCount} alt · {count} ürün</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  title:  { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  more:   { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  list:   { paddingLeft: 16, paddingRight: 8 },
  chip:   { alignItems: 'center', marginRight: 12, width: 72 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  chipLabel:  { fontSize: 10, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 13 },
  subHint:    { fontSize: 8, color: '#94a3b8', textAlign: 'center', marginTop: 2 },
});
