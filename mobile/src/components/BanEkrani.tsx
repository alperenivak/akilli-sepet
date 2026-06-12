// =====================================================
// Akıllı Sepet - Ban Ekranı
// Kullanıcı ban aldığında gösterilen tam ekran
// =====================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BanInfo } from '../utils/ban';

interface BanEkraniProps {
  banInfo: BanInfo;
  onLogout: () => void;
  onBanExpired?: () => void;
}

function useBanCountdown(bannedUntilIso: string | null, isPermanent: boolean) {
  const [msLeft, setMsLeft] = useState(() => {
    if (isPermanent || !bannedUntilIso) return 0;
    return Math.max(0, new Date(bannedUntilIso).getTime() - Date.now());
  });

  useEffect(() => {
    if (isPermanent || !bannedUntilIso || msLeft <= 0) return;

    const id = setInterval(() => {
      const remaining = Math.max(0, new Date(bannedUntilIso).getTime() - Date.now());
      setMsLeft(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [bannedUntilIso, isPermanent, msLeft]);

  const totalSecs = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  return { hours, mins, secs, isExpired: !isPermanent && msLeft <= 0 };
}

export function BanEkrani({ banInfo, onLogout, onBanExpired }: BanEkraniProps) {
  const { isPermanentBan, bannedUntil, banReason } = banInfo;
  const { hours, mins, secs, isExpired } = useBanCountdown(bannedUntil, isPermanentBan);
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (isExpired) onBanExpired?.();
  }, [isExpired, onBanExpired]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const endsAt = bannedUntil
    ? new Date(bannedUntil).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
          <Ionicons name="ban-outline" size={72} color="#f97316" />
        </Animated.View>

        <Text style={styles.title}>
          {isPermanentBan ? 'Kalıcı Olarak Banlandınız' : 'Geçici Olarak Banlandınız'}
        </Text>
        <Text style={styles.subtitle}>
          {isPermanentBan
            ? 'Hesabınıza kalıcı erişim kısıtlaması uygulanmıştır'
            : 'Hesabınıza geçici erişim kısıtlaması uygulanmıştır'}
        </Text>

        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>Ban Sebebi</Text>
          <Text style={styles.reasonText}>{banReason}</Text>
        </View>

        {isPermanentBan ? (
          <View style={styles.permanentWrap}>
            <Ionicons name="lock-closed" size={36} color="#f97316" />
            <Text style={styles.permanentText}>
              Bu kısıtlama süresizdir. Erişiminiz yönetici tarafından kaldırılana kadar devam eder.
            </Text>
          </View>
        ) : !isExpired && bannedUntil ? (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownLabel}>Ban Bitişine Kalan Süre</Text>
            <View style={styles.clockRow}>
              <View style={styles.clockBox}>
                <Text style={styles.clockNum}>{pad(hours)}</Text>
                <Text style={styles.clockUnit}>saat</Text>
              </View>
              <Text style={styles.clockSep}>:</Text>
              <View style={styles.clockBox}>
                <Text style={styles.clockNum}>{pad(mins)}</Text>
                <Text style={styles.clockUnit}>dk</Text>
              </View>
              <Text style={styles.clockSep}>:</Text>
              <View style={styles.clockBox}>
                <Text style={styles.clockNum}>{pad(secs)}</Text>
                <Text style={styles.clockUnit}>sn</Text>
              </View>
            </View>
            <Text style={styles.endsAt}>{endsAt} tarihinde ban kalkacak</Text>
          </View>
        ) : (
          <View style={styles.expiredWrap}>
            <Ionicons name="checkmark-circle" size={40} color="#34d399" />
            <Text style={styles.expiredText}>Ban süreniz doldu!</Text>
            <Text style={styles.expiredSub}>Uygulama yenileniyor…</Text>
          </View>
        )}

        <View style={styles.rulesCard}>
          {(isPermanentBan
            ? [
                'Ban süresince uygulamayı kullanamazsınız',
                'İtiraz için destek ekibiyle iletişime geçebilirsiniz',
              ]
            : [
                'Ban süresince uygulamayı kullanamazsınız',
                'Süre dolduğunda erişiminiz otomatik açılır',
                'İtiraz için destek ekibiyle iletişime geçebilirsiniz',
              ]
          ).map((rule) => (
            <View key={rule} style={styles.ruleRow}>
              <Ionicons name="information-circle-outline" size={14} color="#94a3b8" />
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 20,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: '#f9731615',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f9731640',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -8,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#f97316',
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    lineHeight: 20,
  },
  permanentWrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  permanentText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  countdownWrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockBox: {
    width: 70,
    height: 70,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f9731640',
    gap: 2,
  },
  clockNum: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f97316',
    fontVariant: ['tabular-nums'],
  },
  clockUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  clockSep: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f97316',
    marginTop: -6,
  },
  endsAt: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  expiredWrap: {
    alignItems: 'center',
    gap: 8,
  },
  expiredText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34d399',
  },
  expiredSub: {
    fontSize: 13,
    color: '#94a3b8',
  },
  rulesCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  logoutBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
