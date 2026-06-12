'use client';

import { useEffect, useState } from 'react';
import { productsApi, pricesApi, marketPanelApi, ProductDetail } from '../../lib/api';
import { ManagedMarket, Report } from '../../types';
import { useColors } from '../../context/ThemeContext';
import { formatPriceFromKurus, kurusToTlInput, parseTlInput } from '../../lib/price';

export interface MarketPriceItem {
  id: string;
  amount: number;
  lastUpdated?: string;
  updatedAt?: string;
  source?: string;
  confidenceScore?: number;
  needsVerification?: boolean;
  freshness?: string;
  isAvailable?: boolean;
  product: {
    id: string;
    name: string;
    brand?: string;
    unit?: string;
    unitValue?: number;
    imageUrl?: string | null;
    description?: string | null;
    slug?: string | null;
    category?: { id: string; name: string; icon?: string | null };
    barcodes?: Array<{ id: string; code: string }>;
  };
}

function SktBadge({ date }: { date: Date }) {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  let bg = '#f0fdf4'; let color = '#16a34a'; let icon = '✓';
  if (days < 0) { bg = '#fef2f2'; color = '#dc2626'; icon = '⚠'; }
  else if (days <= 7) { bg = '#fff7ed'; color = '#ea580c'; icon = '🔴'; }
  else if (days <= 30) { bg = '#fefce8'; color = '#ca8a04'; icon = '🟡'; }
  const label = days < 0 ? `${Math.abs(days)} gün geçti` : days === 0 ? 'Bugün' : `${days} gün kaldı`;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: bg, color }}>
      {icon} {label}
    </span>
  );
}

function InfoRow({ icon, label, value, C }: { icon: string; label: string; value: string; C: ReturnType<typeof useColors> }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-base w-6 text-center shrink-0">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide w-24 shrink-0" style={{ color: C.muted }}>{label}</span>
      <span className="text-sm font-medium truncate" style={{ color: C.text }}>{value}</span>
    </div>
  );
}

