'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { reportsApi } from '../../../lib/api';
import { Report, ReportStatus, PaginatedResponse } from '../../../types';
import PushToMarketForm from '../../../components/reports/PushToMarketForm';
import { useColors } from '../../../context/ThemeContext';
import {
  AdminToast, PageHero, TabBar, EmptyState, LoadingCenter,
} from '../../../components/admin/AdminUIKit';
import { WorkflowGuide } from '../../../components/panels/WorkflowGuide';
import { ReportFiltersBar, ReportSortKey, SlaBadge } from '../../../components/panels/ReportFiltersBar';

const ACCENT = '#F59E0B';
const HERO_GRADIENT = 'linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)';

const STATUS_META: Record<ReportStatus, { label: string; color: string; icon: string }> = {
  PENDING:      { label: 'Beklemede',   color: '#f87171', icon: '⏳' },
  UNDER_REVIEW: { label: 'İnceleniyor', color: '#f59e0b', icon: '🔍' },
  APPROVED:     { label: 'Onaylandı',   color: '#34d399', icon: '✅' },
  REJECTED:     { label: 'Reddedildi',  color: '#94a3b8', icon: '❌' },
  RESOLVED:     { label: 'Çözüldü',     color: '#60a5fa', icon: '🏁' },
};

const NEXT_STATUSES: Record<ReportStatus, { status: ReportStatus; label: string; color: string }[]> = {
  PENDING: [
    { status: 'UNDER_REVIEW', label: 'İncelemeye Al', color: '#f59e0b' },
    { status: 'REJECTED', label: 'Reddet', color: '#94a3b8' },
  ],
  UNDER_REVIEW: [
    { status: 'APPROVED', label: 'Onayla', color: '#34d399' },
    { status: 'REJECTED', label: 'Reddet', color: '#f87171' },
  ],
  APPROVED: [
    { status: 'RESOLVED', label: 'Çözüldü Olarak Kapat', color: '#60a5fa' },
  ],
  REJECTED: [],
  RESOLVED: [],
};

interface Props {
  title: string;
  subtitle: string;
  defaultStatuses: ReportStatus[];
  allowedFilters: ReportStatus[];
  emptyMessage: string;
  heroBadge?: string;
  showWorkflowGuide?: boolean;
}

