'use client';

import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '../../../lib/api';
import { Category, ManagedMarket, PaginatedResponse, Product } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import { CategoryFilterChips, CategorySelect, formatCategoryLabel, ActiveFilterTag } from '../../../components/CategorySelect';
import { CategoryScanModal } from '../../../components/products/CategoryScanModal';

export default function MarketCategoriesPage() {
  const C = useColors();
  const [market, setMarket] = useState<ManagedMarket | null>(null);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [showScan, setShowScan] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filterCategoryId = subCategoryId || parentCategoryId;
  const brand = market?.brandColor ?? '#3b82f6';

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') ?? '{}');
      setMarket(u.managedMarket ?? null);
    } catch { /**/ }
    productsApi.getCategories().then(setCategoryTree).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProducts = useCallback(async () => {
    if (!market) return;
    setLoading(true);
    try {
      const result = await productsApi.getAll({
        marketId: market.id,
        search: debouncedSearch || undefined,
        categoryId: filterCategoryId || undefined,
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
        page,
        limit: 30,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [market, debouncedSearch, filterCategoryId, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleCategoryChange = async (productId: string, categoryId: string) => {
    if (!categoryId) return;
    setSavingId(productId);
    try {
      await productsApi.update(productId, { categoryId });
      showToast('Kategori güncellendi');
      fetchProducts();
    } catch {
      showToast('Kategori güncellenemedi', true);
    } finally {
      setSavingId(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div style={{ color: C.text, maxWidth: 1100 }} className="space-y-5">
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          {toast}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: brand }}>
              Katalog Kategorileme
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Ürün Kategorileri</h1>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {market?.name ?? 'Market'} kataloğundaki ürünlerin kategori atamalarını yönetin
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScan(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: '#f59e0b18', border: '1px solid #f59e0b30', color: '#f59e0b' }}
          >
            🔍 Kategori Tara
          </button>
        </div>

        <div className="px-6 pb-5 space-y-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="pt-4 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Katalog ürünlerinde ara…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>

          {categoryTree.length > 0 && (
            <CategoryFilterChips
              tree={categoryTree}
              parentId={parentCategoryId}
              categoryId={subCategoryId}
              onParentChange={(id) => { setParentCategoryId(id); setSubCategoryId(''); setPage(1); }}
              onCategoryChange={(id) => { setSubCategoryId(id); setPage(1); }}
            />
          )}

          {(filterCategoryId || debouncedSearch) && (
            <div className="flex flex-wrap gap-2">
              {debouncedSearch && (
                <ActiveFilterTag label={`"${debouncedSearch}"`} onRemove={() => setSearch('')} />
              )}
              {filterCategoryId && (
                <ActiveFilterTag
                  label={categoryTree.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.id === filterCategoryId)?.name ?? 'Kategori'}
                  onRemove={() => { setParentCategoryId(''); setSubCategoryId(''); setPage(1); }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
          <p className="text-sm font-semibold" style={{ color: C.text }}>
            {loading ? 'Yükleniyor…' : `${data?.total ?? 0} ürün`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-bold" style={{ color: C.secondary }}>Ürün bulunamadı</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>Filtreleri değiştirin veya kataloğa fiyat ekleyin</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: C.border }}>
            {items.map((p) => (
              <div key={p.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{p.name}</p>
                  <p className="text-xs truncate" style={{ color: C.muted }}>{p.brand ?? 'Marka yok'}</p>
                  {p.category && (
                    <p className="text-[10px] mt-1 font-medium" style={{ color: C.muted }}>
                      Mevcut: {formatCategoryLabel(p.category)}
                    </p>
                  )}
                </div>
                <div className="w-full sm:w-64 flex-shrink-0">
                  <CategorySelect
                    tree={categoryTree}
                    value={p.categoryId}
                    onChange={(id) => handleCategoryChange(p.id, id)}
                    allowEmpty={false}
                    emptyLabel="Kategori seç"
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${savingId === p.id ? 'opacity-50 pointer-events-none' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {(data?.totalPages ?? 0) > 1 && (
          <div className="px-5 py-4 flex items-center justify-center gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
            >
              ← Önceki
            </button>
            <span className="text-xs" style={{ color: C.muted }}>{page} / {data?.totalPages}</span>
            <button
              type="button"
              disabled={!data?.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>

      {showScan && market && (
        <CategoryScanModal
          onClose={() => setShowScan(false)}
          onApplied={fetchProducts}
          scopeLabel={`${market.name} kataloğu`}
        />
      )}
    </div>
  );
}
