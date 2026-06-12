'use client';

import { useState, useEffect, useCallback } from 'react';
import { productsApi, pricesApi } from '../../../lib/api';
import { ManagedMarket } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import api from '../../../lib/api';
import { formatPriceFromKurus, kurusToTlInput, parseTlInput } from '../../../lib/price';
import { ProductPriceDrawer, MarketPriceItem } from '../../../components/market/ProductPriceDrawer';

function freshnessBadge(price: MarketPriceItem, C: ReturnType<typeof useColors>) {
  if (price.needsVerification || price.freshness === 'stale') {
    return { label: 'Doğrulanmadı', color: C.red };
  }
  const updatedAt = price.lastUpdated ?? price.updatedAt ?? '';
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
  if (days === 0) return { label: 'Bugün', color: C.green };
  if (days <= 3) return { label: `${days}g önce`, color: C.green };
  if (days <= 7) return { label: `${days}g önce`, color: C.amber };
  return { label: `${days}g önce`, color: C.red };
}

export default function MarketPricesPage() {
  const C = useColors();
  const [market, setMarket] = useState<ManagedMarket | null>(null);
  const [prices, setPrices] = useState<MarketPriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; brand?: string }[]>([]);
  const [form, setForm] = useState({ productId: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; productId: string; amount: string } | null>(null);
  const [selected, setSelected] = useState<MarketPriceItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') ?? '{}');
      setMarket(u.managedMarket ?? null);
    } catch { /**/ }
  }, []);

  const load = useCallback(async () => {
    if (!market) return;
    setLoading(true);
    try {
      const res = await api.get(`/prices?marketId=${market.id}&limit=100`).then((r) => r.data.data);
      setPrices(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
    } catch {
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = async () => {
    setShowAdd(true);
    try {
      const res = await productsApi.getAll({ limit: 100 } as any);
      setProducts(res?.items ?? []);
    } catch { /**/ }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market || !form.productId || !form.amount) return;
    setSaving(true);
    try {
      await pricesApi.upsert({
        productId: form.productId,
        marketId: market.id,
        amount: parseTlInput(form.amount),
      });
      setShowAdd(false);
      setForm({ productId: '', amount: '' });
      showToast('Fiyat kaydedildi');
      load();
    } catch {
      showToast('Kayıt başarısız', true);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market || !editing) return;
    setSaving(true);
    try {
      await pricesApi.upsert({
        productId: editing.productId,
        marketId: market.id,
        amount: parseTlInput(editing.amount),
      });
      setEditing(null);
      showToast('Fiyat güncellendi');
      load();
    } catch {
      showToast('Güncelleme başarısız', true);
    } finally {
      setSaving(false);
    }
  };

  const filtered = prices.filter((p) =>
    !search ||
    p.product.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.product.brand ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const brand = market?.brandColor ?? '#3b82f6';
  const staleCount = prices.filter((p) => {
    if (p.needsVerification || p.freshness === 'stale') return true;
    const at = p.lastUpdated ?? p.updatedAt;
    if (!at) return false;
    return Math.floor((Date.now() - new Date(at).getTime()) / 86400000) > 7;
  }).length;

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>{toast}</div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brand }}>
            Fiyat Yönetim Merkezi
          </p>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Fiyat Yönetimi</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {market?.name} · {prices.length} ürün fiyatı · Karta tıklayarak detay görün
          </p>
        </div>
        <button onClick={openAdd}
          className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
          style={{ background: brand, color: '#fff' }}>
          + Fiyat Ekle
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Kayıt', value: prices.length, color: brand },
          { label: 'Güncel (7g)', value: prices.length - staleCount, color: C.green },
          { label: 'Eski Kayıt (7g+)', value: staleCount, color: staleCount > 0 ? C.red : C.muted },
          {
            label: 'Bugün Güncellenen',
            value: prices.filter((p) => {
              const at = p.updatedAt ?? p.lastUpdated;
              return at && Math.floor((Date.now() - new Date(at).getTime()) / 86400000) === 0;
            }).length,
            color: C.amber,
          },
        ].map((s) => (
          <div key={s.label} className="fp-card p-4">
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {staleCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}25` }}>
          <span className="text-xl shrink-0">🤖</span>
          <div>
            <p className="text-sm font-bold" style={{ color: C.amber }}>Fiyat Güncellemesi Gerekiyor</p>
            <p className="text-xs mt-0.5" style={{ color: C.text }}>
              {staleCount} ürünün fiyatı 7 günden uzun süredir güncellenmedi.
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base" style={{ color: C.muted }}>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün adı veya marka ara…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fp-card py-16 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="font-bold" style={{ color: C.secondary }}>Fiyat bulunamadı</p>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Yeni fiyat ekleyerek başlayın</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const fresh = freshnessBadge(p, C);
            const img = p.product.imageUrl;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(p)}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(p)}
                className="fp-card overflow-hidden flex flex-col hover:brightness-105 transition-all cursor-pointer group"
                style={{ border: `1px solid ${C.border}` }}
              >
                <div className="h-28 flex items-center justify-center overflow-hidden"
                  style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  {img ? (
                    <img src={img} alt="" className="max-h-full max-w-full object-contain p-3 group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="text-4xl opacity-60">{p.product.category?.icon ?? '📦'}</span>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-sm font-bold line-clamp-2" style={{ color: C.text }}>{p.product.name}</p>
                    {p.product.brand && (
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>{p.product.brand}</p>
                    )}
                    {p.product.unit && (
                      <p className="text-xs" style={{ color: C.muted }}>
                        {p.product.unitValue} {p.product.unit}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end justify-between mt-auto">
                    <div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: brand }}>
                        {formatPriceFromKurus(p.amount)}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded mt-1 inline-block"
                        style={{ background: `${fresh.color}15`, color: fresh.color }}>
                        {fresh.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing({ id: p.id, productId: p.product.id, amount: kurusToTlInput(p.amount) });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: `${brand}15`, color: brand }}>
                      Güncelle
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && market && (
        <ProductPriceDrawer
          price={selected}
          market={market}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); showToast('Fiyat güncellendi'); }}
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="font-bold" style={{ color: C.text }}>Yeni Fiyat Ekle</p>
              <button type="button" onClick={() => setShowAdd(false)} style={{ color: C.muted }}>✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: C.muted }}>Ürün</label>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required
                  className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}>
                  <option value="">Ürün seçin…</option>
                  {products.map((pr) => (
                    <option key={pr.id} value={pr.id}>{pr.brand ? `${pr.brand} - ` : ''}{pr.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: C.muted }}>Fiyat (₺)</label>
                <input type="number" step="0.01" min="0" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} required
                  placeholder="0.00"
                  className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  İptal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: brand }}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="font-bold" style={{ color: C.text }}>Hızlı Fiyat Güncelle</p>
              <button type="button" onClick={() => setEditing(null)} style={{ color: C.muted }}>✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: C.muted }}>
                  Yeni Fiyat (₺)
                </label>
                <input type="number" step="0.01" min="0" value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })} required
                  className="w-full rounded-xl px-3 py-3 text-2xl font-bold outline-none text-center"
                  style={{ background: C.cardAlt, border: `1px solid ${brand}`, color: brand }} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>İptal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: brand }}>{saving ? '…' : 'Güncelle'}</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const item = prices.find((x) => x.id === editing.id);
                  if (item) { setEditing(null); setSelected(item); }
                }}
                className="w-full text-xs font-semibold py-2"
                style={{ color: C.muted }}
              >
                Ürün kartını aç →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
