// =====================================================
// Akıllı Sepet - Kok Layout
// QueryClient, Auth yuklemesi, Splash animasyonu
// =====================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { useCartStore } from '../src/store/cartStore';
import { SplashScreen } from '../src/components/SplashScreen';
import { BanEkrani } from '../src/components/BanEkrani';
import { AppMessageModal } from '../src/components/ui/AppMessageModal';
import { registerBanHandler } from '../src/api/client';
import { isBanActive } from '../src/utils/ban';

ExpoSplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Sunucuya ulasilamadiysa tekrar deneme — takilmayi onler
        if (!(error as { response?: unknown })?.response) return false;
        return failureCount < 1;
      },
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInitializer({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((s) => s.loadUser);
  const logout = useAuthStore((s) => s.logout);
  const setBanInfo = useAuthStore((s) => s.setBanInfo);
  const clearBanIfExpired = useAuthStore((s) => s.clearBanIfExpired);
  const banInfo = useAuthStore((s) => s.banInfo);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    registerBanHandler(setBanInfo);
  }, [setBanInfo]);

  useEffect(() => {
    ExpoSplashScreen.hideAsync();
    // Ag istekleri splash'i bloklamasin — arka planda calissin
    void Promise.allSettled([loadUser(), fetchCart()]);
  }, []);

  useEffect(() => {
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        loadUser();
      }
    };

    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [loadUser]);

  const onSplashFinish = useCallback(() => setSplashDone(true), []);
  const onBanExpired = useCallback(() => {
    clearBanIfExpired();
    loadUser();
  }, [clearBanIfExpired, loadUser]);

  if (isBanActive(banInfo)) {
    return (
      <BanEkrani
        banInfo={banInfo!}
        onLogout={logout}
        onBanExpired={onBanExpired}
      />
    );
  }

  return (
    <>
      {children}
      <AppMessageModal />
      {!splashDone && <SplashScreen onFinish={onSplashFinish} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Tek seferde yukle — her Ionicons bileseni ayri indirme yapmasin
        await Font.loadAsync(Ionicons.font);
      } catch {
        try { await Ionicons.loadFont(); } catch { /* sistem fontu ile devam */ }
      } finally {
        if (active) setFontsReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  return (
    <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <AppInitializer>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#111827',
            headerTitleStyle: { fontWeight: '700' },
          }}
        >
          <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
          <Stack.Screen name="(auth)"       options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Ürün Detayı', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="market/[id]"  options={{ title: 'Market',      headerBackTitle: 'Geri' }} />
          <Stack.Screen name="catalogs/[id]"options={{ title: 'Katalog',     headerBackTitle: 'Geri' }} />
          <Stack.Screen name="scan/index"   options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="reports/create" options={{ title: 'İhbar Oluştur', presentation: 'modal', headerBackTitle: 'Kapat' }} />
          <Stack.Screen name="reports/my"   options={{ title: 'İhbarlarım',  headerBackTitle: 'Profil' }} />
          <Stack.Screen name="alerts/my"    options={{ title: 'Takip Edilen Ürünler', headerBackTitle: 'Profil' }} />
          <Stack.Screen name="coupons/index" options={{ title: 'Kuponlarım', headerBackTitle: 'Profil' }} />
          <Stack.Screen name="notifications"options={{ title: 'Bildirimler', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="contributions/barcode" options={{ title: 'Barkod Ekle', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="contributions/market-listing" options={{ title: 'Markete Ekle', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="contributions/mine" options={{ title: 'Katkılarım', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="ai/chat"      options={{ title: 'Akıllı Asistan', headerBackTitle: 'Geri' }} />
          <Stack.Screen name="about"        options={{ headerShown: false }} />
        </Stack>
      </AppInitializer>
    </QueryClientProvider>
    </SafeAreaProvider>
  );
}
