// =====================================================
// Gıda / sebze / meyve — yağmur animasyonu (emoji, font gerektirmez)
// =====================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

const FOOD_EMOJIS = [
  '🍎', '🥬', '☕', '🍕', '🐟', '🍽️', '🧺', '💧',
  '🍦', '🥚', '🍺', '🍷', '🍔', '🥗', '🥕', '🍇',
  '🍞', '🧀', '🥛', '🍫',
];

const DROP_COUNT = 28;

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface DropConfig {
  id: number;
  emoji: string;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
}

function FallingDrop({ drop }: { drop: DropConfig }) {
  const translateY = useRef(new Animated.Value(-drop.size - 20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;

    const fall = () => {
      if (!active) return;
      translateY.setValue(-drop.size - 20);
      translateX.setValue(0);
      rotate.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height + drop.size + 20,
          duration: drop.duration,
          delay: drop.delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: drop.drift,
          duration: drop.duration,
          delay: drop.delay,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: drop.duration,
          delay: drop.delay,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && active) fall();
      });
    };

    fall();
    return () => { active = false; };
  }, [drop, translateY, translateX, rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${drop.drift > 0 ? 22 : -22}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.drop,
        {
          left: drop.left,
          opacity: drop.opacity,
          transform: [
            { translateY },
            { translateX },
            { rotate: spin },
          ],
        },
      ]}
    >
      <Text style={{ fontSize: drop.size, lineHeight: drop.size + 4 }}>{drop.emoji}</Text>
    </Animated.View>
  );
}

export function FoodRainBackground() {
  const drops = useMemo<DropConfig[]>(
    () =>
      Array.from({ length: DROP_COUNT }, (_, i) => {
        const r1 = seededRandom(i + 1);
        const r2 = seededRandom(i + 11);
        const r3 = seededRandom(i + 21);
        const r4 = seededRandom(i + 31);
        const r5 = seededRandom(i + 41);
        const size = 18 + Math.round(r1 * 20);
        return {
          id: i,
          emoji: FOOD_EMOJIS[i % FOOD_EMOJIS.length],
          left: r2 * (width - size - 8),
          size,
          duration: 6000 + Math.round(r3 * 7000),
          delay: Math.round(r4 * 4000),
          opacity: 0.45 + r5 * 0.45,
          drift: (r5 - 0.5) * 44,
        };
      }),
    [],
  );

  return (
    <View style={s.container} pointerEvents="none">
      {drops.map((drop) => (
        <FallingDrop key={drop.id} drop={drop} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  drop: {
    position: 'absolute',
    top: 0,
  },
});
