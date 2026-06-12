'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { marketPanelApi } from '../../../lib/api';
import { Report, ReportStatus, ManagedMarket } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import {
  AdminToast, PageHero, TabBar, EmptyState, LoadingCenter,
} from '../../../components/admin/AdminUIKit';
import { WorkflowGuide } from '../../../components/panels/WorkflowGuide';
import { ReportFiltersBar, ReportSortKey, SlaBadge } from '../../../components/panels/ReportFiltersBar';

type FilterKey = 'all' | ReportStatus;

const STATUS_META: Record<ReportStatus, { label: string; color: string; icon: string }> = {
  PENDING:      { label: 'Beklemede',   color: '#f59e0b', icon: '⏳' },
  UNDER_REVIEW: { label: 'İnceleniyor', color: '#60a5fa', icon: '🔍' },
  APPROVED:     { label: 'Onaylandı',   color: '#34d399', icon: '✅' },
  REJECTED:     { label: 'Reddedildi',  color: '#f87171', icon: '❌' },
  RESOLVED:     { label: 'Çözüldü',     color: '#94a3b8', icon: '🏁' },
};

const NEXT: Record<ReportStatus, ReportStatus[]> = {
  PENDING:      ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     ['RESOLVED'],
  REJECTED:     [],
  RESOLVED:     [],
};

function dayDiff(dateStr?: string) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function isExpiringSoon(expiryDate?: string) {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() - Date.now() < 7 * 86400000;
}

function sortReports(items: Report[], sort: ReportSortKey): Report[] {
  const copy = [...items];
  if (sort === 'newest') return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sort === 'oldest') return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return copy.sort((a, b) => {
    const aU = isExpiringSoon(a.expiryDate) ? 1 : 0;
    const bU = isExpiringSoon(b.expiryDate) ? 1 : 0;
    if (bU !== aU) return bU - aU;
    const aWait = a.pushedToMarketAt ? Date.now() - new Date(a.pushedToMarketAt).getTime() : 0;
    const bWait = b.pushedToMarketAt ? Date.now() - new Date(b.pushedToMarketAt).getTime() : 0;
    return bWait - aWait;
  });
}

