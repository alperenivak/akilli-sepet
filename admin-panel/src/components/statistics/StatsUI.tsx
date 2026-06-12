'use client';

import React from 'react';
import { useColors } from '../../context/ThemeContext';

// ---- Ortak istatistik UI bileşenleri (tema uyumlu) ----

export function StatsPageHeader({
  title,
  subtitle,
  accent = '#2563EB',
  badge,
}: {
  title: string;
  subtitle: string;
  accent?: string;
  badge?: string;
}) {
  const C = useColors();
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: accent }}>
          İstatistikler
        </p>
        <h1 className="text-2xl font-bold" style={{ color: C.text }}>{title}</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>{subtitle}</p>
      </div>
      {badge && (
        <span className="text-xs rounded-lg px-3 py-2" style={{ background: C.card, border: `1px solid ${C.border}`, color: C.muted }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  accent = '#2563EB',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  icon?: string;
}) {
  const C = useColors();
  return (
    <div className="fp-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-2xl font-bold mt-2 tabular-nums" style={{ color: C.text }}>{value}</p>
      {sub && (
        <p className="text-xs mt-1 font-medium" style={{ color: accent }}>{sub}</p>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  const C = useColors();
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
        <h2 className="text-sm font-bold" style={{ color: C.text }}>{title}</h2>
        {desc && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{desc}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusBreakdown({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const C = useColors();
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: C.cardAlt }}>
        {items.filter((i) => i.value > 0).map((item) => (
          <div
            key={item.label}
            className="h-full transition-all"
            style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span style={{ color: C.secondary }}>{item.label}</span>
            <span className="ml-auto font-bold tabular-nums" style={{ color: C.text }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  color = '#2563EB',
  label = 'Son 7 gün',
}: {
  data: { date: string; count: number }[];
  color?: string;
  label?: string;
}) {
  const C = useColors();
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <p className="text-xs mb-3" style={{ color: C.muted }}>{label}</p>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] font-bold tabular-nums" style={{ color: C.muted }}>{d.count}</span>
            <div
              className="w-full rounded-t-md transition-all min-h-[4px]"
              style={{
                height: `${Math.max(8, (d.count / max) * 100)}%`,
                backgroundColor: color,
                opacity: d.count > 0 ? 1 : 0.15,
              }}
            />
            <span className="text-[9px] truncate w-full text-center" style={{ color: C.muted }}>
              {new Date(d.date).toLocaleDateString('tr-TR', { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankList({
  items,
  valueKey = 'count',
  labelKey = 'name',
  accent,
}: {
  items: Array<Record<string, unknown>>;
  valueKey?: string;
  labelKey?: string;
  accent?: string;
}) {
  const C = useColors();
  if (items.length === 0) {
    return <p className="text-sm text-center py-4" style={{ color: C.muted }}>Henüz veri yok</p>;
  }
  const max = Math.max(...items.map((i) => Number(i[valueKey] ?? 0)), 1);
  const barColor = accent ?? C.secondary;
  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const val   = Number(item[valueKey] ?? 0);
        const label = String(item[labelKey] ?? '—');
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs font-bold w-4" style={{ color: C.muted }}>{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2 mb-1">
                <span className="text-sm font-medium truncate" style={{ color: C.text }}>{label}</span>
                <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: C.text }}>{val}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.cardAlt }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(val / max) * 100}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CoverageRing({ percent, label }: { percent: number; label: string }) {
  const C = useColors();
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke={C.cardAlt} strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={C.green} strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-3xl font-bold tabular-nums" style={{ color: C.text }}>%{percent}</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{label}</p>
      </div>
    </div>
  );
}

export function LoadingStats() {
  const C = useColors();
  return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: `${C.secondary}20`, borderTopColor: C.secondary }} />
    </div>
  );
}

export function formatKurus(kurus: number): string {
  // Re-export uyumluluk; tek kaynak admin-panel/src/lib/price.ts
  return `₺${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR');
}
