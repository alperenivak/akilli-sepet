'use client';

import { useEffect, useState } from 'react';
import { marketPanelApi, statisticsApi } from '../../../lib/api';
import { ManagedMarket, Report } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import Link from 'next/link';
import { WorkflowGuide } from '../../../components/panels/WorkflowGuide';
import { MarketStatistics } from '../../../types';

interface MarketStats {
  pendingReports: number;
  totalReports: number;
  activeCatalogs: number;
  totalBranches: number;
}

function buildTips(stats: MarketStats): string[] {
  const tips: string[] = [];
  if (stats.pendingReports > 0) tips.push(`${stats.pendingReports} bekleyen ihbar market güven skorunuzu etkileyebilir.`);
  if (stats.activeCatalogs === 0) tips.push('Aktif kampanya kataloğunuz yok. Rakiplere karşı avantaj kaybı oluşabilir.');
  if (stats.totalBranches > 1) tips.push(`${stats.totalBranches} şubenizin fiyat güncelliğini periyodik kontrol edin.`);
  tips.push('Temel gıda kategorisinde rakip ortalama fiyat takibi için analiz bölümünü kullanın.');
  tips.push('Fiyat kapsamını doldurmak sepet önerilerinde sıranızı yükseltir.');
  return tips;
}

function HalkaCizim({ pct, color, size = 70 }: { pct: number; color: string; size?: number }) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={13} fontWeight="700">{Math.round(pct)}%</text>
    </svg>
  );
}