function MarketReportsContent() {
  const C = useColors();
  const searchParams = useSearchParams();
  const [market, setMarket] = useState<ManagedMarket | null>(null);
  const [items, setItems] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ReportSortKey>('urgent');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterHasNote, setFilterHasNote] = useState(false);

  const TOTAL_PAGES = Math.ceil(total / 12);
  const brand = market?.brandColor ?? '#3b82f6';

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') ?? '{}');
      setMarket(u.managedMarket ?? null);
    } catch { /**/ }
  }, []);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && Object.keys(STATUS_META).includes(s)) {
      setFilter(s as FilterKey);
    }
  }, [searchParams]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    if (!market) return;
    setLoading(true);
    try {
      const res = await marketPanelApi.getReports(market.id, {
        status: filter === 'all' ? undefined : filter,
        page,
        limit: 12,
      });
      setItems(res.items as Report[]);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
      showToast('İhbarlar yüklenemedi', true);
    } finally {
      setLoading(false);
    }
  }, [market, filter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter]);

  const doUpdate = async (id: string, status: ReportStatus) => {
    setSaving(true);
    try {
      await marketPanelApi.updateReportStatus(id, status, note);
      setSelected(null);
      setNote('');
      showToast(`Durum → ${STATUS_META[status].label}`);
      load();
    } catch {
      showToast('Güncelleme başarısız', true);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ key: FilterKey; label: string; icon?: string }> = [
    { key: 'all', label: 'Tümü', icon: '📋' },
    ...(Object.keys(STATUS_META) as ReportStatus[]).map((s) => ({
      key: s as FilterKey,
      label: STATUS_META[s].label,
      icon: STATUS_META[s].icon,
    })),
  ];

  const pendingOnPage = items.filter((r) => r.status === 'PENDING').length;

  const displayed = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.description.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.marketNote?.toLowerCase().includes(q)
      );
    }
    if (filterUrgent) list = list.filter((r) => isExpiringSoon(r.expiryDate));
    if (filterHasNote) list = list.filter((r) => !!r.marketNote?.trim());
    return sortReports(list, sort);
  }, [items, search, sort, filterUrgent, filterHasNote]);

  const handleQuick = async (e: React.MouseEvent, id: string, status: ReportStatus) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await marketPanelApi.updateReportStatus(id, status);
      showToast(`→ ${STATUS_META[status].label}`);
      load();
    } catch {
      showToast('Güncelleme başarısız', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">
      {toast && <AdminToast message={toast.msg} error={toast.err} />}

      <PageHero
        badge="İhbar Yanıt Merkezi"
        title="Gelen İhbarlar"
        subtitle={`${market?.name ?? 'Market'} · Denetçi tarafından iletilen SKT bildirimlerini yanıtlayın`}
        gradient={`linear-gradient(135deg, ${brand}cc 0%, ${brand} 50%, #1e3a8a 100%)`}
        actions={
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white/90 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            ↻ Yenile
          </button>
        }
        metrics={[
          { label: 'Toplam İhbar', value: total, icon: '📋' },
          { label: 'Bu Sayfada', value: items.length, icon: '📄' },
          { label: 'Bekleyen', value: pendingOnPage, icon: '⏳' },
          { label: 'Market', value: market?.name?.split(' ')[0] ?? '—', icon: '🏪' },
        ]}
      />

      <WorkflowGuide variant="market" />

      <TabBar tabs={tabs} active={filter} onChange={setFilter} />

      <ReportFiltersBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        resultCount={displayed.length}
        totalCount={total}
        searchPlaceholder="Açıklama, şehir veya denetçi notu ara..."
        chips={[
          { key: 'urgent', label: 'SKT acil', icon: '⚠️', active: filterUrgent, onClick: () => setFilterUrgent((v) => !v) },
          { key: 'note', label: 'Denetçi notlu', icon: '📝', active: filterHasNote, onClick: () => setFilterHasNote((v) => !v) },
        ]}
      />

      {loading ? (
        <LoadingCenter />
      ) : displayed.length === 0 ? (
        <EmptyState
          icon="📭"
          title="Henüz ihbar yok"
          subtitle={filter === 'all'
            ? 'Denetçi inceledikten sonra ihbarlar burada görünür.'
            : 'Bu filtrede kayıt bulunamadı.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((r) => {
            const m = STATUS_META[r.status];
            const diff = dayDiff(r.expiryDate);
            const skTColor = diff !== null ? (diff < 0 ? C.red : diff <= 3 ? C.amber : C.muted) : null;

            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelected(r); setNote(''); }}
                onKeyDown={(e) => e.key === 'Enter' && (setSelected(r), setNote(''))}
                className="rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden hover:brightness-105 transition-all cursor-pointer"
                style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${m.color}` }}
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    style={{ background: `${m.color}15`, color: m.color }}
                  >
                    {m.icon} {m.label}
                  </span>
                  {r.pushedToMarketAt && <SlaBadge pushedAt={r.pushedToMarketAt} C={C} />}
                  {r.expiryDate && diff !== null && (
                    <span className="text-xs font-bold" style={{ color: skTColor ?? C.muted }}>
                      {diff < 0 ? `SKT ${Math.abs(diff)}g geçti` : diff === 0 ? 'SKT bugün!' : `${diff}g kaldı`}
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed line-clamp-3 font-medium" style={{ color: C.text }}>
                  {r.description}
                </p>

                {r.marketNote && (
                  <p className="text-[11px] px-2 py-1.5 rounded-lg line-clamp-2 font-medium"
                    style={{ background: `${C.amber}10`, color: C.amber }}>
                    📝 {r.marketNote}
                  </p>
                )}

                {r.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleQuick(e, r.id, 'UNDER_REVIEW')}
                    className="w-full py-2 rounded-lg text-[11px] font-black text-white disabled:opacity-40"
                    style={{ background: brand }}
                  >
                    ⚡ İncelemeye Al
                  </button>
                )}
                {r.status === 'APPROVED' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleQuick(e, r.id, 'RESOLVED')}
                    className="w-full py-2 rounded-lg text-[11px] font-black disabled:opacity-40"
                    style={{ background: `${C.green}18`, border: `1px solid ${C.green}35`, color: C.green }}
                  >
                    🏁 Çözüldü Olarak Kapat
                  </button>
                )}

                <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>
                    {r.isAnonymous ? '🎭 Anonim' : (r.user?.name ?? '—')}
                  </span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    {new Date(r.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {r.images && r.images.length > 0 && (
                  <div className="flex gap-1.5">
                    {r.images.slice(0, 3).map((img) => (
                      <img key={img.id} src={img.url} alt="" className="w-14 h-14 rounded-lg object-cover"
                        style={{ border: `1px solid ${C.border}` }} />
                    ))}
                    {r.images.length > 3 && (
                      <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: C.cardAlt, color: C.muted }}>
                        +{r.images.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {r.pushedToMarketAt && (
                  <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: C.green }}>
                    ✓ İletildi: {new Date(r.pushedToMarketAt).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {TOTAL_PAGES > 1 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <p className="text-sm" style={{ color: C.muted }}>
            Sayfa <strong style={{ color: C.text }}>{page}</strong> / {TOTAL_PAGES}
            <span className="mx-2">·</span>
            {total} kayıt
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
              onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
              disabled={page === TOTAL_PAGES}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-30"
              style={{ background: brand }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div
            className="ml-auto w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: C.card, borderLeft: `1px solid ${C.border}` }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
              style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: STATUS_META[selected.status].color }}>
                  {STATUS_META[selected.status].icon} {STATUS_META[selected.status].label}
                </p>
                <p className="text-base font-black mt-0.5" style={{ color: C.text }}>İhbar Detayı</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: C.cardAlt, color: C.muted }}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-6 space-y-4">
              <div className="p-4 rounded-xl" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Şikayet</p>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{selected.description}</p>
              </div>

              {selected.expiryDate && (
                <div className="p-4 rounded-xl" style={{ background: `${C.red}10`, border: `1px solid ${C.red}25` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.red }}>Son Kullanma Tarihi</p>
                  <p className="text-lg font-black" style={{ color: C.red }}>
                    {new Date(selected.expiryDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              {selected.images && selected.images.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Kanıt Görselleri</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.images.map((img) => (
                      <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                        <img src={img.url} alt="" className="w-full aspect-square object-cover rounded-xl"
                          style={{ border: `1px solid ${C.border}` }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.marketNote && (
                <div className="p-4 rounded-xl" style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}25` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.amber }}>Denetçiden Gelen Not</p>
                  <p className="text-[10px] mb-1" style={{ color: C.muted }}>Bu not size özeldir; bildiren kullanıcı görmez.</p>
                  <p className="text-sm" style={{ color: C.text }}>{selected.marketNote}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Bildiren', value: selected.isAnonymous ? 'Anonim' : (selected.user?.name ?? '—') },
                  { label: 'Tarih', value: new Date(selected.createdAt).toLocaleDateString('tr-TR') },
                  { label: 'Şehir', value: selected.city ?? '—' },
                  { label: 'İlçe', value: selected.district ?? '—' },
                ].map((f) => (
                  <div key={f.label} className="p-3 rounded-xl" style={{ background: C.cardAlt }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>{f.label}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{f.value}</p>
                  </div>
                ))}
              </div>

              {NEXT[selected.status].length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Kullanıcıya Yanıt Notu</p>
                  <p className="text-[10px] mb-2" style={{ color: C.muted }}>Durum güncellerken bu not bildiren kullanıcıya iletilir.</p>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Kullanıcıya gösterilecek açıklama (isteğe bağlı)..."
                    className="w-full rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-400/30"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
                  />
                </div>
              )}

              {NEXT[selected.status].length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Aksiyon Al</p>
                  <div className="flex flex-col gap-2">
                    {NEXT[selected.status].map((nextStatus) => {
                      const m = STATUS_META[nextStatus];
                      return (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() => doUpdate(selected.id, nextStatus)}
                          disabled={saving}
                          className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ background: `${m.color}18`, border: `1px solid ${m.color}35`, color: m.color }}
                        >
                          {saving ? '…' : <>{m.icon} {m.label} Olarak İşaretle</>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl text-center" style={{ background: C.cardAlt }}>
                  <p className="text-sm font-medium" style={{ color: C.muted }}>Bu ihbar nihai durumda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketReportsPage() {
  return (
    <Suspense fallback={<LoadingCenter />}>
      <MarketReportsContent />
    </Suspense>
  );
}
