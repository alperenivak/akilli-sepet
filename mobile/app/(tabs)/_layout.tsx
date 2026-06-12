// =====================================================
// Akıllı Sepet - Tab Navigator
// Özel tab bar: merkez barkod butonu + rozet + animasyon
// =====================================================

import React, { useRef, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../../src/store/cartStore';
import { COLORS } from '../../src/utils/constants';

const { width } = Dimensions.get('window');

// ── Tab tanımları (merkez "Tara" hariç 4 tab) ───────
const TABS = [
  { name: 'index',   label: 'Ana Sayfa', icon: 'home',       iconActive: 'home'       },
  { name: 'search',  label: 'Ara',       icon: 'search',     iconActive: 'search'     },
  { name: 'markets', label: 'Marketler', icon: 'storefront', iconActive: 'storefront' },
  { name: 'cart',    label: 'Sepet',     icon: 'bag',        iconActive: 'bag'        },
  { name: 'profile', label: 'Profil',    icon: 'person',     iconActive: 'person'     },
];

// ── Özel tab bar bileşeni ────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const cart    = useCartStore((s) => s.cart?.totalItems ?? 0);

  // Merkez tara butonunun scale animasyonu
  const scanScale = useRef(new Animated.Value(1)).current;

  const pressScan = () => {
    Animated.sequence([
      Animated.timing(scanScale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(scanScale,  { toValue: 1,    tension: 200, friction: 6,   useNativeDriver: true }),
    ]).start();
    router.push('/scan' as any);
  };

  // Aktif sekme index'i
  const activeIdx = state.index;

  // Sekmeler: 0-1 sol taraf, 2 merkez boşluk, 3-4 sağ taraf
  const leftTabs  = TABS.slice(0, 2);
  const rightTabs = TABS.slice(3, 5);

  const renderTab = (tab: typeof TABS[number], routeIdx: number) => {
    const route    = state.routes[routeIdx];
    const focused  = state.index === routeIdx;
    const isCart   = tab.name === 'cart';

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };

    // Icon animasyonu
    const scaleAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (focused) {
        Animated.spring(scaleAnim, { toValue: 1.18, tension: 200, friction: 6, useNativeDriver: true }).start();
      } else {
        Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }).start();
      }
    }, [focused]);

    return (
      <TouchableOpacity key={tab.name} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
        <Animated.View style={[styles.iconWrap, focused && styles.iconWrapActive, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons
            name={(focused ? tab.iconActive : `${tab.icon}-outline`) as any}
            size={22}
            color={focused ? COLORS.primary : COLORS.textMuted}
          />
          {/* Sepet rozeti */}
          {isCart && cart > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cart > 9 ? '9+' : cart}</Text>
            </View>
          )}
        </Animated.View>
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 8 }]}>
      {/* Sol 2 sekme */}
      <View style={styles.side}>
        {renderTab(leftTabs[0], 0)}
        {renderTab(leftTabs[1], 1)}
      </View>

      {/* Merkez: yükseltilmiş Barkod Tara butonu */}
      <View style={styles.centerSlot}>
        <Animated.View style={{ transform: [{ scale: scanScale }] }}>
          <View style={styles.scanOuter}>
            <TouchableOpacity style={styles.scanBtn} onPress={pressScan} activeOpacity={0.85}>
              <Ionicons name="scan" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
        <Text style={styles.scanLabel}>Tara</Text>
      </View>

      {/* Sağ 2 sekme */}
      <View style={styles.side}>
        {renderTab(rightTabs[0], 3)}
        {renderTab(rightTabs[1], 4)}
      </View>
    </View>
  );
}

// ── Layout ───────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.white },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Ana Sayfa', headerShown: false }} />
      <Tabs.Screen name="search"  options={{ title: 'Ürün Ara',  headerTitle: 'Ürün Ara' }} />
      <Tabs.Screen name="markets" options={{ title: 'Marketler', headerTitle: 'Marketler' }} />
      <Tabs.Screen name="cart"    options={{ title: 'Sepet',     headerTitle: 'Sepetim' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil',    headerTitle: 'Profilim' }} />
    </Tabs>
  );
}

// ── Stiller ──────────────────────────────────────────
const SCAN_SIZE = 58;
const BAR_H    = 60;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    overflow: 'visible',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 12 },
    }),
  },

  // Sol / sağ gruplar
  side: {
    flex: 1,
    flexDirection: 'row',
  },

  // Her sekme
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    minHeight: BAR_H,
  },
  iconWrap: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Sepet rozeti
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.danger,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Merkez barkod butonu
  centerSlot: {
    width: SCAN_SIZE + 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    overflow: 'visible',
  },
  scanOuter: {
    marginTop: -(SCAN_SIZE * 0.55),  // tab bar üstüne taşar
    marginBottom: 2,
    borderRadius: (SCAN_SIZE + 12) / 2,
    backgroundColor: '#fff',
    padding: 5,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 0 },
    }),
  },
  scanBtn: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: SCAN_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  scanLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
});
