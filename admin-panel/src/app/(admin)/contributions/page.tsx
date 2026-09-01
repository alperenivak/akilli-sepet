'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { contributionsApi } from '../../../lib/api';
import { useColors } from '../../../context/ThemeContext';

type ContributionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ContributionType = 'BARCODE' | 'MARKET_LISTING';

interface ProductContribution {
  id: string;
  type: ContributionType;
  status: ContributionStatus;
  barcode?: string | null;
  amount?: number | null;
  note?: string | null;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  product: { id: string; name: string; imageUrl?: string | null; brand?: string | null };
  market?: { id: string; name: string } | null;
  user?: {
    id: string; name: string; surname: string; email: string; reputationScore: number;
  } | null;
}

const TYPE_LABEL: Record<ContributionType, string> = {
  BARCODE: '📊 Barkod',
  MARKET_LISTING: '🏪 Markete Ekleme',
};

const STATUS_STYLE = {
  PENDING: { label: 'Beklemede', color: '#f59e0b' },
  APPROVED: { label: 'Onaylandı', color: '#10b981' },
  REJECTED: { label: 'Reddedildi', color: '#ef4444' },
};

function formatPrice(kurus?: number | null) {
  if (!kurus) return '—';
  return `₺${(kurus / 100).toFixed(2)}`;
}

export default function ContributionsPage() {
  const C = useColors();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ProductContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | ContributionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>(
    searchParams.get('status') === 'PENDING' ? 'PENDING' : 'PENDING',
  );
  const [stats, setStats] = useState({ pendingBarcode: 0, pendingListing: 0, pendingTotal: 0 });
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contributionsApi.list({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        status: statusFilter === 'PENDING' ? 'PENDING' : undefined,
        limit: 50,
      });
      setItems(res.items ?? []);
      setStats(res.stats ?? { pendingBarcode: 0, pendingListing: 0, pendingTotal: 0 });
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewing(id);
    try {
      await contributionsApi.review(id, decision, adminNote.trim() || undefined);
      setAdminNote('');
      await load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'İşlem başarısız');
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: C.text }}>Ürün Katkıları</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          Kullanıcıların barkod ve market listeleme talepleri — onay sonrası itibar verilir
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Bekleyen Barkod', value: stats.pendingBarcode, color: '#3b82f6' },
          { label: 'Bekleyen Market', value: stats.pendingListing, color: '#10b981' },
          { label: 'Toplam Bekleyen', value: stats.pendingTotal, color: '#f59e0b' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-xs" style={{ color: C.muted }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['ALL', 'BARCODE', 'MARKET_LISTING'] as const).map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: typeFilter === t ? '#2563eb' : C.card,
              color: typeFilter === t ? '#fff' : C.text,
              border: `1px solid ${C.border}`,
            }}>
            {t === 'ALL' ? 'Tümü' : TYPE_LABEL[t]}
          </button>
        ))}
        {(['PENDING', 'ALL'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: statusFilter === s ? '#059669' : C.card,
              color: statusFilter === s ? '#fff' : C.text,
              border: `1px solid ${C.border}`,
            }}>
            {s === 'PENDING' ? 'Sadece Bekleyen' : 'Tüm Durumlar'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Admin notu (onay/red için opsiyonel)"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          className="w-full max-w-md px-3 py-2 rounded-lg text-sm"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        />
      </div>

      {loading ? (
        <p style={{ color: C.muted }}>Yükleniyor...</p>
      ) : items.length === 0 ? (
        <p style={{ color: C.muted }}>Kayıt bulunamadı.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl p-4 flex flex-wrap gap-4 items-start justify-between"
              style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex gap-3 flex-1 min-w-[240px]">
                {item.product.imageUrl && (
                  <img src={item.product.imageUrl} alt="" className="w-14 h-14 object-contain rounded-lg bg-white" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#eff6ff', color: '#2563eb' }}>
                      {TYPE_LABEL[item.type]}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${STATUS_STYLE[item.status].color}18`, color: STATUS_STYLE[item.status].color }}>
                      {STATUS_STYLE[item.status].label}
                    </span>
                  </div>
                  <p className="font-semibold mt-1" style={{ color: C.text }}>{item.product.name}</p>
                  {item.product.brand && (
                    <p className="text-xs" style={{ color: C.muted }}>{item.product.brand}</p>
                  )}
                  {item.type === 'BARCODE' && item.barcode && (
                    <p className="text-sm font-mono mt-1" style={{ color: C.text }}>Barkod: {item.barcode}</p>
                  )}
                  {item.type === 'MARKET_LISTING' && (
                    <p className="text-sm mt-1" style={{ color: C.text }}>
                      {item.market?.name} — {formatPrice(item.amount)}
                    </p>
                  )}
                  {item.note && <p className="text-xs mt-1 italic" style={{ color: C.muted }}>{item.note}</p>}
                  {item.user && (
                    <p className="text-xs mt-2" style={{ color: C.muted }}>
                      {item.user.name} {item.user.surname} · {item.user.email} · ⭐ {item.user.reputationScore.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              {item.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    disabled={reviewing === item.id}
                    onClick={() => handleReview(item.id, 'APPROVED')}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                    style={{ background: '#10b981' }}>
                    Onayla
                  </button>
                  <button
                    disabled={reviewing === item.id}
                    onClick={() => handleReview(item.id, 'REJECTED')}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                    style={{ background: '#ef4444' }}>
                    Reddet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
