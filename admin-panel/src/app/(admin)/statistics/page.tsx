'use client';

import { useEffect, useState } from 'react';
import { statisticsApi } from '../../../lib/api';
import { AdminStatistics } from '../../../types';
import {
  StatsPageHeader, MetricCard, SectionCard, StatusBreakdown,
  TrendChart, RankList, LoadingStats, formatDate,
} from '../../../components/statistics/StatsUI';

const REPORT_COLORS = {
  pending: '#F59E0B',
  underReview: '#3B82F6',
  approved: '#10B981',
  rejected: '#EF4444',
  resolved: '#6B7280',
};

export default function AdminStatisticsPage() {
  const [data, setData] = useState<AdminStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    statisticsApi.getAdmin()
      .then(setData)
      .catch(() => setError('İstatistikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingStats />;
  if (error || !data) {
    return <p className="text-red-600 text-sm py-8">{error || 'Veri yok'}</p>;
  }

  const { overview, users, reports, prices, inspectors } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <StatsPageHeader
        title="Sistem İstatistikleri"
        subtitle="Tüm Akıllı Sepet ekosisteminin operasyonel özeti — kullanıcılar, ürünler, fiyatlar, ihbarlar ve denetçi performansı."
        accent="#2563EB"
        badge={`Güncellendi: ${formatDate(data.generatedAt)}`}
      />

      {/* Genel bakış */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Kullanıcı" value={overview.totalUsers} sub={`+${users.newLast30Days} son 30 gün`} icon="👥" />
        <MetricCard label="Aktif Ürün" value={overview.activeProducts} sub={`${overview.totalProducts} toplam`} accent="#10B981" icon="📦" />
        <MetricCard label="Market / Şube" value={`${overview.totalMarkets} / ${overview.totalBranches}`} icon="🏪" accent="#F97316" />
        <MetricCard label="Fiyat Kaydı" value={overview.totalPrices} sub={`${overview.priceUpdates24h} güncelleme (24s)`} accent="#06B6D4" icon="💰" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* İhbarlar */}
        <SectionCard title="İhbar Durumu" desc="Tüm sistemdeki SKT ihbarları">
          <StatusBreakdown items={[
            { label: 'Bekleyen', value: reports.pending, color: REPORT_COLORS.pending },
            { label: 'İnceleniyor', value: reports.underReview, color: REPORT_COLORS.underReview },
            { label: 'Onaylanan', value: reports.approved, color: REPORT_COLORS.approved },
            { label: 'Reddedilen', value: reports.rejected, color: REPORT_COLORS.rejected },
            { label: 'Çözülen', value: reports.resolved, color: REPORT_COLORS.resolved },
          ]} />
          <p className="text-xs text-slate-400 mt-4">
            Markete iletilen: <strong className="text-slate-700">{reports.pushedToMarket}</strong>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <TrendChart data={reports.last7DaysTrend} color="#EF4444" label="Günlük yeni ihbar (7 gün)" />
          </div>
        </SectionCard>

        {/* Fiyatlar */}
        <SectionCard title="Fiyat Operasyonu" desc="Güncellik ve market kapsamı">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Güncel Fiyat" value={prices.total} accent="#06B6D4" />
            <MetricCard label="Eski Fiyat (10g+)" value={prices.stale} accent="#EF4444" sub="Güncellenmeli" />
          </div>
          <TrendChart data={prices.last7DaysTrend} color="#06B6D4" label="Fiyat güncelleme (7 gün)" />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* En çok ihbar alan marketler */}
        <SectionCard title="En Çok İhbar Alan Marketler" desc="Top 5">
          <RankList
            items={reports.topMarkets.map((m) => ({
              name: m.market?.name ?? 'Bilinmiyor',
              count: m.count,
            }))}
          />
        </SectionCard>

        {/* Kategori dağılımı */}
        <SectionCard title="İhbar Kategorileri" desc="Ürün kategorisine göre">
          <RankList
            items={reports.topCategories.map((c) => ({
              name: `${c.category.icon ?? ''} ${c.category.name}`.trim(),
              count: c.count,
            }))}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Market fiyat kapsamı */}
        <SectionCard title="Market Fiyat Kapsamı" desc="Katalogdaki ürünlerin yüzde kaçı fiyatlandırılmış">
          <RankList
            items={prices.marketCoverage.map((m) => ({
              name: m.name,
              count: m.coveragePercent,
            }))}
            valueKey="count"
          />
          <p className="text-[10px] text-slate-400 mt-2">* Yüzde değeri</p>
        </SectionCard>

        {/* Denetçi performansı */}
        <SectionCard title="Denetçi Performansı" desc={`${inspectors.active} aktif denetçi — en çok inceleyenler`}>
          <RankList
            items={inspectors.leaderboard.map((i) => ({
              name: i.name,
              count: i.reviewedCount,
            }))}
          />
        </SectionCard>
      </div>

      {/* Kullanıcı rolleri */}
      <SectionCard title="Kullanıcı Rolleri" desc="Sistemdeki hesap dağılımı">
        <div className="flex flex-wrap gap-3">
          {users.byRole.map((r) => (
            <div key={r.role} className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[120px]">
              <p className="text-[10px] font-bold uppercase text-slate-400">{r.role.replace('_', ' ')}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{r.count}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