export default function MarketYonetimPaneli() {
  const C = useColors();
  const [market,        setMarket]        = useState<ManagedMarket | null>(null);
  const [stats,         setStats]         = useState<MarketStats | null>(null);
  const [priceCovPct,   setPriceCovPct]   = useState<number | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [userName,      setUserName]      = useState('');
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [mktStats, setMktStats] = useState<MarketStatistics | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (raw) { const u = JSON.parse(raw); setMarket(u.managedMarket ?? null); setUserName(u.name ?? ''); }
    } catch { /**/ }
  }, []);

  useEffect(() => {
    if (!market) return;
    const load = async () => {
      setLoading(true);
      try {
        const [pendingData, allData, catalogsData, marketData, mktStatsData] = await Promise.allSettled([
          marketPanelApi.getReports(market.id, { status: 'PENDING', limit: 5 }),
          marketPanelApi.getReports(market.id, { limit: 1 }),
          marketPanelApi.getCatalogs(market.id),
          marketPanelApi.getMarket(market.id),
          statisticsApi.getMarket(),
        ]);
        const pending  = pendingData.status  === 'fulfilled' ? (pendingData.value?.total ?? 0)  : 0;
        const total    = allData.status      === 'fulfilled' ? (allData.value?.total ?? 0)      : 0;
        const catalogs = catalogsData.status === 'fulfilled' ? (Array.isArray(catalogsData.value) ? catalogsData.value.length : 0) : 0;
        const branches = marketData.status   === 'fulfilled' ? (marketData.value?._count?.branches ?? 0) : 0;
        setStats({ pendingReports: pending, totalReports: total, activeCatalogs: catalogs, totalBranches: branches });
        if (pendingData.status === 'fulfilled') setRecentReports((pendingData.value?.items ?? []) as Report[]);
        if (mktStatsData.status === 'fulfilled' && mktStatsData.value) {
          setMktStats(mktStatsData.value);
          setPriceCovPct(mktStatsData.value.products?.coveragePercent ?? null);
        }
      } finally { setLoading(false); }
    };
    load();
  }, [market]);

  const brand       = market?.brandColor ?? '#3b82f6';
  const hour        = new Date().getHours();
  const selamlama   = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const tips        = stats ? buildTips(stats) : [];
  const priceCoverage = priceCovPct ?? 0;

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {/* Performans Hero */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${brand}15 0%, transparent 70%)`, transform: 'translate(20%,-20%)' }} />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brand }}>
              Market Yönetim Paneli
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>
              {selamlama}, <span style={{ color: brand }}>{userName || 'Market Yöneticisi'}</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: C.muted }}>{market?.name ?? 'Market'} · Retail Operasyon Merkezi</p>

            {!loading && stats && (
              <div className="flex flex-wrap gap-3 mt-4">
                {[
                  { label: 'Bekleyen İhbar', value: stats.pendingReports, color: stats.pendingReports > 0 ? C.red : C.green, href: '/market-panel/reports' },
                  { label: 'Toplam İhbar',   value: stats.totalReports,   color: C.amber,  href: '/market-panel/reports' },
                  { label: 'Aktif Katalog',  value: stats.activeCatalogs, color: C.purple, href: '/market-panel/catalog' },
                  { label: 'Şube',           value: stats.totalBranches,  color: C.cyan,   href: '/market-panel/branches' },
                ].map((s) => (
                  <Link key={s.label} href={s.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:brightness-105"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}>
                    <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-xs font-medium" style={{ color: C.secondary }}>{s.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {!loading && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <HalkaCizim pct={priceCoverage} color={brand} size={70} />
              <p className="text-[11px] text-center" style={{ color: C.muted }}>Fiyat<br/>Kapsamı</p>
            </div>
          )}
        </div>
      </div>

      <WorkflowGuide variant="market" />

      {stats && stats.pendingReports > 0 && (
        <Link href="/market-panel/reports"
          className="block rounded-xl px-4 py-3 transition-all hover:brightness-105"
          style={{ background: `${C.red}10`, border: `1px solid ${C.red}30` }}>
          <p className="text-sm font-bold" style={{ color: C.red }}>
            ⚠️ {stats.pendingReports} ihbar yanıt bekliyor
          </p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            Denetçiden gelen bildirimleri inceleyip durum güncellemesi yapın →
          </p>
        </Link>
      )}

      {/* İki sütun */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* İhbar Yanıt Merkezi */}
        <div className="fp-card overflow-hidden xl:col-span-2">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: brand }}>Gelen İhbarlar</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>İhbar Yanıt Merkezi</p>
            </div>
            <Link href="/market-panel/reports"
              className="text-xs font-medium px-2 py-1 rounded-lg"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
              Tümü →
            </Link>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
              </div>
            ) : recentReports.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm font-semibold" style={{ color: C.secondary }}>Bekleyen ihbar yok</p>
                <p className="text-xs mt-1" style={{ color: C.muted }}>Marketinizle ilgili aktif şikayet bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentReports.map((r) => (
                  <Link key={r.id} href={`/market-panel/reports?status=PENDING`}
                    className="flex items-start gap-4 p-4 rounded-xl transition-all hover:brightness-105"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
                      style={{ background: `${brand}12` }}>
                      ⚠️
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-1" style={{ color: C.text }}>{r.description}</p>
                      {r.marketNote && (
                        <p className="text-[10px] mt-1 line-clamp-1 font-medium" style={{ color: C.amber }}>
                          📝 {r.marketNote}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {r.expiryDate && (
                          <span className="text-xs font-bold" style={{ color: C.red }}>
                            SKT: {new Date(r.expiryDate).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: C.muted }}>
                          {new Date(r.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}25`, color: C.amber }}>
                      Bekliyor
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sağ sütun */}
        <div className="space-y-4">

          {/* Yapay Zeka Danışmanı */}
          <div className="fp-card p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${brand}12` }}>🤖</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: brand }}>Yapay Zeka Danışmanı</p>
                <p className="text-sm font-bold" style={{ color: C.text }}>İşletme Önerileri</p>
              </div>
            </div>
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: `${brand}08`, border: `1px solid ${brand}20` }}>
                <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: brand }}>›</span>
                <p className="text-xs leading-relaxed" style={{ color: C.text }}>{tip}</p>
              </div>
            ))}
          </div>

          {/* Hızlı Erişim */}
          <div className="fp-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Hızlı Erişim</p>
            {[
              { label: 'İhbarları İncele', href: '/market-panel/reports',    icon: '⚠️' },
              { label: 'Katalog Yönetimi', href: '/market-panel/catalog',    icon: '📖' },
              { label: 'Şubeler',          href: '/market-panel/branches',   icon: '📍' },
              { label: 'İstatistikler',    href: '/market-panel/statistics', icon: '📈' },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:brightness-105"
                style={{ color: C.secondary }}>
                <span className="text-base">{item.icon}</span>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                <span className="text-xs" style={{ color: C.muted }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Operasyon özeti */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="fp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Fiyat Kapsamı</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Katalog Durumu</p>
            </div>
            <Link href="/market-panel/prices" className="text-xs font-medium" style={{ color: brand }}>Fiyatlar →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Fiyatlı', value: mktStats?.products.withPrice ?? '—', color: C.green },
              { label: 'Eksik', value: mktStats?.products.missingPrice ?? '—', color: C.amber },
              { label: 'Eski (10g+)', value: mktStats?.products.stalePrices ?? '—', color: C.red },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: C.cardAlt }}>
                <p className="text-xl font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[10px] font-bold mt-1" style={{ color: C.muted }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="fp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>İhbar Özeti</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Denetçiden Gelenler</p>
            </div>
            <Link href="/market-panel/statistics" className="text-xs font-medium" style={{ color: brand }}>Detay →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bekleyen', value: mktStats?.reports.pending ?? stats?.pendingReports ?? 0, color: C.amber },
              { label: 'İnceleniyor', value: mktStats?.reports.underReview ?? 0, color: C.blue },
              { label: 'Çözülen', value: mktStats?.reports.resolved ?? 0, color: C.green },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: C.cardAlt }}>
                <p className="text-xl font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[10px] font-bold mt-1" style={{ color: C.muted }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(mktStats?.categoryPricing?.length ?? 0) > 0 && (
        <div className="fp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Kategori Fiyatlandırma</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Fiyatı Girilmiş Ürün Sayısı</p>
            </div>
            <Link href="/market-panel/statistics" className="text-xs" style={{ color: C.muted }}>Tümü →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mktStats!.categoryPricing.slice(0, 8).map((item) => {
              const low = item.count < 5;
              return (
                <div key={item.category.id} className="rounded-xl p-4"
                  style={{ background: low ? `${C.amber}08` : `${brand}08`, border: `1px solid ${low ? C.amber + '22' : brand + '22'}` }}>
                  <p className="text-xs mb-2 line-clamp-1" style={{ color: C.muted }}>
                    {item.category.icon} {item.category.name}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: low ? C.amber : brand }}>{item.count}</p>
                  <p className="text-[10px] font-semibold mt-1" style={{ color: low ? C.amber : C.green }}>
                    {low ? '⚠ Fiyat ekle' : '✓ Kapsam var'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
