'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productsApi } from '../../../../lib/api';
import { Category } from '../../../../types';
import {
  ProductCategoryPicker,
  ProductPreviewCard,
  UNIT_PRESETS,
} from '../../../../components/ProductFormParts';
import { BarcodeInputField } from '../../../../components/BarcodeInputField';

const inputCls =
  'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all';

export default function NewProductPage() {
  const router = useRouter();
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    brand: '',
    categoryId: '',
    unit: '',
    unitValue: '',
    description: '',
    barcode: '',
  });

  useEffect(() => {
    productsApi.getCategories().then(setCategoryTree).catch(console.error);
  }, []);

  const completion = useMemo(() => {
    let n = 0;
    if (form.name.trim()) n++;
    if (form.categoryId) n++;
    if (form.brand.trim()) n++;
    if (form.unit) n++;
    if (form.barcode.trim()) n++;
    return Math.round((n / 5) * 100);
  }, [form]);

  const canSubmit = form.name.trim().length > 0 && !!form.categoryId && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const unitValue = form.unitValue ? parseFloat(form.unitValue.replace(',', '.')) : undefined;
      await productsApi.create({
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        categoryId: form.categoryId,
        unit: form.unit.trim() || undefined,
        unitValue: unitValue && !Number.isNaN(unitValue) ? unitValue : undefined,
        description: form.description.trim() || undefined,
        barcodes: form.barcode.trim() ? [form.barcode.trim()] : undefined,
      });
      router.push('/products');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Ürün oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Üst başlık */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/products"
            className="mt-1 w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            aria-label="Ürün listesine dön"
          >
            ←
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Yeni kayıt</p>
            <h1 className="text-2xl font-bold text-slate-900">Ürün Ekle</h1>
            <p className="text-slate-500 text-sm mt-1">
              Kataloga yeni ürün tanımlayın — kategori, ölçü ve barkod bilgilerini girin.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">{completion}%</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm font-medium flex items-start gap-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="space-y-5">
          {/* Temel bilgiler */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800">Temel Bilgiler</h2>
              <p className="text-xs text-slate-400 mt-0.5">Ürünün vitrinde görünecek ad ve marka</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Ürün adı <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  className={inputCls}
                  placeholder="ör: Pınar Tam Yağlı Süt 1L"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Marka
                </label>
                <input
                  type="text"
                  maxLength={100}
                  className={inputCls}
                  placeholder="ör: Pınar, Sütaş, Ülker..."
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Kategori */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800">Kategori & Sınıflandırma</h2>
              <p className="text-xs text-slate-400 mt-0.5">Mobil ve panelde doğru filtrede görünmesi için alt kategori seçin</p>
            </div>
            <div className="p-5">
              {categoryTree.length > 0 ? (
                <ProductCategoryPicker
                  tree={categoryTree}
                  parentId={parentCategoryId}
                  categoryId={form.categoryId}
                  onParentChange={setParentCategoryId}
                  onCategoryChange={(id) => setForm({ ...form, categoryId: id })}
                />
              ) : (
                <p className="text-sm text-slate-400">Kategoriler yükleniyor...</p>
              )}
            </div>
          </section>

          {/* Ölçü & barkod */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800">Ölçü & Tanımlama</h2>
              <p className="text-xs text-slate-400 mt-0.5">Birim, miktar ve barkod — fiyat karşılaştırması için</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Birim türü
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNIT_PRESETS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm({ ...form, unit: u.value })}
                      className={[
                        'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                        form.unit === u.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                      ].join(' ')}
                      title={u.example}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Miktar
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    placeholder="ör: 1, 500, 1.5"
                    value={form.unitValue}
                    onChange={(e) => setForm({ ...form, unitValue: e.target.value.replace(/[^\d.,]/g, '') })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                    Özel birim
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    className={inputCls}
                    placeholder="litre, kg, adet..."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Barkod (EAN-13)
                </label>
                <BarcodeInputField
                  value={form.barcode}
                  onChange={(barcode) => setForm({ ...form, barcode })}
                  inputClassName={`${inputCls} font-mono tracking-wider`}
                />
              </div>
            </div>
          </section>

          {/* Açıklama */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800">Ek Notlar</h2>
            </div>
            <div className="p-5">
              <textarea
                rows={3}
                maxLength={500}
                className={`${inputCls} resize-none`}
                placeholder="İsteğe bağlı — ürün hakkında kısa açıklama..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{form.description.length}/500</p>
            </div>
          </section>

          {/* Aksiyonlar — mobil */}
          <div className="flex gap-3 lg:hidden">
            <Link
              href="/products"
              className="flex-1 py-3 text-center border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              İptal
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
            </button>
          </div>
        </div>

        {/* Sağ — önizleme + kaydet */}
        <aside className="space-y-4">
          <ProductPreviewCard
            name={form.name}
            brand={form.brand}
            unit={form.unit}
            unitValue={form.unitValue}
            categoryId={form.categoryId}
            tree={categoryTree}
            barcode={form.barcode}
          />
          <div className="hidden lg:flex flex-col gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saving ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
            </button>
            <Link
              href="/products"
              className="w-full py-3 text-center border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              İptal
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
