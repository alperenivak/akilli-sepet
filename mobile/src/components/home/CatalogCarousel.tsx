// =====================================================
// Akıllı Sepet - Aktüel Katalog Karuzeli — Premium Tasarım
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Catalog } from '../../types/api';
import { COLORS } from '../../utils/constants';

interface Props { catalogs: Catalog[] }

export function CatalogCarousel({ catalogs }: Props) {
  if (catalogs.length === 0) return null;

  const today = Date.now();
  const daysLeft = (endDate: string) => {
    const d = Math.ceil((new Date(endDate).getTime() - today) / 86400000);
    return d;
  };

  return (
    <View style={s.section}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Aktüel Kataloglar</Text>
          <Text style={s.sub}>Bu hafta geçerli fırsatlar</Text>
        </View>
        <TouchableOpacity style={s.moreBtn} onPress={() => router.push('/(tabs)/markets')}>
          <Text style={s.moreTxt}>Tümü</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={catalogs}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const days = daysLeft(item.endDate);
          const urgent = days <= 3;
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/catalogs/${item.id}`)}
              activeOpacity={0.85}
            >
              {/* Kapak */}
              {item.coverImageUrl ? (
                <Image source={{ uri: item.coverImageUrl }} style={s.img} resizeMode="cover" />
              ) : (
                <View style={[s.img, s.imgPlaceholder]}>
                  <Ionicons name="book-outline" size={36} color="#cbd5e1" />
                  <Text style={s.placeholderTxt}>{item.market?.name}</Text>
                </View>
              )}

              {/* Alt degrade bilgi */}
              <View style={s.overlay}>
                <Text style={s.cardMarket} numberOfLines={1}>{item.market?.name ?? 'Market'}</Text>
                <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
              </View>

              {/* Tarih rozeti */}
              <View style={[s.dateBadge, urgent && s.dateBadgeUrgent]}>
                <Text style={[s.dateTxt, urgent && s.dateTxtUrgent]}>
                  {days < 0 ? 'Bitti' : days === 0 ? 'Son gün!' : `${days} gün`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const CARD_W = 165;
const IMG_H  = 130;

const s = StyleSheet.create({
  section: { marginBottom: 4 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  title:   { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  moreBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.primaryLight, borderRadius: 20, marginTop: 2 },
  moreTxt: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  list:    { paddingLeft: 16, paddingRight: 8 },

  card: {
    width: CARD_W,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f8fafc',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  img:            { width: CARD_W, height: IMG_H },
  imgPlaceholder: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderTxt: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  overlay: {
    padding: 10,
    backgroundColor: '#fff',
  },
  cardMarket: { fontSize: 10, color: COLORS.primary, fontWeight: '700', marginBottom: 2 },
  cardTitle:  { fontSize: 12, color: '#1e293b', fontWeight: '600', lineHeight: 16 },

  dateBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  dateBadgeUrgent: { backgroundColor: '#fef2f2' },
  dateTxt:        { fontSize: 10, fontWeight: '700', color: '#374151' },
  dateTxtUrgent:  { color: '#dc2626' },
});
