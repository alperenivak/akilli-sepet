'use client';

import { useColors } from '../../context/ThemeContext';

export type ReportSortKey = 'urgent' | 'newest' | 'oldest';

interface FilterChip {
  key: string;
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  sort: ReportSortKey;
  onSortChange: (v: ReportSortKey) => void;
  chips?: FilterChip[];
  resultCount?: number;
  totalCount?: number;
  searchPlaceholder?: string;
}

export function ReportFiltersBar({
  search, onSearchChange, sort, onSortChange, chips = [],
  resultCount, totalCount, searchPlaceholder = 'Ara...',
}: Props) {
  const C = useColors();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400/25"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ReportSortKey)}
          className="px-3 py-2.5 rounded-xl text-xs font-bold outline-none"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}
        >
          <option value="urgent">SKT acil önce</option>
          <option value="newest">En yeni</option>
          <option value="oldest">En eski</option>
        </select>
        {resultCount != null && (
          <span className="text-xs font-semibold shrink-0" style={{ color: C.muted }}>
            {search ? `${resultCount} / ` : ''}{totalCount ?? resultCount} kayıt
          </span>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={
                c.active
                  ? { background: `${C.amber}18`, border: `1px solid ${C.amber}40`, color: C.amber }
                  : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.muted }
              }
            >
              {c.icon && `${c.icon} `}{c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlaBadge({ pushedAt, C }: { pushedAt?: string; C: ReturnType<typeof useColors> }) {
  if (!pushedAt) return null;
  const days = Math.floor((Date.now() - new Date(pushedAt).getTime()) / 86400000);
  const color = days >= 3 ? C.red : days >= 1 ? C.amber : C.green;
  const label = days === 0 ? 'Bugün iletildi' : `${days} gündür bekliyor`;
  return (
    <span
      className="text-[10px] font-black px-2 py-0.5 rounded-lg"
      style={{ background: `${color}15`, color }}
    >
      ⏱ {label}
    </span>
  );
}
