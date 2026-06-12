'use client';

import { Category } from '@/types';

interface FlatCategory extends Category {
  depth: number;
  productCount?: number;
}

function flattenTree(tree: Category[], depth = 0): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const node of tree) {
    result.push({
      ...node,
      depth,
      productCount: node.productCount ?? node._count?.products,
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

function getCount(cat: Category): number {
  return cat.productCount ?? cat._count?.products ?? 0;
}

interface Props {
  tree: Category[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  grouped?: boolean;
}

/** Hiyerarşik kategori seçici — üst gruplar ve alt kategoriler */
export function CategorySelect({
  tree,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = 'Tüm kategoriler',
  className = '',
  grouped = true,
}: Props) {
  if (grouped) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className || 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {tree.map((root) => (
          <optgroup key={root.id} label={`${root.icon ? `${root.icon} ` : ''}${root.name}`}>
            {root.children?.length ? (
              root.children.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.icon ? `${sub.icon} ` : ''}{sub.name}
                  {getCount(sub) > 0 ? ` (${getCount(sub)})` : ''}
                </option>
              ))
            ) : (
              <option value={root.id}>
                {root.icon ? `${root.icon} ` : ''}{root.name}
              </option>
            )}
          </optgroup>
        ))}
      </select>
    );
  }

  const flat = flattenTree(tree);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm'}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {flat.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {'\u00A0'.repeat(cat.depth * 2)}{cat.icon ? `${cat.icon} ` : ''}{cat.name}
        </option>
      ))}
    </select>
  );
}

export function formatCategoryLabel(
  category?: Category & { parent?: Pick<Category, 'name' | 'icon'> },
): string {
  if (!category) return '—';
  if (category.parent) {
    return `${category.parent.icon ? `${category.parent.icon} ` : ''}${category.parent.name} › ${category.icon ? `${category.icon} ` : ''}${category.name}`;
  }
  return `${category.icon ? `${category.icon} ` : ''}${category.name}`;
}

/** Yatay kaydırmalı chip satırı — taşma yapmaz, stabil kalır */
function ScrollChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-1">
      <div className="flex gap-2 overflow-x-auto px-1 pb-0.5 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  icon?: string;
  label: string;
  count?: number;
  size?: 'md' | 'sm';
}

function FilterChip({ active, onClick, icon, label, count, size = 'md' }: FilterChipProps) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 inline-flex items-center gap-1.5 rounded-xl font-medium border transition-all duration-150',
        pad,
        active
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {icon && <span className="text-base leading-none" aria-hidden>{icon}</span>}
      <span className="whitespace-nowrap">{label}</span>
      {count != null && count > 0 && (
        <span className={[
          'ml-0.5 min-w-[1.25rem] text-center rounded-md px-1 text-[10px] font-bold tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
        ].join(' ')}>
          {count}
        </span>
      )}
    </button>
  );
}

export function CategoryFilterChips({
  tree,
  parentId,
  categoryId,
  onParentChange,
  onCategoryChange,
}: {
  tree: Category[];
  parentId: string;
  categoryId: string;
  onParentChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
}) {
  const activeParent = tree.find((c) => c.id === parentId);
  const subs = activeParent?.children ?? [];

  return (
    <div className="space-y-3">
      {/* Ana kategoriler */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Ana Kategori
        </p>
        <ScrollChipRow>
          <FilterChip
            active={!parentId}
            onClick={() => { onParentChange(''); onCategoryChange(''); }}
            label="Tümü"
          />
          {tree.map((root) => (
            <FilterChip
              key={root.id}
              active={parentId === root.id}
              onClick={() => { onParentChange(root.id); onCategoryChange(''); }}
              icon={root.icon}
              label={root.name}
              count={getCount(root)}
            />
          ))}
        </ScrollChipRow>
      </div>

      {/* Alt kategoriler — seçili ana kategori altında */}
      {subs.length > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
            <span>{activeParent?.icon}</span>
            <span>{activeParent?.name}</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-500 normal-case tracking-normal font-semibold">Alt kategori</span>
          </p>
          <ScrollChipRow>
            <FilterChip
              active={!categoryId}
              onClick={() => onCategoryChange('')}
              label="Tümü"
              size="sm"
            />
            {subs.map((sub) => (
              <FilterChip
                key={sub.id}
                active={categoryId === sub.id}
                onClick={() => onCategoryChange(sub.id)}
                icon={sub.icon}
                label={sub.name}
                count={getCount(sub)}
                size="sm"
              />
            ))}
          </ScrollChipRow>
        </div>
      )}
    </div>
  );
}

/** Aktif filtre etiketi */
export function ActiveFilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-900/5 text-slate-700 text-xs font-medium border border-slate-200/80">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-slate-200/80 text-slate-500 transition-colors"
        aria-label="Filtreyi kaldır"
      >
        ×
      </button>
    </span>
  );
}

/** Durum segment kontrolü */
export function StatusSegment({
  value,
  onChange,
}: {
  value: 'all' | 'active' | 'inactive';
  onChange: (v: 'all' | 'active' | 'inactive') => void;
}) {
  const items: { key: 'all' | 'active' | 'inactive'; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'active', label: 'Aktif' },
    { key: 'inactive', label: 'Pasif' },
  ];

  return (
    <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={[
            'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
            value === item.key
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