function isExpiringSoon(expiryDate?: string) {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sortReports(items: Report[], sort: ReportSortKey): Report[] {
  const copy = [...items];
  if (sort === 'newest') return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sort === 'oldest') return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return copy.sort((a, b) => {
    const aUrgent = isExpiringSoon(a.expiryDate) ? 1 : 0;
    const bUrgent = isExpiringSoon(b.expiryDate) ? 1 : 0;
    if (bUrgent !== aUrgent) return bUrgent - aUrgent;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function InspectorReportList({
  title, subtitle, defaultStatuses, allowedFilters, emptyMessage,
  heroBadge = 'Denetçi Paneli', showWorkflowGuide = false,
}: Props) {
  const C = useColors();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const [data, setData] = useState<PaginatedResponse<Report> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>(defaultStatuses[0]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);
  const [userNote, setUserNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ReportSortKey>('urgent');
  const [filterPhoto, setFilterPhoto] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterNotPushed, setFilterNotPushed] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const result = await reportsApi.getAll({
        status: statusFilter,
        page,
        limit: 15,
        ...(filterNotPushed && { pushedToMarket: false }),
      });
      setData(result);
    } catch {
      showToast('İhbarlar yüklenemedi', true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, filterNotPushed]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { setPage(1); }, [statusFilter, filterNotPushed]);

  useEffect(() => {
    if (!deepLinkId || !data?.items?.length) return;
    const found = data.items.find((r) => r.id === deepLinkId);
    if (found) {
      setSelected(found);
      setUserNote(found.userNote ?? '');
    }
  }, [deepLinkId, data?.items]);

  const handleStatusUpdate = async (reportId: string, newStatus: ReportStatus) => {
    setUpdating(true);
    try {
      await reportsApi.updateStatus(reportId, newStatus, userNote || undefined);
      setSelected(null);
      setUserNote('');
      showToast(`Durum güncellendi → ${STATUS_META[newStatus].label}`);
      fetchReports();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Durum güncellenemedi', true);
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickAction = async (
    e: React.MouseEvent,
    report: Report,
    newStatus: ReportStatus,
  ) => {
    e.stopPropagation();
    setUpdating(true);
    try {
      await reportsApi.updateStatus(report.id, newStatus);
      showToast(`→ ${STATUS_META[newStatus].label}`);
      fetchReports();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'İşlem başarısız', true);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = useMemo(() => {
    let items = data?.items ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((r) =>
        r.description.toLowerCase().includes(q) ||
        r.market?.name?.toLowerCase().includes(q) ||
        r.marketNameOther?.toLowerCase().includes(q) ||
        r.user?.name?.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q)
      );
    }
    if (filterPhoto) items = items.filter((r) => (r.images?.length ?? 0) > 0);
    if (filterUrgent) items = items.filter((r) => isExpiringSoon(r.expiryDate));
    return sortReports(items, sort);
  }, [data?.items, search, sort, filterPhoto, filterUrgent]);

  const notPushedCount = useMemo(
    () => (data?.items ?? []).filter((r) => !r.pushedToMarketAt).length,
    [data?.items],
  );

  const urgentCount = useMemo(
    () => filtered.filter((r) => r.status === 'PENDING' && isExpiringSoon(r.expiryDate)).length,
    [filtered],
  );

  const tabs = allowedFilters.map((s) => ({
    key: s,
    label: STATUS_META[s].label,
    icon: STATUS_META[s].icon,
    count: statusFilter === s ? data?.total : undefined,
  }));

  return (
    <div className="space-y-5 max-w-5xl" style={{ color: C.text }}>
      {toast && <AdminToast message={toast.msg} error={toast.err} />}

      <PageHero
        badge={heroBadge}
        title={title}
        subtitle={subtitle}
        gradient={HERO_GRADIENT}
        actions={
          <button
            type="button"
            onClick={fetchReports}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white/90 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            ↻ Yenile
          </button>
        }
        metrics={[
          { label: 'Bu Sayfada', value: filtered.length, icon: '📋' },
          { label: 'Toplam Kayıt', value: data?.total ?? '—', icon: '📊' },
          { label: 'Acil', value: urgentCount, icon: '⚠️' },
          { label: 'Durum', value: STATUS_META[statusFilter].label, icon: STATUS_META[statusFilter].icon },
        ]}
      />

      {urgentCount > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-semibold"
          style={{ background: `${C.red}12`, border: `1px solid ${C.red}30`, color: C.red }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: C.red }} />
          {urgentCount} acil ihbar — SKT yaklaşıyor veya geçmiş, öncelikli inceleme gerekir
        </div>
      )}

      {showWorkflowGuide && <WorkflowGuide variant="inspector" />}

      <TabBar tabs={tabs} active={statusFilter} onChange={setStatusFilter} />

      <ReportFiltersBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        resultCount={filtered.length}
        totalCount={data?.total}
        searchPlaceholder="Market, kullanıcı, şehir veya açıklama ara..."
        chips={[
          ...(statusFilter !== 'RESOLVED' && statusFilter !== 'REJECTED' && statusFilter !== 'APPROVED' ? [{
            key: 'notPushed',
            label: `Markete iletilmemiş${notPushedCount > 0 ? ` (${notPushedCount})` : ''}`,
            icon: '📤',
            active: filterNotPushed,
            onClick: () => setFilterNotPushed((v) => !v),
          }] : []),
          {
            key: 'urgent',
            label: 'SKT acil',
            icon: '⚠️',
            active: filterUrgent,
            onClick: () => setFilterUrgent((v) => !v),
          },
          {
            key: 'photo',
            label: 'Fotoğraflı',
            icon: '📷',
            active: filterPhoto,
            onClick: () => setFilterPhoto((v) => !v),
          },
        ]}
      />

      {loading ? (
        <LoadingCenter />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📭" title={emptyMessage} subtitle="Yeni ihbarlar mobil uygulamadan geldiğinde burada listelenir." />
      ) : (
        <div className="space-y-2">
          {filtered.map((report) => {
            const meta = STATUS_META[report.status];
            const urgent = isExpiringSoon(report.expiryDate) && report.status === 'PENDING';

            return (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelected(report); setUserNote(report.userNote ?? ''); }}
                onKeyDown={(e) => e.key === 'Enter' && (setSelected(report), setUserNote(report.userNote ?? ''))}
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
                      className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                      style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <span className="text-xs" style={{ color: C.muted }}>
                      {report.isAnonymous ? 'Anonim' : (report.user?.name ?? '—')}
                    </span>
                    {(report.market || report.marketNameOther) && (
                      <>
                        <span className="text-xs" style={{ color: C.muted }}>·</span>
                        <span className="text-xs font-medium" style={{ color: C.secondary }}>
                          🏪 {report.market?.name ?? report.marketNameOther}
                        </span>
                      </>
                    )}
                    {report.pushedToMarketAt && (
                      <>
                        <span className="text-xs" style={{ color: C.muted }}>·</span>
                        <span className="text-xs font-bold" style={{ color: C.green }}>✓ Markete iletildi</span>
                      </>
                    )}
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
                          style={{ color: isExpiringSoon(report.expiryDate) ? C.red : C.amber }}
                        >
                          SKT {formatDate(report.expiryDate)}
                        </span>
                      </>
                    )}
                  </div>

                  {report.userNote && (
                    <p
                      className="text-xs mt-2 px-2 py-1 rounded-lg inline-block font-medium"
                      style={{ background: `${C.blue}12`, color: C.blue }}
                    >
                      👤 {report.userNote}
                    </p>
                  )}
                  {report.marketNote && (
                    <p
                      className="text-xs mt-1 px-2 py-1 rounded-lg inline-block font-medium"
                      style={{ background: `${ACCENT}15`, color: ACCENT }}
                    >
                      🏪 {report.marketNote}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex flex-col gap-1.5">
                  {report.status === 'PENDING' && NEXT_STATUSES.PENDING[0] && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={(e) => handleQuickAction(e, report, 'UNDER_REVIEW')}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-40"
                      style={{ background: '#f59e0b' }}
                    >
                      ⚡ İncelemeye Al
                    </button>
                  )}
                  {!report.pushedToMarketAt && report.status === 'UNDER_REVIEW' && (
                    <span className="text-[9px] font-bold text-center px-1" style={{ color: C.amber }}>
                      Markete iletilmedi
                    </span>
                  )}
                  {report.pushedToMarketAt && <SlaBadge pushedAt={report.pushedToMarketAt} C={C} />}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(report); setUserNote(report.userNote ?? ''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: ACCENT }}
                  >
                    İncele
                  </button>
                </div>
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
            Toplam <strong style={{ color: C.text }}>{data.total}</strong> kayıt · Sayfa {data.page}/{data.totalPages}
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
              style={{ background: ACCENT }}
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
              <div className="flex items-center gap-3">
                <span className="text-xl">🔍</span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT }}>
                    İhbar Detayı
                  </p>
                  <p className="text-sm font-black" style={{ color: C.text }}>
                    #{selected.id.slice(-8).toUpperCase()}
                  </p>
                </div>
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
                  İhbar Açıklaması
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
                    {isExpiringSoon(selected.expiryDate) && (
                      <p className="text-xs font-bold mt-1" style={{ color: C.red }}>Acil inceleme gerekiyor</p>
                    )}
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
                    Yüklenen Görseller
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
                accentColor={ACCENT}
                onSuccess={(updated) => {
                  setSelected(updated);
                  fetchReports();
                }}
              />

              {selected.marketNote && (
                <div className="p-4 rounded-xl" style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}35` }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>Market Notu</p>
                  <p className="text-xs mt-0.5 mb-1" style={{ color: C.muted }}>Yalnızca market yöneticisi görür</p>
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
                      Kullanıcıya Yanıt Notu
                    </p>
                    <textarea
                      rows={3}
                      value={userNote}
                      onChange={(e) => setUserNote(e.target.value)}
                      placeholder="Kullanıcıya iletilecek inceleme sonucu (isteğe bağlı)..."
                      className="w-full rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-400/30"
                      style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
                    />
                    <p className="text-xs mt-1.5" style={{ color: C.muted }}>
                      Bu not kullanıcının mobil uygulamasında ihbar altında görünür.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <p className="text-sm font-bold mb-3" style={{ color: C.text }}>İşlem Seç</p>
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STATUSES[selected.status].map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          onClick={() => handleStatusUpdate(selected.id, action.status)}
                          disabled={updating}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                          style={{ background: action.color }}
                        >
                          {updating ? 'İşleniyor...' : action.label}
                        </button>
                      ))}
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
