'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { catalogsApi, marketsApi } from '../../../lib/api';
import { useColors } from '../../../context/ThemeContext';
import {
  AdminToast, PageHero, TabBar, EmptyState, LoadingCenter,
} from '../../../components/admin/AdminUIKit';

interface Catalog {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  coverImageUrl?: string;
  pdfUrl?: string;
  scrapeSource?: string;
  pageCount: number;
  _count?: { pages: number };
  market?: { id: string; name: string; logoUrl?: string; brandColor?: string; slug?: string };
}

interface Market {
  id: string;
  name: string;
  slug: string;
  brandColor?: string;
  logoUrl?: string;
}

interface PaginatedResult {
  items: Catalog[];
  total: number;
  page: number;
  totalPages: number;
}

type ScrapeStatus = { market: string; created: number; updated: number; pages: number; errors: string[] };
type StatusFilter = 'all' | 'active' | 'upcoming' | 'expired' | 'inactive';
type ViewMode = 'grid' | 'list';

function catalogStatus(cat: Catalog) {
  const now = Date.now();
  const start = new Date(cat.startDate).getTime();
  const end = new Date(cat.endDate).getTime();
  if (!cat.isActive) return { label: 'Pasif', color: '#64748b', key: 'inactive' as const };
  if (now < start) return { label: 'Yaklaşan', color: '#60a5fa', key: 'upcoming' as const };
  if (now > end) return { label: 'Süresi Doldu', color: '#f87171', key: 'expired' as const };
  return { label: 'Güncel', color: '#34d399', key: 'active' as const };
}

const SCRAPERS = [
  { slug: 'a101', label: 'A101', color: '#dc2626' },
  { slug: 'bim', label: 'BİM', color: '#ea580c' },
  { slug: 'sok', label: 'ŞOK', color: '#d97706' },
  { slug: 'migros', label: 'Migros', color: '#7c3aed' },
  { slug: 'carrefoursa', label: 'CarrefourSA', color: '#1d4ed8' },
];

