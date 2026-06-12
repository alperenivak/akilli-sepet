'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { statisticsApi } from '../../../lib/api';
import { MarketStatistics } from '../../../types';
import {
  StatsPageHeader, MetricCard, SectionCard, StatusBreakdown,
  TrendChart, RankList, CoverageRing, LoadingStats, formatDate, formatKurus,
} from '../../../components/statistics/StatsUI';

const REPORT_COLORS = {
  pending: '#F59E0B',
  underReview: '#3B82F6',
  approved: '#10B981',
  rejected: '#EF4444',
  resolved: '#6B7280',
};

export default function MarketStatisticsPage() {
  const [data, setData] = useState<MarketStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    statisticsApi.getMarket()
      .then(setData)
      .catch(() => setError('İstatistikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingStats />;
  if (error || !data) {
    return <p className="text-red-600 text-sm py-8">{error || 'Veri yok'}</p>;
  }

  const { market, products, operations, reports, categoryPricing } = data;
  const accent = market.brandColor ?? '#10B981';

  return (
    <div className="space-y-6 max-w-6xl">
      <StatsPageHeader
        title={`${market.name} — Operasyon İstatistikleri`}
        subtitle="Ürün fiyat kapsamı, güncellik durumu ve marketinize gelen ihbarlar."
        accent={accent}
        badge={`Güncellendi: ${formatDate(data.generatedAt)}`}
      />

      {(reports.pending > 0 || products.missingPrice > 0) && (
        <div className="flex flex-wrap gap-2">
          {reports.pending > 0 && (
            <Link href="/market-panel/reports?status=PENDING"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: accent }}>
              ⚠️ {reports.pending} bekleyen ihbara git
            </Link>
          )}
          {products.missingPrice > 0 && (
            <Link href="/market-panel/prices"
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
              💰 {products.missingPrice} üründe fiyat eksik
            </Link>
          )}
          {products.stalePrices > 0 && (
            <span className="px-4 py-2 rounded-xl text-xs font-semibold text-red-700 bg-red-50 border border-red-200">
              ⏰ {products.stalePrices} eski fiyat güncellenmeli
            </span>
          )}
        </div>
      )}

      {/* Ürün & fiyat özeti */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Fiyat Kapsamı" desc="Katalogdaki ürünlerin kaçında fiyat var">
          <CoverageRing percent={products.coveragePercent} label="fiyat girilmiş ürün" />
          <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
              <p className="text-[10px] font-bold uppercase opacity-70">Fiyatlı</p>
              <p className="font-bold text-lg">{products.withPrice}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-800">
              <p className="text-[10px] font-bold uppercase opacity-70">Eksik</p>
              <p className="font-bold text-lg">{products.missingPrice}</p>
            </div>
          </div>
        </SectionCard>

        <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
          <MetricCard label="Fiyatlı Ürün" value={products.withPrice} sub={`/${products.totalInCatalog} katalog`} accent={accent} icon="💰" />
          <MetricCard label="Eksik Fiyat" value={products.missingPrice} accent="#F59E0B" icon="⚠️" />
          <MetricCard label="Eski Fiyat (10g+)" value={products.stalePrices} accent="#EF4444" sub="Güncellenmeli" />
          <MetricCard label="Haftalık Güncelleme" value={products.priceUpdatesThisWeek} accent="#06B6D4" icon="📈" />
          <MetricCard label="Ort. Fiyat" value={formatKurus(products.avgPriceKurus)} icon="🏷️" />
          <MetricCard label="Şube / Katalog" value={`${operations.branches} / ${operations.activeCatalogs}`} icon="📍" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Market İhbarları" desc="Marketinize gelen SKT ihbarları">
          <StatusBreakdown items={[
            { label: 'Bekleyen', value: reports.pending, color: REPORT_COLORS.pending },
            { label: 'İnceleniyor', value: reports.underReview, color: REPORT_COLORS.underReview },
            { label: 'Onaylanan', value: reports.approved, color: REPORT_COLORS.approved },
            { label: 'Reddedilen', value: reports.rejected, color: REPORT_COLORS.rejected },
            { label: 'Çözülen', value: reports.resolved, color: REPORT_COLORS.resolved },
          ]} />
          <p className="text-xs text-slate-400 mt-3">
            Denetçiden iletilen: <strong className="text-slate-700">{reports.pushedToMarket}</strong>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <TrendChart data={reports.last7DaysTrend} color={accent} label="Günlük ihbar (7 gün)" />
          </div>
        </SectionCard>

        <SectionCard title="En Çok İhbar Edilen Ürünler" desc="Marketinizde dikkat gerektiren ürünler">
          <RankList
            items={reports.topProducts.map((p) => ({
              name: p.product ? `${p.product.name}${p.product.brand ? ` (${p.product.brand})` : ''}` : 'Bilinmiyor',
              count: p.count,
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard title="Kategori Bazlı Fiyatlandırma" desc="Hangi kategorilerde kaç ürününüzün fiyatı var">
        <RankList
          items={categoryPricing.map((c) => ({
            name: `${c.category.icon ?? ''} ${c.category.name}`.trim(),
            count: c.count,
          }))}
        />
      </SectionCard>
    </div>
  );
}
