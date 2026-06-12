// =====================================================
// Akıllı Sepet - Ürün Arama Ekranı — Premium Tasarım
// Kategori filtre · Sıralama · Grid/Liste görünümü
// =====================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions, Modal, ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getProducts } from '../../src/api/products';
import { useCategories } from '../../src/hooks/useProducts';
import { ProductCard } from '../../src/components/ProductCard';
import { CategoryFilterBar } from '../../src/components/CategoryFilterBar';
import { Product, Category } from '../../src/types/api';
import { useAddToCartWithMarket } from '../../src/hooks/useAddToCartWithMarket';
import { MarketPickerModal } from '../../src/components/cart/MarketPickerModal';
import { COLORS, SEARCH_DEBOUNCE_MS } from '../../src/utils/constants';
import { StateView, ConnectionErrorView } from '../../src/components/ui/StateViews';
import {
  resolveCategorySelection, getFilterCategoryId, findCategoryById,
} from '../../src/utils/categories';

const { width } = Dimensions.get('window');

// Sıralama seçenekleri
type SortKey = 'default' | 'name_asc' | 'price_asc' | 'price_desc';
const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'default',    label: 'Varsayılan',       icon: 'swap-vertical' },
  { key: 'name_asc',   label: 'A → Z',            icon: 'text' },
  { key: 'price_asc',  label: 'Ucuzdan Pahalıya', icon: 'trending-down' },
  { key: 'price_desc', label: 'Pahalıdan Ucuza',  icon: 'trending-up' },
];

// Popüler arama önerileri
const POPULAR = ['Su', 'Süt', 'Ekmek', 'Yoğurt', 'Meyve', 'Et', 'Deterjan', 'Çay', 'Kahve', 'Peynir'];

type SearchIntent = 'verify' | 'submit';

