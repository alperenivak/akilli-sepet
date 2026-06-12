// =====================================================
// Akıllı Sepet - Otomatik Kayan Ana Sayfa Banneri
// Promosyon + topluluk özellikleri (itibar, kupon, fiyat bildir)
// =====================================================

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getMyReputation } from '../../api/users';
import { getMyRewards } from '../../api/rewards';

const { width } = Dimensions.get('window');
const SLIDE_H = 188;
const AUTO_MS = 3800;

interface Slide {
  id: string;
  bg: string;
  accent: string;
  icon: string;
  badge: string;
  title: string;
  sub: string;
  cta: string;
  route: string;
  params?: Record<string, string>;
  deco: string;
  guestOnly?: boolean;
}

function buildSlides(
  isAuth: boolean,
  rep?: { levelIcon: string; level: string; score: number; progressPercent: number; nextLevel: string | null } | null,
  rewards?: { stats: { claimable: number; claimed: number } } | null,
): Slide[] {
  const reputationSub = isAuth && rep
    ? `${rep.levelIcon} ${rep.level} · ${rep.score.toFixed(2)}/5${rep.nextLevel ? ` — ${rep.nextLevel} için %${rep.progressPercent}` : ''}`
    : 'Fiyat doğrula ve bildir; katkın değer kazansın.';

  const couponSub = isAuth && rewards
    ? rewards.stats.claimable > 0
      ? `${rewards.stats.claimable} kupon almaya hazır! Partner marketlerde indirim kazan.`
      : rewards.stats.claimed > 0
        ? `${rewards.stats.claimed} kuponun mevcut. Kuponlarım ekranından görüntüle.`
        : 'İtibarını artır, partner market kuponlarını aç.'
    : 'Üye ol, itibar kazan ve market indirim kuponları al.';

  const all: Slide[] = [
    {
      id: 's1', bg: '#1e3a8a', accent: '#60a5fa', icon: 'pricetag',
      badge: '📊 Canlı Fiyat',
      title: 'Tüm Marketleri\nKarşılaştır',
      sub: 'Hangi market daha ucuz? Barkod tara, fiyatları anında gör.',
      cta: 'Aramaya Başla', route: '/(tabs)/search', deco: '🏷️',
    },
    {
      id: 'reputation', bg: '#312e81', accent: '#a5b4fc', icon: 'ribbon-outline',
      badge: '⭐ Topluluk İtibarı',
      title: 'Katkın\nDeğer Kazansın',
      sub: reputationSub,
      cta: isAuth ? 'İtibarımı Gör' : 'Üye Ol',
      route: isAuth ? '/(tabs)/profile' : '/(auth)/register',
      deco: '🏅',
    },
    {
      id: 'coupons', bg: '#581c87', accent: '#d8b4fe', icon: 'gift-outline',
      badge: '🎁 Market Kuponları',
      title: 'İtibar =\nGerçek İndirim',
      sub: couponSub,
      cta: isAuth ? 'Kuponlarım' : 'Keşfet',
      route: isAuth ? '/coupons' : '/(auth)/register',
      deco: '🎫',
    },
    {
      id: 'submit', bg: '#134e4a', accent: '#5eead4', icon: 'megaphone-outline',
      badge: '📢 Fiyat Bildir',
      title: 'Eksik Fiyatı\nPaylaş',
      sub: 'Gördüğün fiyatı bildir; güvenilir kaynakların bildirimi hızlı onaylanır.',
      cta: isAuth ? 'Fiyat Bildir' : 'Giriş Yap',
      route: isAuth ? '/(tabs)/search' : '/(auth)/login',
      params: isAuth ? { intent: 'submit' } : undefined,
      deco: '📣',
    },
    {
      id: 'verify', bg: '#1e3a5f', accent: '#7dd3fc', icon: 'checkmark-done-outline',
      badge: '✓ Fiyat Doğrula',
      title: 'Doğru mu?\nOyla, İtibar Kazan',
      sub: 'Ürün fiyatlarını doğrula veya yanlış işaretle; veri kalitesi artar.',
      cta: isAuth ? 'Fiyat Doğrula' : 'Giriş Yap',
      route: isAuth ? '/(tabs)/search' : '/(auth)/login',
      params: isAuth ? { intent: 'verify' } : undefined,
      deco: '✅',
    },
    {
      id: 's2', bg: '#7c2d12', accent: '#fb923c', icon: 'warning',
      badge: '⚠️ SKT Uyarısı',
      title: 'Tarihi Geçmiş Ürün\nGördünüz mü?',
      sub: 'Bildirin, diğer kullanıcıları koruyun ve güvenli alışveriş sağlayın.',
      cta: 'Şimdi Bildir', route: '/reports/create', deco: '🛡️',
    },
    {
      id: 's3', bg: '#4c1d95', accent: '#a78bfa', icon: 'sparkles',
      badge: '🤖 Yapay Zeka',
      title: 'AI Alışveriş\nAsistanı',
      sub: 'Bütçene göre en uygun ürünleri öneren akıllı asistanını dene.',
      cta: 'Asistanı Aç', route: '/ai/chat', deco: '✨',
    },
    {
      id: 's4', bg: '#064e3b', accent: '#34d399', icon: 'person-add',
      badge: '🎁 Ücretsiz',
      title: 'Üye Olun,\nFırsatları Kaçırmayın',
      sub: 'Kişiselleştirilmiş öneriler, sepet takibi ve daha fazlası.',
      cta: 'Kayıt Ol', route: '/(auth)/register', deco: '🎉',
      guestOnly: true,
    },
  ];

  return all.filter((s) => !s.guestOnly || !isAuth);
}

