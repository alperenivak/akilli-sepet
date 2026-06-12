'use client';

import React from 'react';
import { useColors } from '../../context/ThemeContext';

export function AdminToast({ message, error }: { message: string; error?: boolean }) {
  return (
    <div
      className="fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl text-sm font-bold shadow-2xl"
      style={{
        background: error ? '#450a0a' : '#052e16',
        color: error ? '#fecaca' : '#bbf7d0',
        border: `1px solid ${error ? '#7f1d1d' : '#166534'}`,
      }}
    >
      {error ? '✕ ' : '✓ '}{message}
    </div>
  );
}

export function PageHero({
  badge,
  title,
  subtitle,
  gradient = 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 50%, #7c3aed 100%)',
  actions,
  metrics,
}: {
  badge: string;
  title: string;
  subtitle: string;
  gradient?: string;
  actions?: React.ReactNode;
  metrics?: Array<{ label: string; value: string | number; icon?: string }>;
}) {
  const C = useColors();
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: `1px solid ${C.border}` }}>
      <div className="px-6 py-6 flex flex-wrap items-start justify-between gap-4" style={{ background: gradient }}>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{badge}</p>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{title}</h1>
          <p className="text-sm text-white/80 mt-2 max-w-xl">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      {metrics && metrics.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4"
          style={{ background: C.card, borderTop: `1px solid ${C.border}` }}
        >
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="px-5 py-4 flex items-center gap-3"
              style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}
            >
              {m.icon && <span className="text-xl">{m.icon}</span>}
              <div>
                <p className="text-xl font-black tabular-nums leading-none" style={{ color: C.text }}>{m.value}</p>
                <p className="text-[10px] font-semibold mt-1 uppercase tracking-wide" style={{ color: C.muted }}>{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; icon?: string; count?: number }>;
  active: T;
  onChange: (k: T) => void;
}) {
  const C = useColors();
  return (
    <div
      className="flex gap-1 p-1 rounded-xl flex-wrap"
      style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
          style={
            active === t.key
              ? { background: C.card, color: C.text, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
              : { color: C.muted }
          }
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
          {t.count != null && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
              style={{ background: active === t.key ? `${C.blue}18` : C.card, color: C.blue }}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function StatusDot({ status }: { status: 'ok' | 'warn' | 'off' | 'error' }) {
  const colors = { ok: '#22c55e', warn: '#f59e0b', off: '#94a3b8', error: '#ef4444' };
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: colors[status], boxShadow: `0 0 8px ${colors[status]}66` }}
    />
  );
}

export function EmptyState({ icon, title, subtitle, action }: {
  icon: string; title: string; subtitle: string; action?: React.ReactNode;
}) {
  const C = useColors();
  return (
    <div
      className="rounded-2xl py-16 px-6 text-center"
      style={{ background: C.card, border: `1px dashed ${C.border}` }}
    >
      <p className="text-5xl mb-4">{icon}</p>
      <p className="font-bold text-lg" style={{ color: C.text }}>{title}</p>
      <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: C.muted }}>{subtitle}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingCenter() {
  const C = useColors();
  return (
    <div className="flex justify-center py-20">
      <div
        className="w-11 h-11 rounded-full border-2 animate-spin"
        style={{ borderColor: `${C.blue}25`, borderTopColor: C.blue }}
      />
    </div>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const C = useColors();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: C.cardAlt }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
