'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  productsApi, pricesByProductApi, marketsApi, reportsApi,
  ProductSortBy, SortOrder, ProductDetail, ProductMarketPrice,
} from '../../../lib/api';
import { Product, Category, PaginatedResponse, Market, Report } from '../../../types';
import { CategoryFilterChips, CategorySelect, formatCategoryLabel, ActiveFilterTag, StatusSegment } from '../../../components/CategorySelect';
import { BarcodeInputField } from '../../../components/BarcodeInputField';
import { CategoryScanModal } from '../../../components/products/CategoryScanModal';
import { useColors } from '../../../context/ThemeContext';

// ─── SKT Badge ────────────────────────────────────────────────────────────────
function SktBadge({ date, compact }: { date: Date; compact?: boolean }) {
  const now  = Date.now();
  const days = Math.ceil((date.getTime() - now) / 86400000);
  let bg = '#f0fdf4'; let color = '#16a34a'; let icon = '✓';
  if (days < 0)  { bg = '#fef2f2'; color = '#dc2626'; icon = '⚠'; }
  else if (days <= 7)  { bg = '#fff7ed'; color = '#ea580c'; icon = '🔴'; }
  else if (days <= 30) { bg = '#fefce8'; color = '#ca8a04'; icon = '🟡'; }
  const label = compact
    ? date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : (days < 0 ? `${Math.abs(days)}g geçti` : days === 0 ? 'Bugün' : `${days}g kaldı`);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: bg, color }}>
      {icon} {label}
    </span>
  );
}

// ─── Fiyat Tablo ─────────────────────────────────────────────────────────────
function FiyatSatiri({ p, C }: { p: ProductMarketPrice; C: ReturnType<typeof useColors> }) {
  const daysAgo = Math.floor((Date.now() - new Date(p.lastUpdated).getTime()) / 86400000);
  const stale   = daysAgo > 7;
  const priceStr = (p.amount / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl"
      style={{ background: stale ? '#f9731608' : C.cardAlt, border: `1px solid ${stale ? '#f9731620' : C.border}` }}>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: p.market.brandColor ?? '#6366f1' }}>
          {p.market.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-semibold" style={{ color: C.text }}>{p.market.name}</span>
        {!p.isAvailable && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
            style={{ background: '#f8717118', color: '#f87171' }}>Stokta yok</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-black tabular-nums" style={{ color: C.blue }}>{priceStr}</span>
        <span className="text-[10px]" style={{ color: stale ? '#f97316' : C.muted }}>
          {daysAgo === 0 ? 'Bugün' : `${daysAgo}g önce`}
        </span>
      </div>
    </div>
  );
}