export function HeroBanner() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const flatRef = useRef<FlatList>(null);
  const curIdx = useRef(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const { data: rep } = useQuery({
    queryKey: ['my-reputation'],
    queryFn: getMyReputation,
    enabled: isAuthenticated,
    staleTime: 90_000,
  });

  const { data: rewards } = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    enabled: isAuthenticated,
    staleTime: 90_000,
  });

  const slides = useMemo(
    () => buildSlides(isAuthenticated, rep, rewards),
    [isAuthenticated, rep, rewards],
  );

  const goTo = useCallback((idx: number) => {
    const safe = ((idx % slides.length) + slides.length) % slides.length;
    flatRef.current?.scrollToIndex({ index: safe, animated: true });
    setActiveIdx(safe);
    curIdx.current = safe;
  }, [slides.length]);

  useEffect(() => {
    curIdx.current = 0;
    setActiveIdx(0);
    flatRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      goTo((curIdx.current + 1) % slides.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [slides.length, goTo]);

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatRef}
        data={slides}
        horizontal
        pagingEnabled
        keyExtractor={(s) => s.id}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          const safe = Math.min(idx, slides.length - 1);
          setActiveIdx(safe);
          curIdx.current = safe;
        }}
        renderItem={({ item }) => <SlideCard slide={item} />}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <View style={[
              styles.dot,
              { backgroundColor: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                width: i === activeIdx ? 20 : 7 },
            ]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SlideCard({ slide }: { slide: Slide }) {
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, [slide.id]);

  const onPress = () => {
    if (slide.params) {
      router.push({ pathname: slide.route as any, params: slide.params });
    } else {
      router.push(slide.route as any);
    }
  };

  return (
    <View style={[styles.slide, { backgroundColor: slide.bg }]}>
      <Text style={styles.deco}>{slide.deco}</Text>
      <View style={[styles.circle, { borderColor: slide.accent }]} />
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <View style={[styles.badge, { backgroundColor: slide.accent + '28', borderColor: slide.accent + '55' }]}>
          <Text style={[styles.badgeTxt, { color: slide.accent }]}>{slide.badge}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.sub}>{slide.sub}</Text>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: slide.accent }]}
          onPress={onPress}
          activeOpacity={0.82}
        >
          <Ionicons name={slide.icon as any} size={13} color="#000" style={{ marginRight: 5 }} />
          <Text style={styles.ctaTxt}>{slide.cta}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  slide: { width, height: SLIDE_H, overflow: 'hidden', justifyContent: 'center' },
  circle: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    borderWidth: 36, right: -70, top: -55, borderColor: 'rgba(255,255,255,0.06)',
  },
  deco: { position: 'absolute', right: 18, top: 16, fontSize: 50, opacity: 0.18 },
  content: { paddingHorizontal: 22, paddingVertical: 16 },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, marginBottom: 9,
  },
  badgeTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 21, fontWeight: '800', color: '#fff', lineHeight: 27, marginBottom: 5 },
  sub: { fontSize: 11.5, color: 'rgba(255,255,255,0.70)', lineHeight: 16, marginBottom: 13, maxWidth: '78%' },
  cta: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 15, paddingVertical: 8, borderRadius: 22,
  },
  ctaTxt: { fontSize: 12, fontWeight: '800', color: '#000' },
  dots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, position: 'absolute', bottom: 10, left: 0, right: 0,
  },
  dot: { height: 7, borderRadius: 3.5 },
});