export function ProductPriceDrawer({
  price,
  market,
  onClose,
  onUpdated,
}: {
  price: MarketPriceItem;
  market: ManagedMarket;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const C = useColors();
  const brand = market.brandColor ?? '#3b82f6';

  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<Array<{ amount: number; recordedAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [editAmount, setEditAmount] = useState(kurusToTlInput(price.amount));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditAmount(kurusToTlInput(price.amount));
  }, [price.amount]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      productsApi.getOne(price.product.id).catch(() => null),
      marketPanelApi.getReports(market.id, { limit: 100 }).catch(() => ({ items: [] })),
      pricesApi.getHistory(price.product.id, market.id).catch(() => null),
    ]).then(([det, reps, hist]) => {
      setDetail(det);
      const items = (reps.items ?? []) as Report[];
      setReports(items.filter((r) => r.product?.id === price.product.id && r.expiryDate));
      setHistory(hist?.history ?? []);
    }).finally(() => setLoading(false));
  }, [price.product.id, market.id]);

  const imageUrl = detail?.imageUrl ?? price.product.imageUrl;
  const category = detail?.category ?? price.product.category;
  const barcodes = detail?.barcodes ?? price.product.barcodes ?? [];
  const nearestSkt = reports.length > 0
    ? reports.reduce((a, b) =>
        new Date(a.expiryDate!).getTime() < new Date(b.expiryDate!).getTime() ? a : b)
    : null;

  const updatedAt = price.lastUpdated ?? price.updatedAt;
  const daysSinceUpdate = updatedAt
    ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
    : null;

  const handleSavePrice = async () => {
    setSaving(true);
    try {
      await pricesApi.upsert({
        productId: price.product.id,
        marketId: market.id,
        amount: parseTlInput(editAmount),
      });
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="ml-auto w-full max-w-md h-full flex flex-col overflow-hidden"
        style={{ background: C.card, borderLeft: `1px solid ${C.border}` }}
      >
        <div className="shrink-0 relative" style={{ borderBottom: `1px solid ${C.border}` }}>
          {imageUrl ? (
            <div className="h-44 w-full overflow-hidden" style={{ background: C.cardAlt }}>
              <img src={imageUrl} alt="" className="w-full h-full object-contain p-4" />
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-5xl" style={{ background: `${brand}10` }}>
              {category?.icon ?? '📦'}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-lg"
            style={{ background: C.card, color: C.muted }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: brand }}>Ürün Kartı</p>
            <h2 className="text-lg font-black mt-1 leading-snug" style={{ color: C.text }}>{price.product.name}</h2>
            {price.product.brand && (
              <p className="text-sm font-semibold mt-0.5" style={{ color: C.secondary }}>{price.product.brand}</p>
            )}
            {category && (
              <span className="inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-lg"
                style={{ background: `${brand}12`, color: brand }}>
                {category.icon} {category.name}
              </span>
            )}
          </div>

          {/* Güncel fiyat */}
          <div className="rounded-2xl p-4" style={{ background: `${brand}08`, border: `1px solid ${brand}25` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Market Fiyatınız</p>
            <p className="text-3xl font-black tabular-nums" style={{ color: brand }}>
              {formatPriceFromKurus(price.amount)}
            </p>
            {daysSinceUpdate != null && (
              <p className="text-xs mt-1" style={{ color: daysSinceUpdate > 7 ? C.amber : C.muted }}>
                Son güncelleme: {daysSinceUpdate === 0 ? 'bugün' : `${daysSinceUpdate} gün önce`}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
              />
              <button
                type="button"
                onClick={handleSavePrice}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-black text-white disabled:opacity-40"
                style={{ background: brand }}
              >
                {saving ? '…' : 'Kaydet'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: `${brand}25`, borderTopColor: brand }} />
            </div>
          ) : (
            <>
              {/* SKT — ihbarlardan */}
              {nearestSkt?.expiryDate && (
                <div className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30` }}>
                  <span className="text-2xl">🗓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.amber }}>
                      Bildirilen SKT (İhbar)
                    </p>
                    <p className="text-sm font-black mt-1" style={{ color: C.text }}>
                      {new Date(nearestSkt.expiryDate).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                    <div className="mt-2">
                      <SktBadge date={new Date(nearestSkt.expiryDate)} />
                    </div>
                    {reports.length > 1 && (
                      <p className="text-[10px] mt-2" style={{ color: C.muted }}>
                        +{reports.length - 1} başka SKT bildirimi
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ürün özellikleri */}
              <div className="rounded-2xl px-4 overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <p className="text-[10px] font-black uppercase tracking-widest py-3" style={{ color: C.muted }}>
                  Ürün Bilgileri
                </p>
                <InfoRow icon="⚖️" label="Birim" value={
                  price.product.unitValue && price.product.unit
                    ? `${price.product.unitValue} ${price.product.unit}`
                    : (price.product.unit ?? '—')
                } C={C} />
                {detail?.description && (
                  <InfoRow icon="📝" label="Açıklama" value={detail.description} C={C} />
                )}
                {barcodes.length > 0 && (
                  <InfoRow icon="🔖" label="Barkod" value={barcodes.map((b) => b.code).join(', ')} C={C} />
                )}
                {price.source && (
                  <InfoRow icon="📡" label="Kaynak" value={price.source} C={C} />
                )}
                {price.needsVerification && (
                  <InfoRow icon="⚠️" label="Doğrulama" value="Topluluk doğrulaması bekleniyor" C={C} />
                )}
              </div>

              {/* Fiyat geçmişi */}
              {history.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest px-4 py-3"
                    style={{ color: C.muted, background: C.cardAlt }}>
                    Fiyat Geçmişi
                  </p>
                  {history.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderTop: `1px solid ${C.border}` }}>
                      <span className="text-xs" style={{ color: C.muted }}>
                        {new Date(h.recordedAt).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: C.text }}>
                        {formatPriceFromKurus(h.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rakip fiyat karşılaştırma */}
              {detail?.prices && detail.prices.length > 1 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest px-4 py-3"
                    style={{ color: C.muted, background: C.cardAlt }}>
                    Diğer Marketler
                  </p>
                  {detail.prices
                    .filter((p) => p.market.id !== market.id)
                    .slice(0, 4)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5"
                        style={{ borderTop: `1px solid ${C.border}` }}>
                        <span className="text-xs font-medium truncate" style={{ color: C.secondary }}>
                          {p.market.name}
                        </span>
                        <span className="text-sm font-bold tabular-nums shrink-0 ml-2" style={{ color: C.muted }}>
                          {formatPriceFromKurus(p.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
