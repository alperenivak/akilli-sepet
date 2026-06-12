// =====================================================
// Akıllı Sepet - Barkod Tarama Ekrani
// expo-camera ile barkod okuma
// Tarama sonucunda urunu ara veya ihbar olustur
// =====================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, AppState, Platform,
  ScrollView, type AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, Camera, BarcodeScanningResult } from 'expo-camera';
import type { PermissionResponse } from 'expo-modules-core';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProductByBarcode } from '../../src/api/products';

type ScanMode = 'product' | 'report';
type ContributeIntent = 'verify' | 'submit';

const INTENT_LABELS: Record<ContributeIntent, { title: string; sub: string }> = {
  verify: {
    title: 'Fiyat doğrulama',
    sub: 'Ürünü bul → fiyatların altında Doğru / Yanlış\'a bas',
  },
  submit: {
    title: 'Fiyat bildirme',
    sub: 'Ürünü bul → market fiyatını gir ve paylaş',
  },
};

type CameraPerm = Pick<PermissionResponse, 'granted' | 'canAskAgain' | 'status'>;

function applyPermResponse(res: PermissionResponse): CameraPerm {
  return { granted: res.granted, canAskAgain: res.canAskAgain, status: res.status };
}

export default function ScanScreen() {
  const { intent } = useLocalSearchParams<{ intent?: ContributeIntent }>();
  const insets = useSafeAreaInsets();
  const [cameraPerm, setCameraPerm] = useState<CameraPerm | null>(null);
  const [permChecking, setPermChecking] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('product');
  const [flashOn, setFlashOn] = useState(false);
  const [requestingPerm, setRequestingPerm] = useState(false);
  const lastScannedCode = useRef<string>('');

  const goSearchFallback = useCallback(() => {
    router.replace({
      pathname: '/(tabs)/search',
      params: intent ? { intent } : {},
    } as any);
  }, [intent]);

  const syncPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setCameraPerm({ granted: false, canAskAgain: false, status: 'denied' });
      setPermChecking(false);
      return null;
    }
    try {
      const res = await Camera.getCameraPermissionsAsync();
      setCameraPerm(applyPermResponse(res));
      return res;
    } catch {
      setPermError('Kamera izni kontrol edilemedi.');
      return null;
    } finally {
      setPermChecking(false);
    }
  }, []);

  useEffect(() => {
    void syncPermission();
  }, [syncPermission]);

  // Ayarlardan dönünce izni yeniden oku
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        setPermError(null);
        void syncPermission();
      }
    });
    return () => sub.remove();
  }, [syncPermission]);

  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        'Ayarlar Açılamadı',
        'Lütfen telefon ayarlarından uygulamaya kamera izni verin.',
      );
    }
  };

  const askCameraPermission = async () => {
    if (Platform.OS === 'web') {
      goSearchFallback();
      return;
    }

    setPermError(null);
    setRequestingPerm(true);
    try {
      const res = await Camera.requestCameraPermissionsAsync();
      setCameraPerm(applyPermResponse(res));

      if (res.granted) return;

      if (!res.canAskAgain) {
        Alert.alert(
          'Kamera İzni Kapalı',
          'Barkod taramak için uygulama ayarlarından kamera iznini açmanız gerekiyor.',
          [
            { text: 'Ayarları Aç', onPress: () => void openAppSettings() },
            { text: 'Ürün Ara', onPress: goSearchFallback },
            { text: 'İptal', style: 'cancel' },
          ],
        );
      } else {
        setPermError('Kamera izni verilmedi. Tekrar deneyebilir veya ayarlardan izin verebilirsiniz.');
      }
    } catch {
      setPermError('İzin penceresi açılamadı. Ayarlardan kamera iznini kontrol edin.');
    } finally {
      setRequestingPerm(false);
    }
  };

  // Barkod tarandığında
  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const { data: barcode } = result;

    // Ayni barkod arka arkaya taranmasin
    if (scanned || barcode === lastScannedCode.current) return;
    lastScannedCode.current = barcode;
    setScanned(true);
    setIsLoading(true);

    try {
      if (scanMode === 'product') {
        // Urunu veritabaninda ara
        const product = await getProductByBarcode(barcode);

        if (product?.id) {
          if (intent === 'submit') {
            router.replace({
              pathname: '/prices/submit',
              params: { productId: product.id, productName: product.name },
            });
          } else {
            router.replace(`/product/${product.id}`);
          }
        } else {
          // Urun bulunamadi
          Alert.alert(
            'Ürün Bulunamadı',
            `"${barcode}" barkoduna ait ürün sistemde kayıtlı değil.`,
            [
              {
                text: 'İhbar Oluştur',
                onPress: () =>
                  router.replace({
                    pathname: '/reports/create',
                    params: { barcode },
                  }),
              },
              {
                text: 'Tekrar Tara',
                onPress: () => {
                  setScanned(false);
                  lastScannedCode.current = '';
                },
              },
            ],
          );
        }
      } else {
        // Ihbar modu - barkodu ihbar formuna tasI
        router.replace({
          pathname: '/reports/create',
          params: { barcode },
        });
      }
    } catch {
      Alert.alert('Hata', 'Barkod sorgulanırken bir hata oluştu.', [
        {
          text: 'Tekrar Dene',
          onPress: () => {
            setScanned(false);
            lastScannedCode.current = '';
          },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Kamera izni yok ----
  if (!cameraPerm?.granted) {
    const blocked = cameraPerm != null && !cameraPerm.canAskAgain;
    const isWeb = Platform.OS === 'web';

    if (permChecking) {
      return (
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#E63329" />
          <Text style={styles.permissionText}>Kamera hazırlanıyor...</Text>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.permSafe}>
        <TouchableOpacity style={styles.permClose} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#64748b" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.permScroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.permIconWrap}>
            <Ionicons name="videocam-outline" size={40} color="#E63329" />
          </View>
          <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.permissionText}>
            {isWeb
              ? 'Web tarayıcıda barkod taraması desteklenmiyor. Ürün adıyla arayabilirsiniz.'
              : blocked
                ? 'Kamera izni reddedilmiş. Ayarlardan açabilir veya ürün adıyla arayabilirsiniz.'
                : 'Barkod taramak için kamera iznine ihtiyaç vardır. Aşağıdaki butonla izin verebilirsiniz.'}
          </Text>

          {permError ? (
            <View style={styles.permErrorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" />
              <Text style={styles.permErrorTxt}>{permError}</Text>
            </View>
          ) : null}

          {requestingPerm ? (
            <ActivityIndicator size="large" color="#E63329" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.permBtnCol}>
              {!isWeb && (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={askCameraPermission}
                  activeOpacity={0.85}
                >
                  <Ionicons name="videocam-outline" size={18} color="#fff" />
                  <Text style={styles.permissionButtonText}>İzin Ver</Text>
                </TouchableOpacity>
              )}

              {!isWeb && (
                <TouchableOpacity
                  style={[styles.permissionButton, styles.permissionButtonOutline]}
                  onPress={openAppSettings}
                  activeOpacity={0.85}
                >
                  <Ionicons name="settings-outline" size={18} color="#E63329" />
                  <Text style={[styles.permissionButtonText, styles.permissionButtonSecondaryText]}>
                    Ayarları Aç
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.permissionButton, styles.permissionButtonSecondary]}
                onPress={goSearchFallback}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={18} color="#E63329" />
                <Text style={[styles.permissionButtonText, styles.permissionButtonSecondaryText]}>
                  {isWeb ? 'Ürün Ara' : 'Kamera olmadan ürün ara'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.permBackLink} onPress={() => router.back()}>
            <Text style={styles.permBackTxt}>Geri dön</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13', 'ean8', 'upc_a', 'upc_e', 'code128',
            'code39', 'qr', 'aztec', 'pdf417', 'datamatrix',
          ],
        }}
        enableTorch={flashOn}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay — CameraView icinde child desteklenmiyor */}
      <View style={[StyleSheet.absoluteFillObject, styles.overlay]} pointerEvents="box-none">
          <View style={[styles.overlayTop, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.overlayTitle}>
              {intent ? INTENT_LABELS[intent].title : 'Barkod Tara'}
            </Text>
            <TouchableOpacity
              style={styles.flashButton}
              onPress={() => setFlashOn(!flashOn)}
            >
              <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Tarama Cercevesi */}
          <View style={styles.scanAreaContainer}>
            <View style={styles.scanArea}>
              {/* Kose Isimcikleri */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />

              {isLoading && (
                <View style={styles.scanLoading}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.scanLoadingText}>Ürün aranıyor...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Alt Alan */}
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>
              {intent ? INTENT_LABELS[intent].sub : 'Ürün barkodunu çerçeve içine getirin'}
            </Text>

            {/* Mod Secici */}
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'product' && styles.activeModeButton]}
                onPress={() => setScanMode('product')}
              >
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={scanMode === 'product' ? '#fff' : '#ccc'}
                />
                <Text
                  style={[styles.modeButtonText, scanMode === 'product' && styles.activeModeButtonText]}
                >
                  Ürün Ara
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'report' && styles.activeModeButton]}
                onPress={() => setScanMode('report')}
              >
                <Ionicons
                  name="warning-outline"
                  size={16}
                  color={scanMode === 'report' ? '#fff' : '#ccc'}
                />
                <Text
                  style={[styles.modeButtonText, scanMode === 'report' && styles.activeModeButtonText]}
                >
                  İhbar Oluştur
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tekrar Tara Butonu */}
            {scanned && !isLoading && (
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={() => {
                  setScanned(false);
                  lastScannedCode.current = '';
                }}
              >
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={styles.rescanButtonText}>Tekrar Tara</Text>
              </TouchableOpacity>
            )}
          </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
    backgroundColor: '#f8f9fa',
  },
  permSafe: { flex: 1, backgroundColor: '#f8f9fa' },
  permScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center' },
  permissionText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  permErrorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fecaca', width: '100%', maxWidth: 320,
  },
  permErrorTxt: { flex: 1, fontSize: 12, color: '#b91c1c', lineHeight: 17 },
  permBtnCol: { width: '100%', maxWidth: 320, gap: 10, marginTop: 4 },
  permClose: {
    position: 'absolute', top: 12, right: 12, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  permIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  permissionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E63329',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 260,
  },
  permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  permissionButtonOutline: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E63329',
  },
  permissionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E63329',
  },
  permissionButtonSecondaryText: { color: '#E63329' },
  permBackLink: { marginTop: 8, padding: 8 },
  permBackTxt: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  overlayTitle: { fontSize: 18, color: '#fff', fontWeight: '700' },
  flashButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  scanAreaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scanArea: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
    borderWidth: 4,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  scanLoadingText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  overlayBottom: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeModeButton: { backgroundColor: '#E63329' },
  modeButtonText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  activeModeButtonText: { color: '#fff' },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  rescanButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