const INTENT_HINTS: Record<SearchIntent, { icon: string; title: string; body: string; color: string; bg: string }> = {
  verify: {
    icon: 'checkmark-circle',
    title: 'Fiyat doğrulama modu',
    body: 'Ürüne dokun → market fiyatının altında Doğru veya Yanlış\'a bas (+0.05 itibar)',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  submit: {
    icon: 'megaphone',
    title: 'Fiyat bildirme modu',
    body: 'Ürüne dokun → sağ üstteki Fiyat Bildir ile market fiyatını gir (+0.08 itibar)',
    color: '#1d4ed8',
    bg: '#eff6ff',
  },
};

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    intent?: SearchIntent;
    q?: string;
  }>();
  const [query, setQuery]                   = useState(params.q ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(params.q ?? '');
  const [intentDismissed, setIntentDismissed] = useState(false);
  const [parentId, setParentId]             = useState('');
  const [categoryId, setCategoryId]         = useState('');
  const [categoryReady, setCategoryReady]   = useState(!params.categoryId);
  const [sortKey, setSortKey]               = useState<SortKey>('default');
  const [gridMode, setGridMode]             = useState(false);
  const [showSort, setShowSort]             = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<TextInput>(null);
  const { picker, adding, openPicker, closePicker, confirmAdd } = useAddToCartWithMarket();
  const { data: categoryTree = [] } = useCategories();

  const filterCategoryId = getFilterCategoryId(parentId, categoryId);

  const activeIntent = !intentDismissed && params.intent ? params.intent : null;
  const intentHint = activeIntent ? INTENT_HINTS[activeIntent] : null;

  // URL parametresinden kategori (ana veya alt) — agac yuklenene kadar sorgu bekle
  useEffect(() => {
    if (!params.categoryId) {
      setCategoryReady(true);
      return;
    }
    setCategoryReady(false);
    if (categoryTree.length === 0) return;
    const { parentId: p, categoryId: c } = resolveCategorySelection(categoryTree, params.categoryId);
    setParentId(p);
    setCategoryId(c);
    setCategoryReady(true);
  }, [params.categoryId, categoryTree]);

  // Profilden gelen hızlı arama
  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      setDebouncedQuery(params.q);
      setIntentDismissed(false);
    }
  }, [params.q]);

  useEffect(() => {
    if (params.intent) setIntentDismissed(false);
  }, [params.intent]);

  // Debounce: kullanıcı yazmayı bırakınca debouncedQuery güncellenir
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQuery(trimmed);
      if (trimmed.length > 1) {
        setRecentSearches((prev) => {
          const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 6);
          return next;
        });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Kullanıcı hâlâ yazıyor mu? (debounce henüz ateşlenmedi)
  const isTyping = query.trim() !== debouncedQuery;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['search', debouncedQuery, filterCategoryId],
    queryFn: () => getProducts({
      search: debouncedQuery || undefined,
      categoryId: filterCategoryId || undefined,
      limit: 50,
    }),
    // Hiç arama yoksa ilk 50 ürünü getir; arama varsa en az 2 karakter
    enabled: categoryReady && !isTyping && (debouncedQuery.length === 0 || debouncedQuery.length >= 2 || !!filterCategoryId),
    staleTime: debouncedQuery.length > 0 ? 10_000 : 30_000,
    // Sorgu anahtarı değişince eski veriyi GÖSTERME — kullanıcı yanlış sonuç görmesin
    placeholderData: undefined,
  });

  const handleAddToCart = useCallback((product: Product) => openPicker(product), [openPicker]);

  // Sıralama
  const rawProducts = data?.items ?? [];
  const hasFilter = !!(debouncedQuery || filterCategoryId);
  const hasContent = categoryReady && !isTyping && (hasFilter || rawProducts.length > 0 || isLoading || isFetching);
  const products = [...rawProducts].sort((a, b) => {
    if (sortKey === 'name_asc') return a.name.localeCompare(b.name, 'tr');
    if (sortKey === 'price_asc') return (a.lowestPrice ?? 9999) - (b.lowestPrice ?? 9999);
    if (sortKey === 'price_desc') return (b.lowestPrice ?? 0) - (a.lowestPrice ?? 0);
    return 0;
  });

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey)!;
  const activeCategory = findCategoryById(categoryTree, categoryId || parentId);
  const breadcrumb = activeCategory
    ? (parentId && categoryId
      ? `${findCategoryById(categoryTree, parentId)?.name ?? ''} › ${activeCategory.name}`
      : activeCategory.name)
    : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Üst Bar ── */}
        <View style={s.topBar}>
          {/* Arama kutusu */}
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color={COLORS.primary} style={{ marginLeft: 12 }} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="Ürün, marka veya market ara…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {isFetching && !isTyping && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 12 }} />}
          </View>

          {/* Barkod Tara */}
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push({
              pathname: '/scan',
              params: activeIntent ? { intent: activeIntent } : {},
            } as any)}
          >
            <Ionicons name="scan" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {intentHint && (
          <View style={[s.intentBanner, { backgroundColor: intentHint.bg }]}>
            <Ionicons name={intentHint.icon as any} size={20} color={intentHint.color} />
            <View style={s.intentBody}>
              <Text style={[s.intentTitle, { color: intentHint.color }]}>{intentHint.title}</Text>
              <Text style={s.intentText}>{intentHint.body}</Text>
            </View>
            <TouchableOpacity onPress={() => setIntentDismissed(true)} hitSlop={8}>
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {/* Yazıyor göstergesi */}
        {isTyping && query.trim().length > 0 && (
          <View style={s.typingBar}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={s.typingTxt}>"{query.trim()}" aranıyor…</Text>
          </View>
        )}

        {/* ── Kategori filtreleri (ana + alt) ── */}
        {categoryTree.length > 0 && (
          <CategoryFilterBar
            tree={categoryTree}
            parentId={parentId}
            categoryId={categoryId}
            onParentChange={setParentId}
            onCategoryChange={setCategoryId}
          />
        )}

        {/* ── Sonuç toolbar ── */}
        {hasContent && !isLoading && products.length > 0 && (
          <View style={s.toolbar}>
            <View>
              <Text style={s.resultCount}>
                <Text style={s.resultNum}>{data?.total ?? products.length}</Text> ürün
              </Text>
              {breadcrumb && !debouncedQuery && (
                <Text style={s.breadcrumb}>{breadcrumb}</Text>
              )}
            </View>
            <View style={s.toolbarRight}>
              {/* Sıralama */}
              <TouchableOpacity style={s.sortBtn} onPress={() => setShowSort(true)}>
                <Ionicons name={currentSort.icon as any} size={14} color={COLORS.primary} />
                <Text style={s.sortTxt}>{currentSort.label}</Text>
                <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
              </TouchableOpacity>
              {/* Grid/Liste toggle */}
              <TouchableOpacity style={s.viewToggle} onPress={() => setGridMode((v) => !v)}>
                <Ionicons name={gridMode ? 'list' : 'grid'} size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── İçerik ── */}
        {!hasContent ? (
          <EmptyState
            recentSearches={recentSearches}
            intent={activeIntent}
            onSearch={(s) => { setQuery(s); inputRef.current?.focus(); }}
            onClearRecent={() => setRecentSearches([])}
          />
        ) : isLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : isError ? (
          <ConnectionErrorView onRetry={() => refetch()} />
        ) : products.length === 0 ? (
          <StateView
            kind={hasFilter ? 'search' : 'empty'}
            title={hasFilter ? 'Ürün bulunamadı' : 'Ürün listesi boş'}
            subtitle={
              debouncedQuery
                ? `"${debouncedQuery}" ile eşleşen ürün yok.\nFarklı kelimeler veya daha kısa bir arama deneyin.`
                : 'Sunucuya bağlanılamıyor olabilir.'
            }
            compact
          />
        ) : (
          <FlatList
            key={gridMode ? 'grid' : 'list'}
            data={products}
            keyExtractor={(p) => p.id}
            numColumns={gridMode ? 2 : 1}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.list, gridMode && s.gridList]}
            renderItem={({ item }) => (
              <ProductCard product={item} horizontal={!gridMode} onAddToCart={handleAddToCart} />
            )}
          />
        )}

        {/* ── Sıralama Modal ── */}
        <Modal transparent visible={showSort} animationType="slide" onRequestClose={() => setShowSort(false)}>
          <TouchableOpacity style={s.modalOverlay} onPress={() => setShowSort(false)} activeOpacity={1}>
            <View style={s.sortSheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Sırala</Text>
              {SORT_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[s.sortRow, o.key === sortKey && s.sortRowActive]}
                  onPress={() => { setSortKey(o.key); setShowSort(false); }}
                >
                  <Ionicons name={o.icon as any} size={18} color={o.key === sortKey ? COLORS.primary : '#64748b'} />
                  <Text style={[s.sortRowTxt, o.key === sortKey && { color: COLORS.primary, fontWeight: '700' }]}>
                    {o.label}
                  </Text>
                  {o.key === sortKey && <Ionicons name="checkmark" size={18} color={COLORS.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>

      <MarketPickerModal
        visible={!!picker}
        productId={picker?.productId ?? ''}
        productName={picker?.productName ?? ''}
        onClose={closePicker}
        onConfirm={confirmAdd}
        loading={adding}
      />
    </SafeAreaView>
  );
}

// ── Boş durum bileşeni ──────────────────────────────
function EmptyState({ recentSearches, intent, onSearch, onClearRecent }: {
  recentSearches: string[];
  intent: SearchIntent | null;
  onSearch: (s: string) => void;
  onClearRecent: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={es.container} showsVerticalScrollIndicator={false}>
      {/* Barkod arama */}
      <TouchableOpacity
        style={es.scanCard}
        onPress={() => router.push({
          pathname: '/scan',
          params: intent ? { intent } : {},
        } as any)}
        activeOpacity={0.85}
      >
        <View style={es.scanIcon}>
          <Ionicons name="scan" size={28} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={es.scanTitle}>Barkod ile Tara</Text>
          <Text style={es.scanSub}>Ürün barkodunu tara, anında fiyatları gör</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Son aramalar */}
      {recentSearches.length > 0 && (
        <View style={es.section}>
          <View style={es.sectionHeader}>
            <Text style={es.sectionTitle}>Son Aramalar</Text>
            <TouchableOpacity onPress={onClearRecent}>
              <Text style={es.clearTxt}>Temizle</Text>
            </TouchableOpacity>
          </View>
          <View style={es.chips}>
            {recentSearches.map((r) => (
              <TouchableOpacity key={r} style={es.recentChip} onPress={() => onSearch(r)}>
                <Ionicons name="time-outline" size={12} color="#94a3b8" />
                <Text style={es.recentTxt}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Popüler aramalar */}
      <View style={es.section}>
        <Text style={es.sectionTitle}>Popüler Aramalar</Text>
        <View style={es.chips}>
          {POPULAR.map((p) => (
            <TouchableOpacity key={p} style={es.popularChip} onPress={() => onSearch(p)}>
              <Ionicons name="trending-up" size={12} color={COLORS.primary} />
              <Text style={es.popularTxt}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ── Stiller ────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: '#fff' },
  topBar:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 14, height: 44 },
  input: { flex: 1, fontSize: 14, color: COLORS.text, paddingHorizontal: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },

  intentBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ddd6fe',
  },
  intentBody: { flex: 1 },
  intentTitle: { fontSize: 12, fontWeight: '800' },
  intentText: { fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 15 },

  catRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  breadcrumb: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },

  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  resultCount: { fontSize: 13, color: '#64748b' },
  resultNum: { fontWeight: '700', color: '#1e293b' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  sortTxt: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  viewToggle: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 12 },
  gridList: { padding: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  errTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  errSub:   { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  retryBtn: { marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  typingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f0f9ff', borderBottomWidth: 1, borderBottomColor: '#bae6fd',
  },
  typingTxt: { fontSize: 13, color: '#0369a1', fontWeight: '500' },

  // Sort modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sortSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderRadius: 12, paddingHorizontal: 8 },
  sortRowActive: { backgroundColor: COLORS.primaryLight },
  sortRowTxt: { fontSize: 14, color: '#475569', fontWeight: '500', flex: 1 },
});

const es = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.primaryLight, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  scanIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 14, fontWeight: '700', color: '#1e40af' },
  scanSub:   { fontSize: 12, color: '#3b82f6', marginTop: 2 },
  section:   { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  clearTxt: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f8fafc', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#e2e8f0' },
  recentTxt:   { fontSize: 13, color: '#475569', fontWeight: '500' },
  popularChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  popularTxt:  { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
