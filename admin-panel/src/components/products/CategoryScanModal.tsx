'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { useColors } from '@/context/ThemeContext';

export type CategorySuggestion = {
  productId: string;
  productName: string;
  brand: string | null;
  currentCategoryId: string;
  currentCategoryName: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
};

interface Props {
  onClose: () => void;
  onApplied: () => void;
  /** Market panelinde katalog kapsamini belirtir */
  scopeLabel?: string;
}

export function CategoryScanModal({ onClose, onApplied, scopeLabel }: Props) {
  const C = useColors();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    productsApi.getCategorySuggestions()
      .then((r) => {
        setSuggestions(r.suggestions);
        setTotal(r.total);
        setSelected(new Set(r.suggestions.map((s) => s.productId)));
      })
      .catch(() => setToast('API bağlantı hatası — ürünler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const toggleAll = () => {
    if (selected.size === suggestions.length) setSelected(new Set());
    else setSelected(new Set(suggestions.map((s) => s.productId)));
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleApply = async () => {
    const fixes = suggestions
      .filter((s) => selected.has(s.productId))
      .map((s) => ({ productId: s.productId, categoryId: s.suggestedCategoryId }));
    if (!fixes.length) return;
    setApplying(true);
    try {
      const result = await productsApi.applyCategories(fixes);
      setToast(`✓ ${result.updated} ürünün kategorisi güncellendi`);
      setDone(true);
      setTimeout(() => { onApplied(); onClose(); }, 2200);
    } catch {
      setToast('Güncelleme başarısız — tekrar deneyin');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && !applying && onClose()}
    >
      {toast && (
        <div
          className="fixed top-5 right-5 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          {toast}
        </div>
      )}

      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: C.card, border: `1px solid ${C.border}`, maxHeight: '88vh' }}
      >
        <div
          className="flex-shrink-0 px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}
        >
          <div>
            <p className="font-bold text-base" style={{ color: C.text }}>Kategori Tarama</p>
            {scopeLabel && (
              <p className="text-[10px] mt-0.5 font-semibold" style={{ color: C.blue }}>{scopeLabel}</p>
            )}
            {!loading && (
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                {total.toLocaleString('tr-TR')} üründen{' '}
                <span className="font-bold" style={{ color: suggestions.length > 0 ? '#f59e0b' : '#34d399' }}>
                  {suggestions.length}
                </span>{' '}
                yanlış kategorize edilmiş
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !applying && onClose()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: C.card, color: C.muted }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 animate-spin"
                style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }}
              />
              <p className="text-sm" style={{ color: C.muted }}>Ürünler analiz ediliyor…</p>
            </div>
          ) : done ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-4xl">✅</p>
              <p className="font-bold text-lg" style={{ color: C.text }}>Kategoriler güncellendi!</p>
              <p className="text-xs" style={{ color: C.muted }}>Sayfa yenileniyor…</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-4xl">🎉</p>
              <p className="font-bold text-lg" style={{ color: C.text }}>Tüm ürünler doğru kategoride!</p>
              <p className="text-xs" style={{ color: C.muted }}>Kategori uyumsuzluğu bulunamadı</p>
            </div>
          ) : (
            <>
              <div
                className="px-5 py-3 flex items-center justify-between sticky top-0 z-10"
                style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}
              >
                <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-xs font-semibold" style={{ color: C.blue }}>
                  <div
                    className="w-4 h-4 rounded border-2 flex items-center justify-center"
                    style={{ borderColor: C.blue, background: selected.size === suggestions.length ? C.blue : 'transparent' }}
                  >
                    {selected.size === suggestions.length && <span className="text-white text-[9px] leading-none">✓</span>}
                  </div>
                  Tümünü Seç ({selected.size}/{suggestions.length})
                </button>
                <span className="text-[11px]" style={{ color: C.muted }}>Mevcut → Önerilen</span>
              </div>

              <div>
                {suggestions.map((s, i) => (
                  <div
                    key={s.productId}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-all"
                    style={{
                      borderTop: i > 0 ? `1px solid ${C.border}` : undefined,
                      background: selected.has(s.productId) ? `${C.blue}06` : 'transparent',
                    }}
                    onClick={() => toggleOne(s.productId)}
                  >
                    <div
                      className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selected.has(s.productId) ? C.blue : C.border,
                        background: selected.has(s.productId) ? C.blue : 'transparent',
                      }}
                    >
                      {selected.has(s.productId) && <span className="text-white text-[9px] leading-none">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{s.productName}</p>
                      {s.brand && <p className="text-[11px] truncate" style={{ color: C.muted }}>{s.brand}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#f8717118', color: '#f87171', textDecoration: 'line-through' }}
                      >
                        {s.currentCategoryName}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: C.muted }}>→</span>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#34d39918', color: '#34d399' }}
                      >
                        {s.suggestedCategoryName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!loading && !done && suggestions.length > 0 && (
          <div
            className="flex-shrink-0 px-5 py-4 flex items-center justify-between gap-3"
            style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}
          >
            <p className="text-xs" style={{ color: C.muted }}>{selected.size} ürün seçili</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => !applying && onClose()}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || selected.size === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all"
                style={{ background: C.blue }}
              >
                {applying ? 'Uygulanıyor…' : `${selected.size} Ürünü Düzelt`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
