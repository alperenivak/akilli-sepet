// =====================================================
// Akıllı Sepet - Market Listesi — Premium Tasarım
// =====================================================
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Market } from '../../types/api';
import { COLORS, DEFAULT_MARKET_COLORS } from '../../utils/constants';

interface Props { markets: Market[] }

export function MarketChipList({ markets }: Props) {
  if (markets.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Marketler</Text>
          <Text style={s.sub}>Fiyat karşılaştır, tasarruf et</Text>
        </View>
        <TouchableOpacity style={s.moreBtn} onPress={() => router.push('/(tabs)/markets')}>
          <Text style={s.moreTxt}>Tümü</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={markets}
        keyExtractor={(m) => m.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderItem={({ item, index }) => {
          const color = item.brandColor ?? DEFAULT_MARKET_COLORS[index % DEFAULT_MARKET_COLORS.length];
          return (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/market/${item.id}`)} activeOpacity={0.82}>
              {/* Logo */}
              <View style={[s.logoWrap, { borderColor: color + '40' }]}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={s.logo} resizeMode="contain" />
                ) : (
                  <View style={[s.logoFallback, { backgroundColor: color }]}>
                    <Text style={s.logoLetter}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                {/* Aktif nokta */}
                <View style={[s.dot, { backgroundColor: color }]} />
              </View>
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 4 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  title:   { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  sub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  moreBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.primaryLight, borderRadius: 20, marginTop: 2 },
  moreTxt: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  list:    { paddingLeft: 16, paddingRight: 8 },

  card: { alignItems: 'center', marginRight: 16, width: 68 },

  logoWrap: {
    width: 58, height: 58, borderRadius: 18, borderWidth: 1.5,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6, overflow: 'visible',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  logo:        { width: 46, height: 46, borderRadius: 12 },
  logoFallback:{ width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logoLetter:  { fontSize: 18, fontWeight: '800', color: '#fff' },

  dot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  name: { fontSize: 10, fontWeight: '600', color: '#374151', textAlign: 'center' },
});
