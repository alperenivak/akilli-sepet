'use client';

import { useEffect, useState } from 'react';
import { statisticsApi } from '../../../lib/api';
import { InspectorStatistics } from '../../../types';
import Link from 'next/link';
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

export default function InspectorStatisticsPage() {
  const [data, setData] = useState<InspectorStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    statisticsApi.getInspector()
      .then(setData)
      .catch(() => setError('İstatistikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingStats />;
  if (error || !data) {
    return <p className="text-red-600 text-sm py-8">{error || 'Veri yok'}</p>;
  }

  const { queue, myPerformance, insights } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      <StatsPageHeader
        title="İhbar İstatistikleri"
        subtitle="İnceleme kuyruğu, kişisel performansınız ve ihbar trendleri."
        accent="#F59E0B"
        badge={`Güncellendi: ${formatDate(data.generatedAt)}`}
      />

      {(queue.pending > 0 || insights.urgentExpiry > 0) && (
        <div className="flex flex-wrap gap-2">
          {queue.pending > 0 && (
            <Link href="/inspector-panel/reports"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: '#f59e0b' }}>
              📥 {queue.pending} bekleyen ihbara git
            </Link>
          )}
          {insights.urgentExpiry > 0 && (
            <Link href="/inspector-panel/reports"
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
              ⚠️ {insights.urgentExpiry} SKT acil vaka
            </Link>
          )}
          {myPerformance.pushedToMarket > 0 && (
            <span className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200">
              📤 Bu dönem {myPerformance.pushedToMarket} ihbar markete iletildi
            </span>
          )}
        </div>
      )}

      {/* Kişisel performans */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Bugün İncelenen" value={myPerformance.reviewedToday} accent="#F59E0B" icon="📋" />
        <MetricCard label="Bu Hafta" value={myPerformance.reviewedThisWeek} icon="📅" />
        <MetricCard label="Onay Oranı" value={`%${myPerformance.approvalRate}`} sub={`${myPerformance.approved} onay / ${myPerformance.totalReviewed} toplam`} accent="#10B981" icon="✅" />
        <MetricCard label="Markete İletilen" value={myPerformance.pushedToMarket} accent="#8B5CF6" icon="📤" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Genel İhbar Kuyruğu" desc="Sistemdeki tüm ihbarların durumu">
          <StatusBreakdown items={[
            { label: 'Bekleyen', value: queue.pending, color: REPORT_COLORS.pending },
            { label: 'İnceleniyor', value: queue.underReview, color: REPORT_COLORS.underReview },
            { label: 'Onaylanan', value: queue.approved, color: REPORT_COLORS.approved },
            { label: 'Reddedilen', value: queue.rejected, color: REPORT_COLORS.rejected },
            { label: 'Çözülen', value: queue.resolved, color: REPORT_COLORS.resolved },
          ]} />
        </SectionCard>

        <SectionCard title="Benim İncelemelerim" desc="Sizin tarafınızdan işlenen vakalar">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Onayladığım" value={myPerformance.approved} accent="#10B981" />
            <MetricCard label="Reddettiğim" value={myPerformance.rejected} accent="#EF4444" />
            <MetricCard label="İncelemede" value={myPerformance.underReview} accent="#3B82F6" />
            <MetricCard label="Toplam" value={myPerformance.totalReviewed} />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Öncelik Sinyalleri" desc="Acil dikkat gerektiren vakalar">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="SKT Acil (7 gün)" value={insights.urgentExpiry} accent="#EF4444" sub="Bekleyen + incelenen" />
            <MetricCard label="Fotoğraflı İhbar" value={insights.withPhotos} sub="Kanıt içeren" accent="#8B5CF6" />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <TrendChart data={insights.last7DaysTrend} color="#F59E0B" label="Günlük yeni ihbar (7 gün)" />
          </div>
        </SectionCard>

        <SectionCard title="En Çok İhbar Alan Marketler" desc="Yoğunluk haritası">
          <RankList
            items={insights.topMarkets.map((m) => ({
              name: m.market?.name ?? 'Bilinmiyor',
              count: m.count,
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard title="Kategori Dağılımı" desc="İhbar edilen ürün kategorileri">
        <RankList
          items={insights.categoryBreakdown.map((c) => ({
            name: `${c.category.icon ?? ''} ${c.category.name}`.trim(),
            count: c.count,
          }))}
        />
      </SectionCard>
    </div>
  );
}