// ─── Ürün Detay Drawer ────────────────────────────────────────────────────────
function UrunDrawer({
  product,
  markets,
  categoryTree,
  onClose,
  onRefresh,
  C,
}: {
  product: Product;
  markets: Market[];
  categoryTree: Category[];
  onClose: () => void;
  onRefresh: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const [detail,    setDetail]    = useState<ProductDetail | null>(null);
  const [prices,    setPrices]    = useState<ProductMarketPrice[]>([]);
  const [reports,   setReports]   = useState<Report[]>([]);
  const [loadDet,   setLoadDet]   = useState(true);
  const [tab,       setTab]       = useState<'genel' | 'fiyat' | 'ihbar' | 'duzenle'>('genel');
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);

  // Düzenleme alanları
  const [editName,  setEditName]  = useState(product.name);
  const [editBrand, setEditBrand] = useState(product.brand ?? '');
  const [editUnit,  setEditUnit]  = useState(product.unit ?? '');
  const [editCategoryId, setEditCategoryId] = useState(product.categoryId);
  const [editActive, setEditActive] = useState(product.isActive);
  const [newBarcode, setNewBarcode] = useState('');
  const [addingBarcode, setAddingBarcode] = useState(false);

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    Promise.all([
      productsApi.getOne(product.id),
      pricesByProductApi.getForProduct(product.id),
      reportsApi.getAll({ page: 1, limit: 20 }),
    ]).then(([det, priceData, reps]) => {
      setDetail(det);
      setPrices(priceData.prices);
      // product'a ait raporları filtrele
      setReports((reps.items as Report[]).filter((r) => r.product?.id === product.id));
    }).catch(() => {}).finally(() => setLoadDet(false));
  }, [product.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await productsApi.update(product.id, {
        name: editName,
        brand: editBrand || undefined,
        unit: editUnit || undefined,
        categoryId: editCategoryId,
        isActive: editActive,
      });
      showToast('Ürün güncellendi');
      onRefresh();
    } catch { showToast('Güncelleme başarısız', true); }
    finally { setSaving(false); }
  };

  const handleAddBarcode = async () => {
    if (!newBarcode.trim()) return;
    setAddingBarcode(true);
    try {
      await productsApi.addBarcode(product.id, newBarcode.trim());
      showToast(`Barkod eklendi: ${newBarcode.trim()}`);
      setNewBarcode('');
      // Detayı yenile
      const det = await productsApi.getOne(product.id);
      setDetail(det);
    } catch { showToast('Barkod eklenemedi', true); }
    finally { setAddingBarcode(false); }
  };

  const cat = detail?.category;
  const catLabel = cat?.parent ? `${cat.parent.name} › ${cat.name}` : cat?.name ?? '—';

  const TABS = [
    { id: 'genel'   as const, icon: '📦', label: 'Genel' },
    { id: 'fiyat'   as const, icon: '💰', label: `Fiyatlar (${prices.length})` },
    { id: 'ihbar'   as const, icon: '🚨', label: `İhbarlar (${reports.length})` },
    { id: 'duzenle' as const, icon: '✏️', label: 'Düzenle' },
  ];

  // Market coverage
  const coveredMarketIds = new Set(prices.map((p) => p.market.id));
  const uncoveredMarkets = markets.filter((m) => !coveredMarketIds.has(m.id));

  return (
    <div className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      {toast && (
        <div className="fixed top-5 right-5 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
          {toast}
        </div>
      )}

      <div className="ml-auto w-full max-w-md h-full flex flex-col overflow-hidden"
        style={{ background: C.card, borderLeft: `1px solid ${C.border}` }}>

        {/* ── Başlık ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}25` }}>
                📦
              </div>
              <div className="min-w-0">
                <p className="font-bold text-base truncate" style={{ color: C.text }}>{product.name}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>
                  {product.brand ?? 'Marka yok'}{product.unit ? ` · ${product.unit}` : ''}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${product.isActive ? '' : ''}`}
                    style={{ background: product.isActive ? '#34d39918' : '#f8717118', color: product.isActive ? '#34d399' : '#f87171' }}>
                    {product.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                  {cat && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: `${C.blue}12`, color: C.blue }}>{catLabel}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: C.cardAlt, color: C.muted }}>✕</button>
          </div>

          {/* Sekmeler */}
          <div className="flex gap-0.5">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 text-[10px] font-bold transition-all rounded-t-lg flex flex-col items-center gap-0.5"
                style={tab === t.id
                  ? { color: C.blue, background: C.card, borderBottom: `2px solid ${C.blue}`, marginBottom: -1 }
                  : { color: C.muted, borderBottom: '2px solid transparent', marginBottom: -1, background: 'transparent' }}>
                <span>{t.icon}</span>
                <span className="leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── İçerik ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3"
          style={{ borderTop: `1px solid ${C.border}` }}>

          {loadDet ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }} />
            </div>
          ) : (

            /* GENEL */
            tab === 'genel' ? (
              <>
                {/* Ürün bilgileri */}
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Ürün Bilgileri</p>
                  </div>
                  {([
                    { icon: '📦', label: 'Ürün Adı',   value: detail?.name ?? product.name },
                    { icon: '🏷', label: 'Marka',       value: detail?.brand ?? '—' },
                    { icon: '⚖️', label: 'Birim',       value: detail?.unit ?? '—' },
                    { icon: '🗂', label: 'Kategori',    value: catLabel },
                    { icon: '📅', label: 'Eklenme',     value: new Date(product.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                    { icon: '🆔', label: 'ID',           value: product.id },
                  ] as const).map((row) => (
                    <div key={row.label} className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderBottom: `1px solid ${C.border}` }}>
                      <span className="text-base w-6 text-center flex-shrink-0">{row.icon}</span>
                      <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: C.muted }}>{row.label}</span>
                      <span className="text-xs font-medium truncate font-mono" style={{ color: row.label === 'ID' ? C.muted : C.text }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* SKT */}
                {(detail as any)?.nearestExpiryDate && (
                  <div className="p-3 rounded-2xl flex items-center gap-3"
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <span className="text-2xl">🗓</span>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#ea580c' }}>Son Kullanma Tarihi (SKT)</p>
                      <p className="text-sm font-black mt-0.5" style={{ color: '#c2410c' }}>
                        {new Date((detail as any).nearestExpiryDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <SktBadge date={new Date((detail as any).nearestExpiryDate)} />
                    </div>
                  </div>
                )}

                {/* Barkodlar */}
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5 flex items-center justify-between"
                    style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Barkodlar</p>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                      style={{ background: `${C.blue}15`, color: C.blue }}>
                      {(detail?.barcodes ?? []).length} adet
                    </span>
                  </div>
                  {(detail?.barcodes ?? []).length === 0 ? (
                    <div className="px-4 py-4 text-center">
                      <p className="text-xs" style={{ color: C.muted }}>Barkod yok</p>
                    </div>
                  ) : (
                    (detail?.barcodes ?? []).map((b) => (
                      <div key={b.id} className="flex items-center gap-3 px-4 py-2.5"
                        style={{ borderBottom: `1px solid ${C.border}` }}>
                        <span className="text-sm">🔖</span>
                        <code className="text-xs font-mono flex-1" style={{ color: C.text }}>{b.code}</code>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                          style={{ background: C.cardAlt, color: C.muted }}>{b.format}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Market Kapsamı */}
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5 flex items-center justify-between"
                    style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Market Kapsamı</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: '#34d39918', color: '#34d399' }}>{prices.length} market</span>
                      {uncoveredMarkets.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: '#f8717118', color: '#f87171' }}>{uncoveredMarkets.length} eksik</span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="px-4 py-3">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: C.cardAlt }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${markets.length ? (prices.length / markets.length) * 100 : 0}%`, background: '#34d399' }} />
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: C.muted }}>
                      {markets.length} marketten {prices.length} tanesi fiyatlanmış
                    </p>
                  </div>
                </div>
              </>
            )

            /* FİYATLAR */
            : tab === 'fiyat' ? (
              <>
                {prices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-3xl mb-3">💰</p>
                    <p className="font-bold" style={{ color: C.secondary }}>Fiyat girişi yok</p>
                    <p className="text-xs mt-1" style={{ color: C.muted }}>Hiçbir market bu ürün için fiyat girmemiş</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: C.muted }}>
                      Fiyat Veren Marketler
                    </p>
                    {prices.map((p) => <FiyatSatiri key={p.id} p={p} C={C} />)}
                  </div>
                )}

                {uncoveredMarkets.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-2" style={{ color: C.muted }}>
                      Fiyat Girmeyen Marketler
                    </p>
                    <div className="space-y-1.5">
                      {uncoveredMarkets.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                          style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ background: m.brandColor ?? '#94a3b8' }}>
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm flex-1" style={{ color: C.muted }}>{m.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: '#f8717118', color: '#f87171' }}>Fiyatsız</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )

            /* İHBARLAR */
            : tab === 'ihbar' ? (
              <>
                {reports.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-3xl mb-3">🚨</p>
                    <p className="font-bold" style={{ color: C.secondary }}>İhbar kaydı yok</p>
                    <p className="text-xs mt-1" style={{ color: C.muted }}>Bu ürüne ait ihbar bulunmuyor</p>
                  </div>
                ) : (
                  reports.map((r) => {
                    const statusCfg: Record<string, { bg: string; color: string; label: string }> = {
                      PENDING:      { bg: '#f59e0b18', color: '#f59e0b', label: 'Bekliyor' },
                      UNDER_REVIEW: { bg: '#60a5fa18', color: '#60a5fa', label: 'İncelemede' },
                      APPROVED:     { bg: '#34d39918', color: '#34d399', label: 'Onaylandı' },
                      REJECTED:     { bg: '#f8717118', color: '#f87171', label: 'Reddedildi' },
                      PUSHED_TO_MARKET: { bg: '#a78bfa18', color: '#a78bfa', label: 'İletildi' },
                    };
                    const sc = statusCfg[r.status] ?? { bg: C.cardAlt, color: C.muted, label: r.status };
                    return (
                      <div key={r.id} className="p-3 rounded-2xl"
                        style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          <span className="text-[10px]" style={{ color: C.muted }}>
                            {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-xs line-clamp-2" style={{ color: C.text }}>{r.description}</p>
                        {r.expiryDate && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: C.muted }}>SKT:</span>
                            <SktBadge date={new Date(r.expiryDate)} compact />
                          </div>
                        )}
                        {r.market && (
                          <p className="text-[10px] mt-1" style={{ color: C.muted }}>🏪 {r.market.name}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )

            /* DÜZENLE */
            : tab === 'duzenle' ? (
              <div className="space-y-4">
                {/* Temel bilgiler */}
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Temel Bilgiler</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { label: 'Ürün Adı',  value: editName,  set: setEditName,  placeholder: 'Ürün adı' },
                      { label: 'Marka',     value: editBrand, set: setEditBrand, placeholder: 'Marka adı' },
                      { label: 'Birim/Ağırlık', value: editUnit, set: setEditUnit, placeholder: 'ör: 500g, 1L' },
                    ].map(({ label, value, set, placeholder }) => (
                      <div key={label}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.muted }}>{label}</p>
                        <input value={value} onChange={(e) => set(e.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                          style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
                      </div>
                    ))}

                    {categoryTree.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: C.muted }}>Kategori</p>
                        <CategorySelect
                          tree={categoryTree}
                          value={editCategoryId}
                          onChange={setEditCategoryId}
                          allowEmpty={false}
                          emptyLabel="Kategori seçin"
                        />
                      </div>
                    )}

                    {/* Aktif/Pasif toggle */}
                    <div className="flex items-center justify-between py-2">
                      <p className="text-sm font-semibold" style={{ color: C.text }}>Durum</p>
                      <button
                        onClick={() => setEditActive((v) => !v)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={editActive
                          ? { background: '#34d39918', border: '1px solid #34d39930', color: '#34d399' }
                          : { background: '#f8717118', border: '1px solid #f8717130', color: '#f87171' }}>
                        {editActive ? '✓ Aktif' : '✕ Pasif'}
                      </button>
                    </div>

                    <button onClick={handleSave} disabled={saving}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                      style={{ background: C.blue }}>
                      {saving ? 'Kaydediliyor…' : '💾 Değişiklikleri Kaydet'}
                    </button>
                  </div>
                </div>

                {/* Barkod ekle */}
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Barkod Ekle</p>
                  </div>
                  <div className="p-4 space-y-2">
                    <BarcodeInputField
                      value={newBarcode}
                      onChange={setNewBarcode}
                      showHint={false}
                      inputClassName="rounded-xl px-3 py-2 text-sm outline-none font-mono"
                      inputStyle={{
                        background: C.cardAlt,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                      }}
                    />
                    <button onClick={handleAddBarcode} disabled={addingBarcode || !newBarcode.trim()}
                      className="w-full px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                      style={{ background: C.blue }}>
                      {addingBarcode ? '…' : '+ Barkodu Kaydet'}
                    </button>
                  </div>
                  {/* Mevcut barkodlar */}
                  {(detail?.barcodes ?? []).map((b) => (
                    <div key={b.id} className="flex items-center gap-2 px-4 py-2"
                      style={{ borderTop: `1px solid ${C.border}` }}>
                      <code className="text-xs font-mono flex-1" style={{ color: C.muted }}>{b.code}</code>
                      <span className="text-[10px]" style={{ color: C.muted }}>{b.format}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Ürün Kartı ───────────────────────────────────────────────────────────────
function UrunKarti({
  product,
  onClick,
  C,
}: {
  product: Product;
  onClick: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const nex = (product as any).nearestExpiryDate;
  const hasSkt = !!nex;
  const sktDays = hasSkt ? Math.ceil((new Date(nex).getTime() - Date.now()) / 86400000) : null;
  const urgent  = sktDays !== null && sktDays <= 7;

  return (
    <div onClick={onClick}
      className="group cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: C.card,
        border: urgent ? '1.5px solid #ea580c40' : `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: urgent ? '0 0 0 2px #ea580c10' : '0 1px 4px rgba(0,0,0,0.05)',
      }}>

      {/* Üst renk şerit */}
      <div className="h-1" style={{ background: urgent ? '#ea580c' : product.isActive ? '#6366f1' : '#94a3b8' }} />

      <div className="p-4">
        {/* Görsel + Başlık */}
        <div className="flex items-start gap-3 mb-3">
          {product.imageUrl ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-50 border"
              style={{ borderColor: C.border }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageUrl} alt="" className="w-full h-full object-contain p-1" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg flex-shrink-0 font-black"
              style={{ background: urgent ? '#fff7ed' : `${C.blue}12`, color: C.blue }}>
              {product.brand?.charAt(0) ?? (urgent ? '⚠️' : '📦')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight line-clamp-2" style={{ color: C.text }}>{product.name}</p>
            <p className="text-[11px] truncate mt-0.5" style={{ color: C.muted }}>
              {product.brand ? (
                <span className="font-bold" style={{ color: C.blue }}>{product.brand}</span>
              ) : 'Marka yok'}
              {product.unit ? ` · ${product.unitValue ?? ''} ${product.unit}`.trim() : ''}
            </p>
          </div>
          <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
            style={{ background: product.isActive ? '#34d399' : '#f87171' }} />
        </div>

        {/* Kategori */}
        {product.category && (
          <div className="mb-2.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${C.blue}12`, color: C.blue }}>
              {formatCategoryLabel(product.category)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          {hasSkt ? (
            <SktBadge date={new Date(nex)} compact />
          ) : (
            <span className="text-[10px]" style={{ color: C.muted }}>SKT yok</span>
          )}
          <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            style={{ color: C.blue }}>Detay →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
const SORT_OPTIONS: { value: ProductSortBy; label: string }[] = [
  { value: 'createdAt',  label: 'Eklenme' },
  { value: 'name',       label: 'İsim' },
  { value: 'brand',      label: 'Marka' },
  { value: 'category',   label: 'Kategori' },
  { value: 'expiryDate', label: 'SKT' },
];

export default function ProductsPage() {
  const C = useColors();

  const [data,              setData]              = useState<PaginatedResponse<Product> | null>(null);
  const [productStats,      setProductStats]      = useState<{ total: number; active: number; inactive: number; sktNearby30: number } | null>(null);
  const [statsReady,        setStatsReady]        = useState(false);
  const [categoryTree,      setCategoryTree]      = useState<Category[]>([]);
  const [markets,           setMarkets]           = useState<Market[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [search,            setSearch]            = useState('');
  const [debouncedSearch,   setDebouncedSearch]   = useState('');
  const [status,            setStatus]            = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy,            setSortBy]            = useState<ProductSortBy>('createdAt');
  const [sortOrder,         setSortOrder]         = useState<SortOrder>('desc');
  const [page,              setPage]              = useState(1);
  const [parentCategoryId,  setParentCategoryId]  = useState('');
  const [subCategoryId,     setSubCategoryId]     = useState('');
  const [marketFilter,      setMarketFilter]      = useState('');
  const [viewMode,          setViewMode]          = useState<'grid' | 'table'>('table');
  const [selectedProduct,   setSelectedProduct]   = useState<Product | null>(null);
  const [showCatModal,      setShowCatModal]      = useState(false);

  const filterCategoryId = subCategoryId || parentCategoryId;

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    productsApi.getCategories().then((cats: Category[]) => setCategoryTree(cats)).catch(() => {});
    marketsApi.getAll().then(setMarkets).catch(() => {});
    productsApi.getStats()
      .then((s) => { setProductStats(s); setStatsReady(true); })
      .catch(() => setStatsReady(true)); // hata olsa bile skeleton'ı durdur
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const isActive = status === 'all' ? undefined : status === 'active';
      const result = await productsApi.getAll({
        search: debouncedSearch || undefined,
        categoryId: filterCategoryId || undefined,
        marketId: marketFilter || undefined,
        isActive,
        sortBy,
        sortOrder,
        page,
        limit: viewMode === 'grid' ? 24 : 20,
      });
      setData(result);
    } catch {}
    finally { setLoading(false); }
  }, [debouncedSearch, filterCategoryId, marketFilter, status, sortBy, sortOrder, page, viewMode]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const resetFilters = () => {
    setSearch(''); setParentCategoryId(''); setSubCategoryId('');
    setStatus('all'); setSortBy('createdAt'); setSortOrder('desc');
    setMarketFilter(''); setPage(1);
  };

  const items            = data?.items ?? [];
  const hasActiveFilters = search || filterCategoryId || status !== 'all' || sortBy !== 'createdAt' || marketFilter;

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {/* ── Komut Başlığı ────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}>

        <div className="px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.blue }}>
              Ürün Yönetim Merkezi
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Ürünler</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Kategori Tarama */}
            <button onClick={() => setShowCatModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              style={{ background: '#f59e0b18', border: '1px solid #f59e0b30', color: '#f59e0b' }}>
              🔍 Kategori Tara
            </button>
            {/* Grid/Tablo toggle */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {(['table', 'grid'] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)}
                  className="px-3 py-2 text-xs font-bold transition-all"
                  style={viewMode === m
                    ? { background: C.blue, color: '#fff' }
                    : { background: C.card, color: C.secondary }}>
                  {m === 'table' ? '≡' : '⊞'}
                </button>
              ))}
            </div>
            <a href="/products/new"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
              style={{ background: C.blue }}>
              ➕ Yeni Ürün
            </a>
          </div>
        </div>

        {/* Özet metrikler şeridi */}
        <div className="grid grid-cols-2 sm:grid-cols-4"
          style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { icon: '📦', label: 'Toplam Ürün',  value: productStats?.total      ?? data?.total ?? 0, color: C.blue },
            { icon: '✅', label: 'Aktif',        value: productStats?.active      ?? 0,               color: '#34d399' },
            { icon: '⚠️', label: 'SKT Yakın',   value: productStats?.sktNearby30 ?? 0,               color: '#f59e0b' },
            { icon: '🏪', label: 'Market',       value: markets.length,                               color: '#a78bfa' },
          ].map((m, i) => (
            <div key={m.label} className="px-5 py-4 flex items-center gap-3"
              style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: `${m.color}15` }}>
                {m.icon}
              </div>
              <div>
                {!statsReady && m.label !== 'Market' ? (
                  <div className="h-5 w-12 rounded animate-pulse mb-0.5" style={{ background: `${m.color}30` }} />
                ) : (
                  <p className="text-xl font-black tabular-nums leading-none" style={{ color: m.color }}>
                    {(typeof m.value === 'number' ? m.value : 0).toLocaleString('tr-TR')}
                  </p>
                )}
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: C.muted }}>{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Arama + Filtreler */}
        <div className="px-5 py-3 space-y-3" style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
          {/* 1. satır: arama + market filtre */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Ürün adı, marka veya barkod ara…"
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            {/* Market filtre */}
            <select value={marketFilter} onChange={(e) => { setMarketFilter(e.target.value); setPage(1); }}
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
              <option value="">Tüm Marketler</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* 2. satır: kategori + durum + sıralama */}
          {categoryTree.length > 0 && (
            <CategoryFilterChips
              tree={categoryTree}
              parentId={parentCategoryId}
              categoryId={subCategoryId}
              onParentChange={(id) => { setParentCategoryId(id); setSubCategoryId(''); setPage(1); }}
              onCategoryChange={(id) => { setSubCategoryId(id); setPage(1); }}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <StatusSegment value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
            <div className="flex items-center gap-2 ml-auto">
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as ProductSortBy); setPage(1); }}
                className="rounded-xl px-3 py-2 text-xs outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button onClick={() => { setSortOrder((o) => o === 'asc' ? 'desc' : 'asc'); setPage(1); }}
                className="px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
                {sortOrder === 'asc' ? '↑ Artan' : '↓ Azalan'}
              </button>
              {hasActiveFilters && (
                <button onClick={resetFilters}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ color: C.muted }}>
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Aktif filtre etiketleri */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {search && <ActiveFilterTag label={`"${search}"`} onRemove={() => { setSearch(''); setPage(1); }} />}
              {filterCategoryId && <ActiveFilterTag label={categoryTree.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.id === filterCategoryId)?.name ?? 'Kategori'} onRemove={() => { setParentCategoryId(''); setSubCategoryId(''); setPage(1); }} />}
              {status !== 'all' && <ActiveFilterTag label={status === 'active' ? 'Aktif' : 'Pasif'} onRemove={() => { setStatus('all'); setPage(1); }} />}
              {marketFilter && <ActiveFilterTag label={markets.find((m) => m.id === marketFilter)?.name ?? 'Market'} onRemove={() => { setMarketFilter(''); setPage(1); }} />}
            </div>
          )}
        </div>
      </div>

      {/* ── İçerik ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl py-20 text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p className="text-5xl mb-4">📦</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>
            {hasActiveFilters ? 'Eşleşen ürün bulunamadı' : 'Henüz ürün yok'}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-3 text-xs font-semibold underline" style={{ color: C.blue }}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((p) => (
            <UrunKarti key={p.id} product={p} onClick={() => setSelectedProduct(p)} C={C} />
          ))}
        </div>
      ) : (
        /* TABLO GÖRÜNÜMÜ */
        <div className="rounded-2xl overflow-hidden"
          style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full">
            <thead style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              <tr>
                {['Ürün', 'Marka', 'Kategori', 'Barkod', 'SKT', 'Durum', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest"
                    style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p, i) => {
                const nex     = (p as any).nearestExpiryDate;
                const barcodes = (p as any).barcodes ?? [];
                return (
                  <tr key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="cursor-pointer transition-all hover:brightness-95"
                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: C.text }}>{p.name}</p>
                      {p.unit && <p className="text-[11px]" style={{ color: C.muted }}>{p.unit}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.secondary }}>{p.brand ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${C.blue}12`, color: C.blue }}>
                          {formatCategoryLabel(p.category)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {barcodes[0] ? (
                        <code className="text-xs px-2 py-0.5 rounded"
                          style={{ background: C.cardAlt, color: C.secondary }}>
                          {barcodes[0].code}
                        </code>
                      ) : <span style={{ color: C.muted }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {nex ? <SktBadge date={new Date(nex)} compact /> : <span style={{ color: C.muted }} className="text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: p.isActive ? '#34d39918' : '#f8717118', color: p.isActive ? '#34d399' : '#f87171' }}>
                        {p.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[11px] font-bold" style={{ color: C.blue }}>Detay →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Sayfalama */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${C.border}` }}>
              <p className="text-xs" style={{ color: C.muted }}>
                {data.total.toLocaleString('tr-TR')} ürün · Sayfa {page}/{data.totalPages}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 transition-all"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  ← Önceki
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 text-white transition-all"
                  style={{ background: C.blue }}>
                  Sonraki →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid sayfalama */}
      {viewMode === 'grid' && data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: C.muted }}>
            {data.total.toLocaleString('tr-TR')} ürün · Sayfa {page}/{data.totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition-all"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
              ← Önceki
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 text-white transition-all"
              style={{ background: C.blue }}>
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/* Ürün Detay Drawer */}
      {selectedProduct && (
        <UrunDrawer
          product={selectedProduct}
          markets={markets}
          categoryTree={categoryTree}
          onClose={() => setSelectedProduct(null)}
          onRefresh={() => { fetchProducts(); setSelectedProduct(null); }}
          C={C}
        />
      )}

      {/* Kategori Tarama Modalı */}
      {showCatModal && (
        <CategoryScanModal
          onClose={() => setShowCatModal(false)}
          onApplied={() => { fetchProducts(); setProductStats(null); setStatsReady(false); productsApi.getStats().then((s) => { setProductStats(s); setStatsReady(true); }).catch(() => setStatsReady(true)); }}
        />
      )}
    </div>
  );
}
