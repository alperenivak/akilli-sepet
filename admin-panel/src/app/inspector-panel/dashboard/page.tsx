'use client';

import { useState, useEffect } from 'react';
import { reportsApi } from '../../../lib/api';
import { Report } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import Link from 'next/link';
import { WorkflowGuide } from '../../../components/panels/WorkflowGuide';

function triageSuggestions(pending: number, urgent: number): string[] {
  const s: string[] = [];
  if (urgent > 0) s.push(`${urgent} ihbarda son kullanma tarihi belirtilmiş — öncelikli inceleme önerilir.`);
  if (pending > 5) s.push(`Kuyrukta ${pending} bekleyen vaka var. Fotoğraflı kanıt içerenleri önce işleyin.`);
  s.push('Barkod eşleşme güveni yüksek vakalar hızlı onaya uygundur.');
  s.push('Aynı marketten tekrar gelen ihbarlar yüksek öncelikli işaretlendi.');
  if (pending === 0) s.push('Harika! Kuyruk temiz. Tamamlanan vakaları raporlayabilirsiniz.');
  return s;
}

function SktBadge({ date, C }: { date: string; C: ReturnType<typeof useColors> }) {
  const days  = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? C.red : days <= 3 ? C.amber : C.secondary;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded"
      style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
      SKT: {new Date(date).toLocaleDateString('tr-TR')}
    </span>
  );
}