export default function AdminCatalogsPage() {
  const C = useColors();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterMarket, setFilterMarket] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<Record<string, 'idle' | 'running' | 'done'>>({});
  const [scrapeResults, setScrapeResults] = useState<ScrapeStatus[]>([]);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [scraperOpen, setScraperOpen] = useState(true);
  const [detail, setDetail] = useState<Catalog | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: PaginatedResult = await catalogsApi.getAll({
        page,
        limit: 24,
        marketId: filterMarket || undefined,
      });
      setCatalogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setCatalogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterMarket]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    marketsApi.getAll()
      .then((data: Market[] | { data?: Market[] }) => {
        setMarkets(Array.isArray(data) ? data : (data as { data?: Market[] }).data ?? []);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = catalogs;
    if (statusFilter !== 'all') {
      list = list.filter((c) => catalogStatus(c).key === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.market?.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [catalogs, statusFilter, search]);

  const stats = useMemo(() => {
    const active = catalogs.filter((c) => catalogStatus(c).key === 'active').length;
    const withPages = catalogs.filter((c) => (c._count?.pages ?? c.pageCount) > 0).length;
    const scraped = catalogs.filter((c) => c.scrapeSource === 'scraper').length;
    return { active, withPages, scraped };
  }, [catalogs]);

  const handleToggle = async (id: string) => {
    try {
      await catalogsApi.toggleActive(id);
      load();
      if (detail?.id === id) setDetail((d) => d ? { ...d, isActive: !d.isActive } : null);
    } catch { showToast('Durum güncellenemedi', true); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" silinecek. Onaylıyor musunuz?`)) return;
    try {
      await catalogsApi.delete(id);
      showToast('Katalog silindi');
      setDetail(null);
      load();
    } catch { showToast('Silinemedi', true); }
  };

  const handleScrapeMarket = async (slug: string) => {
    setScrapeStatus((prev) => ({ ...prev, [slug]: 'running' }));
    try {
      const result: ScrapeStatus = await catalogsApi.scrapeMarket(slug);
      setScrapeStatus((prev) => ({ ...prev, [slug]: 'done' }));
      setScrapeResults((prev) => [result, ...prev.filter((r) => r.market !== slug)]);
      showToast(`${slug.toUpperCase()}: +${result.created} yeni, ${result.pages} sayfa`);
      load();
    } catch {
      setScrapeStatus((prev) => ({ ...prev, [slug]: 'idle' }));
      showToast(`${slug} çekimi başarısız`, true);
    }
  };

  const handleScrapeAll = async () => {
    setScrapingAll(true);
    setScrapeResults([]);
    try {
      const results: ScrapeStatus[] = await catalogsApi.scrapeAll();
      setScrapeResults(results);
      showToast(`Toplu çekim: +${results.reduce((s, r) => s + r.created, 0)} yeni katalog`);
      load();
    } catch { showToast('Toplu çekim başarısız', true); }
    finally { setScrapingAll(false); }
  };

  const renderCard = (cat: Catalog, compact = false) => {
    const st = catalogStatus(cat);
    const market = cat.market;
    const brand = market?.brandColor ?? '#3b82f6';
    const pageCount = cat._count?.pages ?? cat.pageCount;
    const start = new Date(cat.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const end = new Date(cat.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

    if (compact) {
      return (
        <div
          key={cat.id}
          className="rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:brightness-[1.02] transition-all"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
          onClick={() => setDetail(cat)}
        >
          <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0" style={{ background: `${brand}15` }}>
            {cat.coverImageUrl ? (
              <img src={cat.coverImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl opacity-30">📖</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold" style={{ color: brand }}>{market?.name}</p>
            <p className="text-sm font-bold truncate">{cat.title}</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{start} → {end} · {pageCount} sayfa</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: `${st.color}20`, color: st.color }}>
            {st.label}
          </span>
        </div>
      );
    }

    return (
      <div
        key={cat.id}
        className="rounded-2xl overflow-hidden flex flex-col cursor-pointer group transition-all hover:shadow-lg hover:-translate-y-0.5"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
        onClick={() => setDetail(cat)}
      >
        <div className="h-40 relative overflow-hidden" style={{ background: cat.coverImageUrl ? undefined : `${brand}12` }}>
          {cat.coverImageUrl ? (
            <img src={cat.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-20">📖</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-sm" style={{ background: `${st.color}cc`, color: '#fff' }}>
              {st.label}
            </span>
          </div>
          {pageCount > 0 && (
            <div className="absolute bottom-2 left-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                {pageCount} sayfa
              </span>
            </div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col gap-1.5">
          {market && (
            <div className="flex items-center gap-1.5">
              {market.logoUrl && <img src={market.logoUrl} alt="" className="w-4 h-4 rounded object-contain" />}
              <span className="text-[11px] font-bold" style={{ color: brand }}>{market.name}</span>
            </div>
          )}
          <p className="text-xs font-semibold line-clamp-2 leading-snug">{cat.title}</p>
          <p className="text-[10px]" style={{ color: C.muted }}>{start} – {end}</p>
          {cat.scrapeSource === 'scraper' && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full w-fit" style={{ background: `${brand}15`, color: brand }}>
              OTOMATİK
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px]" style={{ color: C.text }}>
      {toast && <AdminToast message={toast.msg} error={toast.err} />}

      <PageHero
        badge="Aktüel Yönetimi"
        title="Katalog Merkezi"
        subtitle="Tüm market zincirlerinin haftalık broşürlerini yönetin, otomatik çekin ve mobil uygulamada yayınlayın."
        gradient="linear-gradient(135deg, #312e81 0%, #5b21b6 50%, #7c3aed 100%)"
        actions={(
          <button
            onClick={handleScrapeAll}
            disabled={scrapingAll}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}
          >
            {scrapingAll ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Çekiliyor…</>
            ) : (
              <>⬇ Tümünü Çek</>
            )}
          </button>
        )}
        metrics={[
          { label: 'Toplam Katalog', value: total, icon: '📚' },
          { label: 'Güncel', value: stats.active, icon: '✅' },
          { label: 'Sayfalı', value: stats.withPages, icon: '📄' },
          { label: 'Otomatik', value: stats.scraped, icon: '🤖' },
        ]}
      />

      {/* Scraper panel */}
      <section className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <button
          type="button"
          className="w-full px-5 py-4 flex items-center justify-between text-left"
          style={{ background: C.cardAlt, borderBottom: scraperOpen ? `1px solid ${C.border}` : undefined }}
          onClick={() => setScraperOpen((v) => !v)}
        >
          <div>
            <h2 className="text-sm font-bold">Otomatik Çekim Merkezi</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>kimbino.com.tr üzerinden market katalogları</p>
          </div>
          <span style={{ color: C.muted }}>{scraperOpen ? '▲' : '▼'}</span>
        </button>
        {scraperOpen && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SCRAPERS.map((sc) => {
              const status = scrapeStatus[sc.slug] ?? 'idle';
              const result = scrapeResults.find((r) => r.market === sc.slug);
              return (
                <div key={sc.slug} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm" style={{ color: sc.color }}>{sc.label}</span>
                    {result && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: `${C.green}18`, color: C.green }}>
                        +{result.created}
                      </span>
                    )}
                  </div>
                  {result && (
                    <p className="text-[10px]" style={{ color: C.muted }}>{result.pages} sayfa · {result.errors.length} hata</p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleScrapeMarket(sc.slug); }}
                    disabled={status === 'running'}
                    className="w-full py-2 rounded-lg text-[11px] font-bold disabled:opacity-40 mt-auto"
                    style={{ background: `${sc.color}12`, color: sc.color, border: `1px solid ${sc.color}28` }}
                  >
                    {status === 'running' ? '…' : status === 'done' ? '✓ Tekrar' : 'Çek'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Katalog veya market ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-400/30"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        />
        <select
          value={filterMarket}
          onChange={(e) => { setFilterMarket(e.target.value); setPage(1); }}
          className="rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          <option value="">Tüm Marketler</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          {(['grid', 'list'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className="px-3 py-2.5 text-sm"
              style={{ background: viewMode === m ? C.cardAlt : C.card, color: viewMode === m ? C.text : C.muted }}
            >
              {m === 'grid' ? '▦' : '☰'}
            </button>
          ))}
        </div>
      </div>

      <TabBar<StatusFilter>
        active={statusFilter}
        onChange={setStatusFilter}
        tabs={[
          { key: 'all', label: 'Tümü', count: catalogs.length },
          { key: 'active', label: 'Güncel' },
          { key: 'upcoming', label: 'Yaklaşan' },
          { key: 'expired', label: 'Süresi Doldu' },
          { key: 'inactive', label: 'Pasif' },
        ]}
      />

      {loading ? (
        <LoadingCenter />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📂"
          title="Katalog bulunamadı"
          subtitle="Filtreleri değiştirin veya otomatik çekim başlatın."
          action={(
            <button
              type="button"
              onClick={handleScrapeAll}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: C.purple }}
            >
              Tüm Marketleri Çek
            </button>
          )}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filtered.map((cat) => renderCard(cat))}
        </div>
      ) : (
        <div className="space-y-2">{filtered.map((cat) => renderCard(cat, true))}</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            ← Önceki
          </button>
          <span className="text-sm tabular-nums" style={{ color: C.muted }}>{page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            Sonraki →
          </button>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {detail.coverImageUrl && (
              <div className="h-48 relative shrink-0">
                <img src={detail.coverImageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <button type="button" onClick={() => setDetail(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white text-sm">✕</button>
              </div>
            )}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {!detail.coverImageUrl && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setDetail(null)} className="text-sm" style={{ color: C.muted }}>✕ Kapat</button>
                </div>
              )}
              <div>
                <p className="text-xs font-bold" style={{ color: detail.market?.brandColor ?? C.purple }}>
                  {detail.market?.name}
                </p>
                <h2 className="text-xl font-black mt-1">{detail.title}</h2>
                <p className="text-sm mt-2" style={{ color: C.muted }}>
                  {new Date(detail.startDate).toLocaleDateString('tr-TR')} – {new Date(detail.endDate).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { l: 'Sayfa', v: detail._count?.pages ?? detail.pageCount },
                  { l: 'Durum', v: catalogStatus(detail).label },
                  { l: 'Kaynak', v: detail.scrapeSource === 'scraper' ? 'Otomatik' : 'Manuel' },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl p-3" style={{ background: C.cardAlt }}>
                    <p className="text-lg font-black">{x.v}</p>
                    <p className="text-[9px] font-bold uppercase mt-1" style={{ color: C.muted }}>{x.l}</p>
                  </div>
                ))}
              </div>
              {detail.pdfUrl && (
                <a href={detail.pdfUrl} target="_blank" rel="noreferrer"
                  className="block text-center py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: `${C.blue}15`, color: C.blue }}>
                  PDF Aç →
                </a>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => handleToggle(detail.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: detail.isActive ? `${C.amber}15` : `${C.green}15`, color: detail.isActive ? C.amber : C.green }}>
                  {detail.isActive ? 'Pasife Al' : 'Aktifleştir'}
                </button>
                <button type="button" onClick={() => handleDelete(detail.id, detail.title)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: `${C.red}12`, color: C.red }}>
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
