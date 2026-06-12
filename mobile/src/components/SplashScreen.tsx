// =====================================================
// Akıllı Sepet - Giriş Animasyonu (Splash)
// Arka plan: düşen gıda ikonları · Logo yok
// =====================================================

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated,
  Dimensions, StyleSheet,
} from 'react-native';
import { FoodRainBackground } from './FoodRainBackground';

const { width } = Dimensions.get('window');

const C = {
  bg:      '#07111f',
  accent:  '#3b82f6',
  accentL: '#60a5fa',
  text:    '#f1f5f9',
  sub:     '#64748b',
};

interface Props { onFinish: () => void }

export function SplashScreen({ onFinish }: Props) {
  const master = useRef(new Animated.Value(1)).current;
  const t1Y    = useRef(new Animated.Value(24)).current;
  const t1Op   = useRef(new Animated.Value(0)).current;
  const t2Y    = useRef(new Animated.Value(24)).current;
  const t2Op   = useRef(new Animated.Value(0)).current;
  const tagOp  = useRef(new Animated.Value(0)).current;
  const barW   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(t1Op, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(t1Y, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(t2Op, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(t2Y, { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(tagOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(barW, { toValue: width - 80, duration: 2400, useNativeDriver: false }),
      Animated.delay(600),
      Animated.timing(master, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, [barW, master, onFinish, t1Op, t1Y, t2Op, t2Y, tagOp]);

  return (
    <Animated.View style={[s.root, { opacity: master }]}>
      <FoodRainBackground />

      {/* Hafif merkez parıltı */}
      <View style={s.glowOrb} pointerEvents="none" />

      {/* Marka metni — logo yok */}
      <View style={s.content}>
        <View style={s.nameRow}>
          <Animated.Text style={[s.nameLight, { opacity: t1Op, transform: [{ translateY: t1Y }] }]}>
            Akıllı
          </Animated.Text>
          <Animated.Text style={[s.nameBold, { opacity: t2Op, transform: [{ translateY: t2Y }] }]}>
            Sepet
          </Animated.Text>
        </View>
        <Animated.Text style={[s.tag, { opacity: tagOp }]}>
          Akıllı alışveriş · Gerçek tasarruf
        </Animated.Text>
      </View>

      <View style={s.track}>
        <Animated.View style={[s.fill, { width: barW }]} />
      </View>

      <Animated.Text style={[s.ver, { opacity: tagOp }]}>v1.0</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    zIndex: 9999,
    elevation: 999,
  },
  glowOrb: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(29,78,216,0.08)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 12,
  },
  nameLight: {
    fontSize: 42,
    fontWeight: '300',
    color: C.text,
    letterSpacing: 1,
    lineHeight: 48,
  },
  nameBold: {
    fontSize: 42,
    fontWeight: '800',
    color: C.accentL,
    letterSpacing: 1,
    lineHeight: 48,
  },
  tag: {
    fontSize: 14,
    color: C.sub,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  track: {
    position: 'absolute',
    bottom: 72,
    left: 40,
    right: 40,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(59,130,246,0.15)',
    overflow: 'hidden',
    zIndex: 2,
  },
  fill: {
    height: 2,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  ver: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    fontSize: 11,
    color: 'rgba(100,116,139,0.6)',
    letterSpacing: 1,
    zIndex: 2,
  },
});
