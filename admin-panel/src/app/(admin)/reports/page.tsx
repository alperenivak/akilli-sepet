'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { reportsApi } from '../../../lib/api';
import { Report, ReportStatus, PaginatedResponse } from '../../../types';
import PushToMarketForm from '../../../components/reports/PushToMarketForm';
import { useColors } from '../../../context/ThemeContext';
import {
  AdminToast, PageHero, TabBar, EmptyState, LoadingCenter,
} from '../../../components/admin/AdminUIKit';

type FilterKey = 'all' | ReportStatus | 'pushed';

interface ReportStats {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  resolved: number;
}

const STATUS_META: Record<ReportStatus, { label: string; color: string; icon: string }> = {
  PENDING:      { label: 'Beklemede',   color: '#f59e0b', icon: '⏳' },
  UNDER_REVIEW: { label: 'İnceleniyor', color: '#60a5fa', icon: '🔍' },
  APPROVED:     { label: 'Onaylandı',   color: '#34d399', icon: '✅' },
  REJECTED:     { label: 'Reddedildi',  color: '#f87171', icon: '❌' },
  RESOLVED:     { label: 'Çözüldü',     color: '#94a3b8', icon: '🏁' },
};

const NEXT_STATUSES: Record<ReportStatus, ReportStatus[]> = {
  PENDING: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['RESOLVED'],
  REJECTED: [],
  RESOLVED: [],
};

const NEXT_ACTION_LABELS: Record<ReportStatus, string> = {
  UNDER_REVIEW: 'İncelemeye Al',
  APPROVED: 'Onayla',
  REJECTED: 'Reddet',
  RESOLVED: 'Çözüldü Olarak Kapat',
  PENDING: 'Beklemeye Al',
};