function VakaKarti({ report, index, C }: { report: Report; index: number; C: ReturnType<typeof useColors> }) {
  const hasPhoto = (report.images?.length ?? 0) > 0;
  const urgent   = !!report.expiryDate;

  return (
    <Link href={`/inspector-panel/reports?id=${report.id}`}
      className="block rounded-xl p-4 transition-all hover:brightness-105 relative overflow-hidden"
      style={{ background: C.cardAlt, border: `1px solid ${urgent ? C.amber + '40' : C.border}` }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
        style={{ background: urgent ? C.amber : C.blue }} />
      <div className="pl-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono font-bold" style={{ color: C.muted }}>
            #{String(index + 1).padStart(3, '0')}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {hasPhoto && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}25`, color: C.blue }}>
                📷 Kanıt
              </span>
            )}
            {report.expiryDate && <SktBadge date={report.expiryDate} C={C} />}
          </div>
        </div>
        <p className="text-sm leading-snug line-clamp-2" style={{ color: C.text }}>{report.description}</p>
        <div className="flex items-center gap-3 mt-2.5">
          {report.market?.name && <span className="text-xs font-medium" style={{ color: C.secondary }}>{report.market.name}</span>}
          <span style={{ color: C.muted }}>·</span>
          <span className="text-xs" style={{ color: C.muted }}>
            {new Date(report.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function DenetciDogrulamaMerkezi() {
  const C = useColors();
  const [pending,   setPending]   = useState<Report[]>([]);
  const [reviewing, setReviewing] = useState<Report[]>([]);
  const [counts, setCounts] = useState({ pending: 0, underReview: 0, approved: 0, rejected: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Denetçi');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (raw) setUserName(JSON.parse(raw).name ?? 'Denetçi');
    } catch { /**/ }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p, u, a, rej, res] = await Promise.all([
          reportsApi.getAll({ status: 'PENDING',      limit: 8 }),
          reportsApi.getAll({ status: 'UNDER_REVIEW', limit: 4 }),
          reportsApi.getAll({ status: 'APPROVED',     limit: 1 }),
          reportsApi.getAll({ status: 'REJECTED',     limit: 1 }),
          reportsApi.getAll({ status: 'RESOLVED',     limit: 1 }),
        ]);
        setPending(p.items as Report[]);
        setReviewing(u.items as Report[]);
        setCounts({ pending: p.total, underReview: u.total, approved: a.total, rejected: rej.total, resolved: res.total, total: p.total + u.total + a.total + rej.total + res.total });
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const urgentCount = pending.filter((r) => {
    if (!r.expiryDate) return false;
    return new Date(r.expiryDate).getTime() - Date.now() < 7 * 86400000;
  }).length;
  const notPushedCount = [...pending, ...reviewing].filter((r) => !r.pushedToMarketAt).length;
  const suggestions = triageSuggestions(counts.pending, urgentCount);

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.amber }}>Doğrulama Merkezi</p>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>İhbar İnceleme Paneli</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Merhaba, <span style={{ color: C.text, fontWeight: 600 }}>{userName}</span> —{' '}
            {counts.pending > 0
              ? <span style={{ color: C.amber }}>{counts.pending} vaka incelemenizi bekliyor</span>
              : <span style={{ color: C.green }}>Kuyruk temiz, harika iş!</span>
            }
          </p>
        </div>
        <Link href="/inspector-panel/statistics"
          className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
          📈 Performansım
        </Link>
      </div>

      <WorkflowGuide variant="inspector" />

      {notPushedCount > 0 && (
        <Link href="/inspector-panel/in-review"
          className="block rounded-xl px-4 py-3 transition-all hover:brightness-105"
          style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}35` }}>
          <p className="text-sm font-bold" style={{ color: C.amber }}>
            📤 {notPushedCount} ihbar henüz markete iletilmedi
          </p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            İnceleme tamamlandıktan sonra ilgili market yöneticisine push etmeyi unutmayın →
          </p>
        </Link>
      )}

      {/* Durum şeridi */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="grid grid-cols-2 md:grid-cols-5">
          {[
            { label: 'Bekleyen',    value: counts.pending,    color: C.amber,  href: '/inspector-panel/reports' },
            { label: 'İnceleniyor', value: counts.underReview,color: C.blue,   href: '/inspector-panel/in-review' },
            { label: 'Onaylanan',   value: counts.approved,   color: C.green,  href: '/inspector-panel/resolved' },
            { label: 'Reddedilen',  value: counts.rejected,   color: C.muted,  href: '/inspector-panel/resolved' },
            { label: 'Toplam',      value: counts.total,      color: C.purple, href: '/inspector-panel/reports' },
          ].map((s, i) => (
            <Link key={s.label} href={s.href}
              className="flex flex-col items-center gap-0.5 py-5 px-4 transition-all hover:brightness-105"
              style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
              <span className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs font-medium" style={{ color: C.muted }}>{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* İki sütun */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

        {/* Vaka Kuyruğu */}
        <div className="fp-card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.amber }}>Bekleyen Vakalar</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>
                Doğrulama Kuyruğu
                {counts.pending > 0 && (
                  <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: `${C.amber}12`, color: C.amber }}>
                    {counts.pending} vaka
                  </span>
                )}
              </p>
            </div>
            <Link href="/inspector-panel/reports"
              className="text-xs font-medium px-2 py-1 rounded-lg"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
              Tümünü Gör →
            </Link>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: `${C.amber}20`, borderTopColor: C.amber }} />
              </div>
            ) : pending.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-sm font-semibold" style={{ color: C.secondary }}>Kuyruk temiz</p>
                <p className="text-xs mt-1" style={{ color: C.muted }}>Bekleyen ihbar bulunmuyor</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pending.map((r, i) => <VakaKarti key={r.id} report={r} index={i} C={C} />)}
              </div>
            )}
          </div>
        </div>

        {/* Sağ sütun */}
        <div className="space-y-4">
          {/* AI Önceliklendirme */}
          <div className="fp-card p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${C.amber}12` }}>🤖</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.amber }}>Yapay Zeka</p>
                <p className="text-sm font-bold" style={{ color: C.text }}>Önceliklendirme</p>
              </div>
            </div>
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl"
                style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}20` }}>
                <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: C.amber }}>›</span>
                <p className="text-xs leading-relaxed" style={{ color: C.text }}>{s}</p>
              </div>
            ))}
          </div>

          {/* İncelemede */}
          <div className="fp-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: C.text }}>Şu An İncelemede</p>
              <Link href="/inspector-panel/in-review" className="text-xs" style={{ color: C.muted }}>Tümü →</Link>
            </div>
            {reviewing.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: C.muted }}>Şu an inceleme yok</p>
            ) : (
              <div className="space-y-2">
                {reviewing.slice(0, 3).map((r) => (
                  <Link key={r.id} href="/inspector-panel/in-review"
                    className="flex items-center gap-2.5 py-2 hover:opacity-80 transition-opacity">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.blue }} />
                    <p className="text-xs line-clamp-1 flex-1" style={{ color: C.secondary }}>{r.description}</p>
                    {r.market?.name && <span className="text-[10px]" style={{ color: C.muted }}>{r.market.name}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Hızlı İşlemler */}
          <div className="fp-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Hızlı İşlemler</p>
            {[
              { label: 'Bekleyen İhbarlar', href: '/inspector-panel/reports',    icon: '📥' },
              { label: 'İncelemelerim',     href: '/inspector-panel/in-review',  icon: '🔍' },
              { label: 'Tamamlananlar',     href: '/inspector-panel/resolved',   icon: '✅' },
              { label: 'İstatistiklerim',   href: '/inspector-panel/statistics', icon: '📈' },
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
    </div>
  );
}
