'use client';

import { Category } from '@/types';

const UNIT_PRESETS = [
  { value: 'litre', label: 'Litre', example: '1 L süt' },
  { value: 'ml', label: 'ml', example: '500 ml su' },
  { value: 'kg', label: 'kg', example: '1 kg pirinç' },
  { value: 'g', label: 'g', example: '400 g peynir' },
  { value: 'adet', label: 'Adet', example: '1 adet ekmek' },
] as const;

function getCount(cat: Category): number {
  return cat.productCount ?? cat._count?.products ?? 0;
}

function findCategory(tree: Category[], id: string): Category | undefined {
  for (const root of tree) {
    if (root.id === id) return root;
    const sub = root.children?.find((c) => c.id === id);
    if (sub) return sub;
  }
  return undefined;
}

function findParent(tree: Category[], subId: string): Category | undefined {
  return tree.find((root) => root.children?.some((c) => c.id === subId));
}

interface Props {
  tree: Category[];
  parentId: string;
  categoryId: string;
  onParentChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
}

/** Ürün ekleme formu için görsel iki adımlı kategori seçici */
export function ProductCategoryPicker({
  tree, parentId, categoryId, onParentChange, onCategoryChange,
}: Props) {
  const activeParent = tree.find((c) => c.id === parentId);
  const subs = activeParent?.children ?? [];
  const selected = findCategory(tree, categoryId);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          1 · Ana kategori grubu
        </p>
        <div className="flex flex-wrap gap-2">
          {tree.map((root) => {
            const active = parentId === root.id;
            return (
              <button
                key={root.id}
                type="button"
                onClick={() => { onParentChange(root.id); onCategoryChange(''); }}
                className={[
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                {root.icon && <span>{root.icon}</span>}
                <span>{root.name}</span>
                {getCount(root) > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                    {getCount(root)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {subs.length > 0 && (
        <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/80 mb-2">
            2 · Spesifik alt kategori <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {subs.map((sub) => {
              const active = categoryId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onCategoryChange(sub.id)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300',
                  ].join(' ')}
                >
                  {sub.icon && <span>{sub.icon}</span>}
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          <span className="text-emerald-600 font-semibold">Seçildi:</span>
          {(() => {
            const parent = findParent(tree, selected.id);
            return parent
              ? `${parent.icon ?? ''} ${parent.name} › ${selected.icon ?? ''} ${selected.name}`
              : `${selected.icon ?? ''} ${selected.name}`;
          })()}
        </div>
      )}

      {parentId && subs.length > 0 && !categoryId && (
        <p className="text-xs text-amber-600 font-medium">Lütfen bir alt kategori seçin.</p>
      )}
    </div>
  );
}

export { UNIT_PRESETS, findCategory, findParent };

interface PreviewProps {
  name: string;
  brand: string;
  unit: string;
  unitValue: string;
  categoryId: string;
  tree: Category[];
  barcode: string;
}

export function ProductPreviewCard({
  name, brand, unit, unitValue, categoryId, tree, barcode,
}: PreviewProps) {
  const cat = findCategory(tree, categoryId);
  const parent = cat ? findParent(tree, cat.id) : undefined;
  const displayName = name.trim() || 'Ürün adı';
  const measure = unitValue && unit ? `${unitValue} ${unit}` : unit || '—';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 shadow-lg sticky top-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Canlı önizleme</p>
      <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl mb-4">
        {cat?.icon ?? parent?.icon ?? '📦'}
      </div>
      <p className="text-lg font-bold leading-snug">{displayName}</p>
      {brand && <p className="text-sm text-slate-300 mt-1">{brand}</p>}
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Kategori</span>
          <span className="text-right font-medium">
            {cat && parent ? `${parent.name} › ${cat.name}` : cat?.name ?? '—'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Ölçü</span>
          <span className="font-medium">{measure}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Barkod</span>
          <span className="font-mono text-xs">{barcode || '—'}</span>
        </div>
      </div>
    </div>
  );
}