function isExpiringSoon(expiryDate?: string) {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

function dayDiff(dateStr?: string) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReportsPage() {
  const C = useColors();
  const [data, setData] = useState<PaginatedResponse<Report> | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const [userNote, setUserNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchStats = useCallback(async () => {
    try {
      const s = await reportsApi.getStats();
      setStats(s as ReportStats);
    } catch { /* stats optional */ }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof reportsApi.getAll>[0] = { page, limit: 15 };
      if (filter === 'pushed') {
        params.pushedToMarket = true;
      } else if (filter !== 'all') {
        params.status = filter;
      }
      const result = await reportsApi.getAll(params);
      setData(result);
    } catch {
      showToast('İhbarlar yüklenemedi', true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { setPage(1); }, [filter]);

  const handleStatusUpdate = async (reportId: string, newStatus: ReportStatus) => {
    setUpdating(true);
    try {
      await reportsApi.updateStatus(reportId, newStatus, userNote || undefined);
      setSelected(null);
      setUserNote('');
      showToast(`Durum güncellendi → ${STATUS_META[newStatus].label}`);
      fetchReports();
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Durum güncellenemedi', true);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((r) =>
      r.description.toLowerCase().includes(q) ||
      r.market?.name?.toLowerCase().includes(q) ||
      r.marketNameOther?.toLowerCase().includes(q) ||
      r.user?.name?.toLowerCase().includes(q) ||
      r.user?.email?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q)
    );
  }, [data?.items, search]);

  const tabs: Array<{ key: FilterKey; label: string; icon?: string; count?: number }> = [
    { key: 'all', label: 'Tümü', icon: '📋', count: stats?.total },
    { key: 'PENDING', label: 'Beklemede', icon: '⏳', count: stats?.pending },
    { key: 'UNDER_REVIEW', label: 'İnceleniyor', icon: '🔍', count: stats?.underReview },
    { key: 'APPROVED', label: 'Onaylandı', icon: '✅', count: stats?.approved },
    { key: 'REJECTED', label: 'Reddedildi', icon: '❌', count: stats?.rejected },
    { key: 'RESOLVED', label: 'Çözüldü', icon: '🏁', count: stats?.resolved },
    { key: 'pushed', label: 'Markete İletilen', icon: '📤' },
  ];

  const urgentCount = useMemo(
    () => (data?.items ?? []).filter((r) => r.status === 'PENDING' && isExpiringSoon(r.expiryDate)).length,
    [data?.items],
  );

  return (
    <div className="space-y-5" style={{ color: C.text, maxWidth: 1400 }}>
      {toast && <AdminToast message={toast.msg} error={toast.err} />}

      <PageHero
        badge="İhbar Yönetimi"
        title="SKT İhbar Merkezi"
        subtitle="Son kullanma tarihi geçmiş veya riskli ürün bildirimlerini inceleyin, markete iletin ve durumu güncelleyin."
        gradient="linear-gradient(135deg, #7f1d1d 0%, #dc2626 45%, #ea580c 100%)"
        actions={
          <button
            type="button"
            onClick={() => { fetchReports(); fetchStats(); }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white/90 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            ↻ Yenile
          </button>
        }
        metrics={[
          { label: 'Toplam İhbar', value: stats?.total ?? '—', icon: '📋' },
          { label: 'Bekleyen', value: stats?.pending ?? '—', icon: '⏳' },
          { label: 'İnceleniyor', value: stats?.underReview ?? '—', icon: '🔍' },
          { label: 'Çözülen', value: stats?.resolved ?? '—', icon: '🏁' },
        ]}
      />

      {urgentCount > 0 && filter !== 'RESOLVED' && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-semibold"
          style={{ background: `${C.red}12`, border: `1px solid ${C.red}30`, color: C.red }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: C.red }} />
          {urgentCount} acil ihbar — SKT 7 gün içinde doluyor veya geçmiş
        </div>
      )}

      <TabBar tabs={tabs} active={filter} onChange={setFilter} />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Market, kullanıcı, şehir veya açıklama ara..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400/30"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>
        {data && (
          <p className="text-xs font-semibold shrink-0" style={{ color: C.muted }}>
            {search ? `${filtered.length} / ` : ''}{data.total} kayıt
          </p>
        )}
      </div>

      {loading ? (
        <LoadingCenter />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📭"
          title={filter === 'all' ? 'Henüz ihbar yok' : 'Bu filtrede ihbar bulunamadı'}
          subtitle={
            search
              ? `"${search}" aramasıyla eşleşen sonuç yok. Farklı anahtar kelimeler deneyin.`
              : 'Kullanıcılar mobil uygulamadan SKT ihlali bildirdiğinde burada görünür.'
          }
          action={
            filter !== 'all' ? (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
              >
                Tüm ihbarları göster
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((report) => {
            const meta = STATUS_META[report.status];
            const urgent = report.status === 'PENDING' && isExpiringSoon(report.expiryDate);
            const sktDiff = dayDiff(report.expiryDate);

            return (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelected(report); setUserNote(''); }}
                onKeyDown={(e) => e.key === 'Enter' && (setSelected(report), setUserNote(''))}
                className="rounded-xl p-4 flex items-start gap-4 transition-all cursor-pointer hover:brightness-105"
                style={{
                  background: C.card,
                  border: `1px solid ${urgent ? C.red : C.border}`,
                  boxShadow: urgent ? `0 0 0 1px ${C.red}25` : undefined,
                }}
              >
                {urgent && (
                  <span className="w-2 h-2 rounded-full mt-2 shrink-0 animate-pulse" style={{ background: C.red }} />
                )}

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: C.cardAlt }}
                >
                  {report.isAnonymous ? '🎭' : '👤'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="text-sm font-bold flex-1 min-w-0 line-clamp-2" style={{ color: C.text }}>
                      {report.description}
                    </p>
                    <span
                      className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0 flex items-center gap-1"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <span className="text-xs" style={{ color: C.muted }}>
                      {report.isAnonymous ? 'Anonim' : (report.user?.name ?? '—')}
                    </span>
                    <span className="text-xs" style={{ color: C.muted }}>·</span>
                    <span className="text-xs font-medium" style={{ color: C.secondary }}>
                      🏪 {report.market?.name ?? report.marketNameOther ?? 'Market belirtilmemiş'}
                    </span>
                    {report.city && (
                      <>
                        <span className="text-xs" style={{ color: C.muted }}>·</span>
                        <span className="text-xs" style={{ color: C.muted }}>📍 {report.city}</span>
                      </>
                    )}
                    <span className="text-xs" style={{ color: C.muted }}>·</span>
                    <span className="text-xs" style={{ color: C.muted }}>{formatDate(report.createdAt)}</span>
                    {report.expiryDate && (
                      <>
                        <span className="text-xs" style={{ color: C.muted }}>·</span>
                        <span
                          className="text-xs font-bold"
                          style={{ color: sktDiff !== null && sktDiff <= 3 ? C.red : C.amber }}
                        >
                          SKT {formatDate(report.expiryDate)}
                          {sktDiff !== null && sktDiff < 0 && ` (${Math.abs(sktDiff)}g geçti)`}
                        </span>
                      </>
                    )}
                    {report.pushedToMarketAt && (
                      <>
                        <span className="text-xs" style={{ color: C.muted }}>·</span>
                        <span className="text-xs font-bold" style={{ color: C.green }}>✓ Markete iletildi</span>
                      </>
                    )}
                  </div>

                  {report.userNote && (
                    <p
                      className="text-xs mt-2 px-2 py-1 rounded-lg inline-block font-medium"
                      style={{ background: `${C.blue}12`, color: C.blue }}
                    >
                      👤 Kullanıcı: {report.userNote}
                    </p>
                  )}
                  {report.marketNote && (
                    <p
                      className="text-xs mt-1 px-2 py-1 rounded-lg inline-block font-medium"
                      style={{ background: `${C.amber}12`, color: C.amber }}
                    >
                      🏪 Market: {report.marketNote}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelected(report); setUserNote(''); }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#dc2626' }}
                >
                  İncele
                </button>
              </div>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <p className="text-sm" style={{ color: C.muted }}>
            Sayfa <strong style={{ color: C.text }}>{data.page}</strong> / {data.totalPages}
            <span className="mx-2">·</span>
            Toplam <strong style={{ color: C.text }}>{data.total}</strong> kayıt
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}
            >
              ← Önceki
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={!data.hasNext}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-30"
              style={{ background: '#dc2626' }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
              style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#dc2626' }}>
                  İhbar Detayı
                </p>
                <p className="text-lg font-black mt-0.5" style={{ color: C.text }}>
                  #{selected.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                  style={{
                    background: `${STATUS_META[selected.status].color}18`,
                    color: STATUS_META[selected.status].color,
                  }}
                >
                  {STATUS_META[selected.status].icon} {STATUS_META[selected.status].label}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg text-lg"
                  style={{ background: C.cardAlt, color: C.muted }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>
                  Açıklama
                </p>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{selected.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: C.cardAlt }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Bildiren</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.text }}>
                    {selected.isAnonymous ? '🎭 Anonim' : (selected.user?.name ?? '—')}
                  </p>
                  {!selected.isAnonymous && selected.user?.email && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selected.user.email}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl" style={{ background: C.cardAlt }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Market</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.text }}>
                    {selected.market?.name ?? selected.marketNameOther ?? '—'}
                  </p>
                  {selected.branch && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>Şube: {selected.branch.name}</p>
                  )}
                  {selected.city && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {selected.city}{selected.district ? `, ${selected.district}` : ''}
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-xl" style={{ background: C.cardAlt }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Bildirim Tarihi</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.text }}>
                    {new Date(selected.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {selected.expiryDate && (
                  <div
                    className="p-3 rounded-xl"
                    style={{
                      background: isExpiringSoon(selected.expiryDate) ? `${C.red}10` : `${C.amber}10`,
                      border: `1px solid ${isExpiringSoon(selected.expiryDate) ? C.red : C.amber}30`,
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: isExpiringSoon(selected.expiryDate) ? C.red : C.amber }}
                    >
                      Son Kullanma Tarihi
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: C.text }}>
                      {new Date(selected.expiryDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {selected.product && (
                <div className="p-3 rounded-xl" style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}25` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.blue }}>İlgili Ürün</p>
                  <p className="text-sm font-bold mt-1" style={{ color: C.text }}>{selected.product.name}</p>
                </div>
              )}

              {selected.images && selected.images.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>
                    Kanıt Görselleri
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.images.map((img) => (
                      <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img.url}
                          alt="İhbar görseli"
                          className="w-20 h-20 object-cover rounded-xl hover:opacity-80 transition-opacity"
                          style={{ border: `1px solid ${C.border}` }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <PushToMarketForm
                report={selected}
                accentColor="#dc2626"
                onSuccess={(updated) => {
                  setSelected(updated);
                  fetchReports();
                  fetchStats();
                }}
              />

              {selected.marketNote && (
                <div className="p-4 rounded-xl" style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.amber }}>Market Notu</p>
                  <p className="text-xs mt-0.5 mb-1" style={{ color: C.muted }}>Yalnızca market panelinde görünür</p>
                  <p className="text-sm" style={{ color: C.text }}>{selected.marketNote}</p>
                </div>
              )}

              {selected.userNote && (
                <div className="p-4 rounded-xl" style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}30` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.blue }}>Kullanıcıya İletilen Not</p>
                  <p className="text-sm mt-1" style={{ color: C.text }}>{selected.userNote}</p>
                </div>
              )}

              {NEXT_STATUSES[selected.status].length > 0 && (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>
                      Kullanıcıya Yanıt Notu (isteğe bağlı)
                    </p>
                    <p className="text-xs mb-2" style={{ color: C.muted }}>
                      Bu not mobil uygulamada bildiren kullanıcıya gösterilir. Market notları burada görünmez.
                    </p>
                    <textarea
                      rows={3}
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                      placeholder="Kullanıcıya gösterilecek inceleme sonucu veya açıklama..."
                      className="w-full rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-red-400/30"
                      style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
                    />
                  </div>

                  <div className="p-4 rounded-xl" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <p className="text-sm font-bold mb-3" style={{ color: C.text }}>Durumu Güncelle</p>
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STATUSES[selected.status].map((nextStatus) => {
                        const m = STATUS_META[nextStatus];
                        return (
                          <button
                            key={nextStatus}
                            type="button"
                            onClick={() => handleStatusUpdate(selected.id, nextStatus)}
                            disabled={updating}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
                            style={{ background: `${m.color}18`, border: `1px solid ${m.color}35`, color: m.color }}
                          >
                            {updating ? '…' : `${m.icon} ${NEXT_ACTION_LABELS[nextStatus]}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {NEXT_STATUSES[selected.status].length === 0 && (
                <div className="p-4 rounded-xl text-center" style={{ background: C.cardAlt }}>
                  <p className="text-sm font-medium" style={{ color: C.muted }}>
                    Bu ihbar <strong style={{ color: C.text }}>{STATUS_META[selected.status].label}</strong> durumunda — başka işlem yapılamaz.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
