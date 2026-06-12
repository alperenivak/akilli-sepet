// =====================================================
// Akıllı Sepet - İhbar Oluştur — Premium Tasarım
// SKT geçmiş ürün bildirimi · Fotoğraf · Konum
// =====================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Image, Alert, ActivityIndicator,
  Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import apiClient from '../../src/api/client';
import { useMarkets, useMarket } from '../../src/hooks/useMarkets';
import { COLORS, toApiDateString, getApiErrorMessage } from '../../src/utils/constants';

const { width } = Dimensions.get('window');

const RED    = '#dc2626';
const RED_BG = '#fef2f2';
const RED_LT = '#fee2e2';
const GREEN  = '#16a34a';

// Bölüm başlık bileşeni
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionIcon}>
        <Ionicons name={icon as any} size={18} color={RED} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export default function CreateReportScreen() {
  const params = useLocalSearchParams();

  const [description, setDescription]     = useState('');
  const [barcode, setBarcode]             = useState((params.barcode as string) || '');
  const [expiryDate, setExpiryDate]       = useState('');
  const [images, setImages]               = useState<string[]>([]);
  const [location, setLocation]           = useState<{ lat: number; lng: number } | null>(null);
  const [isAnonymous, setIsAnonymous]     = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [descFocused, setDescFocused]     = useState(false);
  const [marketMode, setMarketMode]       = useState<'list' | 'other'>('list');
  const [marketId, setMarketId]           = useState('');
  const [branchId, setBranchId]           = useState('');
  const [marketNameOther, setMarketNameOther] = useState('');

  const { data: markets = [], isLoading: marketsLoading } = useMarkets();
  const { data: marketDetail } = useMarket(marketId);
  const branches = marketDetail?.branches?.filter((b) => b.isActive !== false) ?? [];

  // SKT format: GG.AA.YYYY
  const isValidDate = (v: string) => v === '' || /^\d{2}\.\d{2}\.\d{4}$/.test(v);

  // Konum al
  const getLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum almak için izin gereklidir.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert('Hata', 'Konum alınamadı.');
    } finally {
      setGettingLocation(false);
    }
  };

  // Fotoğraf ekle
  const addImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.75,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 3));
    }
  };

  // Görsel yükle
  const uploadImages = async (reportId: string): Promise<number> => {
    let fail = 0;
    for (const uri of images) {
      try {
        const filename = uri.split('/').pop() ?? 'image.jpg';
        const ext = /\.(\w+)$/.exec(filename);
        const type = ext ? `image/${ext[1]}` : 'image/jpeg';
        const formData = new FormData();
        formData.append('image', { uri, name: filename, type } as any);
        await apiClient.post(`/reports/${reportId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch { fail++; }
    }
    return fail;
  };

  // Gönder
  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Eksik Bilgi', 'Açıklama alanı zorunludur.');
      return;
    }
    if (expiryDate && !isValidDate(expiryDate)) {
      Alert.alert('Format Hatası', 'Son kullanma tarihi GG.AA.YYYY formatında olmalıdır.\nÖrnek: 31.12.2025');
      return;
    }
    if (marketMode === 'list' && !marketId) {
      Alert.alert('Eksik Bilgi', 'Lütfen listeden bir market seçin veya "Diğer" sekmesinden market adını yazın.');
      return;
    }
    if (marketMode === 'other' && !marketNameOther.trim()) {
      Alert.alert('Eksik Bilgi', 'Listede olmayan market için ad veya adres yazın.');
      return;
    }

    setIsLoading(true);
    try {
      const productId = typeof params.productId === 'string' && params.productId.trim()
        ? params.productId.trim()
        : undefined;

      const res = await apiClient.post('/reports', {
        barcodeCode:  barcode.trim() || undefined,
        productId,
        description:  description.trim(),
        expiryDate:   toApiDateString(expiryDate),
        latitude:     location?.lat,
        longitude:    location?.lng,
        isAnonymous,
        imageUrls:    [],
        ...(marketMode === 'list'
          ? { marketId, branchId: branchId || undefined }
          : { marketNameOther: marketNameOther.trim() }),
      });

      const reportId = res.data?.data?.id;
      let failCount = 0;
      if (reportId && images.length > 0) failCount = await uploadImages(reportId);

      Alert.alert(
        '✅ İhbar Alındı',
        failCount > 0
          ? `İhbarınız kaydedildi, ancak ${failCount} fotoğraf yüklenemedi.`
          : 'İhbarınız başarıyla iletildi. İnceleme sonrası bildirim alacaksınız.',
        [{ text: 'Tamam', onPress: () => router.back() }],
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        Alert.alert('Giriş Gerekli', 'İhbar oluşturmak için giriş yapmalısınız.', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Giriş Yap', onPress: () => router.push('/(auth)/login') },
        ]);
      } else {
        Alert.alert(
          'İhbar Gönderilemedi',
          getApiErrorMessage(err, 'Lütfen bilgilerinizi kontrol edip tekrar deneyin.'),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // SKT formatlaması
  const handleExpiryChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setExpiryDate(formatted);
  };

  const dateError = expiryDate.length > 0 && !isValidDate(expiryDate);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* ── Üst Bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitle}>İhbar Oluştur</Text>
          <Text style={s.topSub}>SKT geçmiş ürün bildirimi</Text>
        </View>
        <View style={s.topBadge}>
          <Ionicons name="warning" size={14} color={RED} />
          <Text style={s.topBadgeTxt}>Bildir</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Bilgi Kartı ── */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <Text style={s.infoBannerTxt}>
            Markette son kullanma tarihi geçmiş veya yaklaşan ürünleri kolayca bildirin. Her ihbar toplumu korur.
          </Text>
        </View>

        {/* ── Barkod Kartı ── */}
        <View style={s.card}>
          <SectionHeader icon="barcode-outline" title="Ürün Barkodu" subtitle="Opsiyonel — barkod okutarak doldurabilirsiniz" />
          <View style={s.barcodeRow}>
            <TextInput
              style={s.barcodeInput}
              placeholder="8690000000000"
              placeholderTextColor="#94a3b8"
              value={barcode}
              onChangeText={setBarcode}
              keyboardType="numeric"
            />
            <TouchableOpacity style={s.scanBtn} onPress={() => router.push('/scan' as any)} activeOpacity={0.85}>
              <Ionicons name="scan" size={20} color={RED} />
              <Text style={s.scanBtnTxt}>Tara</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Market Kartı ── */}
        <View style={s.card}>
          <SectionHeader
            icon="storefront-outline"
            title="Market"
            subtitle="Zorunlu — listeden seçin veya yazılı bildirin"
          />
          <View style={s.marketTabs}>
            <TouchableOpacity
              style={[s.marketTab, marketMode === 'list' && s.marketTabActive]}
              onPress={() => setMarketMode('list')}
            >
              <Text style={[s.marketTabTxt, marketMode === 'list' && s.marketTabTxtActive]}>Listeden</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.marketTab, marketMode === 'other' && s.marketTabActive]}
              onPress={() => { setMarketMode('other'); setMarketId(''); setBranchId(''); }}
            >
              <Text style={[s.marketTabTxt, marketMode === 'other' && s.marketTabTxtActive]}>Diğer</Text>
            </TouchableOpacity>
          </View>

          {marketMode === 'list' ? (
            marketsLoading ? (
              <ActivityIndicator color={RED} style={{ marginVertical: 8 }} />
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.marketScroll}>
                  {markets.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.marketChip, marketId === m.id && s.marketChipActive]}
                      onPress={() => { setMarketId(m.id); setBranchId(''); }}
                    >
                      <Text style={[s.marketChipTxt, marketId === m.id && s.marketChipTxtActive]} numberOfLines={1}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {branches.length > 0 && (
                  <View style={s.branchBlock}>
                    <Text style={s.branchLabel}>Şube (opsiyonel)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {branches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[s.marketChip, branchId === b.id && s.marketChipActive]}
                          onPress={() => setBranchId(branchId === b.id ? '' : b.id)}
                        >
                          <Text style={[s.marketChipTxt, branchId === b.id && s.marketChipTxtActive]} numberOfLines={1}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )
          ) : (
            <TextInput
              style={s.otherMarketInput}
              placeholder="Örn: Mahalle bakkalı, X Caddesi No:5"
              placeholderTextColor="#94a3b8"
              value={marketNameOther}
              onChangeText={setMarketNameOther}
              maxLength={200}
            />
          )}
        </View>

        {/* ── Açıklama Kartı ── */}
        <View style={s.card}>
          <SectionHeader icon="document-text-outline" title="Açıklama" subtitle="Zorunlu — ürünü ve durumunu kısaca açıklayın" />
          <TextInput
            style={[s.textarea, descFocused && s.textareaFocused]}
            placeholder="Ürün adı, konumu ve durum hakkında bilgi verin...&#10;&#10;Örnek: Dondurma reyonunda Algida markalı ürünlerin SKT'si Ocak 2025'te bitmiş."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
          />
          <Text style={[s.charCount, description.length > 400 && { color: RED }]}>
            {description.length} / 500
          </Text>
        </View>

        {/* ── SKT Tarihi Kartı ── */}
        <View style={s.card}>
          <SectionHeader icon="calendar-outline" title="Son Kullanma Tarihi" subtitle="Opsiyonel — GG.AA.YYYY formatında" />
          <View style={[s.dateField, dateError && s.dateFieldError]}>
            <Ionicons name="calendar" size={18} color={dateError ? RED : '#94a3b8'} />
            <TextInput
              style={s.dateInput}
              placeholder="31.12.2025"
              placeholderTextColor="#94a3b8"
              value={expiryDate}
              onChangeText={handleExpiryChange}
              keyboardType="numeric"
              maxLength={10}
            />
            {expiryDate.length > 0 && (
              <Ionicons
                name={isValidDate(expiryDate) ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={isValidDate(expiryDate) ? GREEN : RED}
              />
            )}
          </View>
          {dateError && (
            <Text style={s.dateError}>GG.AA.YYYY formatında girin · Örnek: 31.12.2025</Text>
          )}
        </View>

        {/* ── Konum Kartı ── */}
        <View style={s.card}>
          <SectionHeader icon="location-outline" title="Konum" subtitle="Marketin konumunu ekleyin" />
          <TouchableOpacity
            style={[s.locationBtn, location && s.locationBtnActive]}
            onPress={getLocation}
            disabled={gettingLocation}
            activeOpacity={0.85}
          >
            {gettingLocation ? (
              <>
                <ActivityIndicator size="small" color={RED} />
                <Text style={s.locationBtnTxt}>Konum alınıyor…</Text>
              </>
            ) : location ? (
              <>
                <View style={s.locationDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.locationBtnTxt, { color: GREEN, fontWeight: '700' }]}>Konum Eklendi ✓</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setLocation(null)}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="location-outline" size={20} color={RED} />
                <Text style={s.locationBtnTxt}>Konumumu Ekle</Text>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Fotoğraf Kartı ── */}
        <View style={s.card}>
          <SectionHeader
            icon="camera-outline"
            title="Fotoğraflar"
            subtitle={`En fazla 3 fotoğraf · ${images.length}/3 eklendi`}
          />
          <View style={s.photoGrid}>
            {images.map((uri, i) => (
              <View key={i} style={s.photoItem}>
                <Image source={{ uri }} style={s.photoImg} />
                <TouchableOpacity
                  style={s.photoRemove}
                  onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 3 && (
              <TouchableOpacity style={s.photoAdd} onPress={addImage} activeOpacity={0.75}>
                <Ionicons name="add" size={28} color="#94a3b8" />
                <Text style={s.photoAddTxt}>Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Anonim Toggle ── */}
        <TouchableOpacity
          style={[s.anonRow, isAnonymous && s.anonRowActive]}
          onPress={() => setIsAnonymous((v) => !v)}
          activeOpacity={0.85}
        >
          <View style={[s.anonIcon, isAnonymous && { backgroundColor: RED }]}>
            <Ionicons name={isAnonymous ? 'eye-off' : 'eye'} size={18} color={isAnonymous ? '#fff' : '#94a3b8'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.anonTitle, isAnonymous && { color: RED }]}>
              {isAnonymous ? 'Anonim gönderim aktif' : 'Anonim olarak gönder'}
            </Text>
            <Text style={s.anonSub}>Kimliğiniz denetçilere görünmez</Text>
          </View>
          <View style={[s.toggle, isAnonymous && s.toggleOn]}>
            <View style={[s.toggleThumb, isAnonymous && s.toggleThumbOn]} />
          </View>
        </TouchableOpacity>

        {/* ── Gönder Butonu ── */}
        <TouchableOpacity
          style={[s.submitBtn, isLoading && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={s.submitTxt}>İhbarı Gönder</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Gönderilen ihbarlar denetçiler tarafından incelenir. Yanlış bildirim yapmak hesabınızı olumsuz etkileyebilir.
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_RADIUS = 18;
const IMG_SIZE    = (width - 48 - 20) / 3;

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, gap: 14 },

  // ── Üst Bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: RED,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    overflow: 'hidden',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  topSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  topBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  topBadgeTxt: { fontSize: 12, fontWeight: '700', color: RED },

  // ── Bilgi Banneri ──
  infoBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  infoBannerTxt: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 19 },

  // ── Kart ──
  card: {
    backgroundColor: '#fff', borderRadius: CARD_RADIUS,
    padding: 16, gap: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },

  // ── Bölüm Başlığı ──
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: RED_BG, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  sectionSub:   { fontSize: 11, color: '#94a3b8', marginTop: 1 },

  // ── Barkod ──
  barcodeRow:  { flexDirection: 'row', gap: 10 },
  barcodeInput: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#0f172a',
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: RED_BG, borderRadius: 12,
    borderWidth: 1.5, borderColor: RED_LT,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  scanBtnTxt: { fontSize: 13, fontWeight: '700', color: RED },

  // ── Market ──
  marketTabs: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4,
  },
  marketTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
  },
  marketTabActive: { backgroundColor: '#fff', ...Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    android: { elevation: 2 },
  }) },
  marketTabTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  marketTabTxtActive: { color: RED, fontWeight: '800' },
  marketScroll: { marginTop: 4 },
  marketChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
    marginRight: 8, maxWidth: 160,
  },
  marketChipActive: { backgroundColor: RED_BG, borderColor: RED },
  marketChipTxt: { fontSize: 13, color: '#475569', fontWeight: '600' },
  marketChipTxtActive: { color: RED, fontWeight: '800' },
  branchBlock: { marginTop: 10, gap: 6 },
  branchLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  otherMarketInput: {
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0f172a',
  },

  // ── Açıklama ──
  textarea: {
    backgroundColor: '#f8fafc', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0f172a', minHeight: 120,
  },
  textareaFocused: { borderColor: RED, backgroundColor: RED_BG },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right' },

  // ── SKT ──
  dateField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f8fafc', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dateFieldError: { borderColor: RED, backgroundColor: RED_BG },
  dateInput: { flex: 1, fontSize: 15, color: '#0f172a' },
  dateError: { fontSize: 12, color: RED, marginTop: -4 },

  // ── Konum ──
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8fafc', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 14, paddingVertical: 14,
  },
  locationBtnActive: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  locationBtnTxt:    { flex: 1, fontSize: 14, color: '#475569', fontWeight: '600' },
  locationDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: GREEN,
    ...Platform.select({ ios: { shadowColor: GREEN, shadowOpacity: 0.6, shadowRadius: 4 }, android: {} }),
  },

  // ── Fotoğraflar ──
  photoGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem:   { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden' },
  photoImg:    { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 11,
  },
  photoAdd: {
    width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12,
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoAddTxt: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  // ── Anonim Toggle ──
  anonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: CARD_RADIUS,
    padding: 16, borderWidth: 1.5, borderColor: '#e2e8f0',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  anonRowActive: { borderColor: RED_LT, backgroundColor: RED_BG },
  anonIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  anonTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  anonSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: '#e2e8f0', padding: 3, justifyContent: 'center',
  },
  toggleOn: { backgroundColor: RED },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#94a3b8', alignSelf: 'flex-start',
  },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  // ── Gönder ──
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: RED, borderRadius: 18, paddingVertical: 16,
    ...Platform.select({
      ios:     { shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  disclaimer: {
    fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8,
  },
});
