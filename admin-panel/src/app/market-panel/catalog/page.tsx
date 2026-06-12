'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { marketPanelApi, catalogsApi } from '../../../lib/api';
import { ManagedMarket } from '../../../types';
import { useColors } from '../../../context/ThemeContext';

interface CatalogPage {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl?: string;
}

interface Catalog {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  coverImageUrl?: string;
  pdfUrl?: string;
  sourceUrl?: string;
  scrapeSource?: string;
  pageCount: number;
  pages?: CatalogPage[];
  _count?: { pages: number };
}

type FilterTab = 'all' | 'active' | 'inactive';
type PageTab = 'grid' | 'add-url' | 'bulk-url' | 'upload';

function catalogStatus(cat: Catalog) {
  const now = Date.now();
  const start = new Date(cat.startDate).getTime();
  const end = new Date(cat.endDate).getTime();
  if (!cat.isActive) return { label: 'Pasif', color: '#64748b' };
  if (now < start) return { label: 'Yaklaşan', color: '#60a5fa' };
  if (now > end) return { label: 'Süresi Doldu', color: '#f87171' };
  return { label: 'Yayında', color: '#34d399' };
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export default function MarketCatalogPage() {
  const C = useColors();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  const [market, setMarket] = useState<ManagedMarket | null>(null);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null);
  const [editCatalog, setEditCatalog] = useState<Catalog | null>(null);
  const [pageTab, setPageTab] = useState<PageTab>('grid');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', startDate: '', endDate: '', coverImageUrl: '', pdfUrl: '',
  });
  const [editForm, setEditForm] = useState({
    title: '', description: '', startDate: '', endDate: '', coverImageUrl: '', pdfUrl: '',
  });
  const [pageForm, setPageForm] = useState({ imageUrl: '', thumbnailUrl: '' });
  const [bulkUrls, setBulkUrls] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('admin_user') ?? '{}');
      setMarket(u.managedMarket ?? null);
    } catch { /* ok */ }
  }, []);

  const load = useCallback(async () => {
    if (!market) return;
    setLoading(true);
    try {
      const data = await marketPanelApi.getCatalogs(market.id) as Catalog[];
      setCatalogs(data);
    } catch {
      setCatalogs([]);
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    if (filter === 'active') return catalogs.filter((c) => c.isActive);
    if (filter === 'inactive') return catalogs.filter((c) => !c.isActive);
    return catalogs;
  }, [catalogs, filter]);

  const stats = useMemo(() => ({
    total: catalogs.length,
    active: catalogs.filter((c) => c.isActive).length,
    withPages: catalogs.filter((c) => (c._count?.pages ?? c.pageCount) > 0).length,
    scraped: catalogs.filter((c) => c.scrapeSource === 'scraper').length,
  }), [catalogs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market) return;
    setSaving(true);
    try {
      await catalogsApi.create({ ...form, marketId: market.id });
      setShowAdd(false);
      setForm({ title: '', description: '', startDate: '', endDate: '', coverImageUrl: '', pdfUrl: '' });
      showToast('Katalog oluşturuldu');
      load();
    } catch { showToast('Oluşturulamadı', true); }
    finally { setSaving(false); }
  };

  const openEdit = (cat: Catalog) => {
    setEditCatalog(cat);
    setEditForm({
      title: cat.title,
      description: cat.description ?? '',
      startDate: toDateInput(cat.startDate),
      endDate: toDateInput(cat.endDate),
      coverImageUrl: cat.coverImageUrl ?? '',
      pdfUrl: cat.pdfUrl ?? '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatalog) return;
    setSaving(true);
    try {
      await catalogsApi.update(editCatalog.id, editForm);
      setEditCatalog(null);
      showToast('Katalog güncellendi');
      load();
      if (selectedCatalog?.id === editCatalog.id) {
        const updated = await catalogsApi.getOne(editCatalog.id);
        setSelectedCatalog(updated);
      }
    } catch { showToast('Güncellenemedi', true); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" kataloğunu silmek istediğinizden emin misiniz?`)) return;
    try {
      await catalogsApi.delete(id);
      if (selectedCatalog?.id === id) setSelectedCatalog(null);
      showToast('Katalog silindi');
      load();
    } catch { showToast('Silinemedi', true); }
  };

  const handleToggle = async (id: string) => {
    try {
      await catalogsApi.toggleActive(id);
      load();
      if (selectedCatalog?.id === id) {
        const updated = await catalogsApi.getOne(id);
        setSelectedCatalog(updated);
      }
    } catch { showToast('Durum güncellenemedi', true); }
  };

  const openPages = async (cat: Catalog) => {
    try {
      const full = await catalogsApi.getOne(cat.id);
      setSelectedCatalog(full);
      setPageTab('grid');
      setBulkUrls('');
      setPageForm({ imageUrl: '', thumbnailUrl: '' });
    } catch { showToast('Sayfalar yüklenemedi', true); }
  };

  const refreshSelected = async () => {
    if (!selectedCatalog) return;
    const updated = await catalogsApi.getOne(selectedCatalog.id);
    setSelectedCatalog(updated);
    load();
  };

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog) return;
    setSaving(true);
    try {
      const nextNum = (selectedCatalog.pages?.length ?? 0) + 1;
      await catalogsApi.addPage(selectedCatalog.id, {
        pageNumber: nextNum,
        imageUrl: pageForm.imageUrl,
        thumbnailUrl: pageForm.thumbnailUrl || undefined,
      });
      setPageForm({ imageUrl: '', thumbnailUrl: '' });
      showToast('Sayfa eklendi');
      await refreshSelected();
    } catch { showToast('Sayfa eklenemedi', true); }
    finally { setSaving(false); }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog) return;
    const urls = bulkUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      showToast('En az bir URL girin', true);
      return;
    }
    setSaving(true);
    try {
      const result = await catalogsApi.bulkAddPages(selectedCatalog.id, urls);
      setBulkUrls('');
      showToast(`${result.added ?? urls.length} sayfa eklendi`);
      await refreshSelected();
    } catch { showToast('Toplu ekleme başarısız', true); }
    finally { setSaving(false); }
  };

  const handleUpload = async (files: FileList | null, type: 'cover' | 'page') => {
    if (!selectedCatalog || !files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await catalogsApi.uploadImage(selectedCatalog.id, file, type);
      }
      showToast(type === 'cover' ? 'Kapak yüklendi' : `${files.length} sayfa yüklendi`);
      await refreshSelected();
    } catch {
      showToast('Yükleme başarısız — MinIO yapılandırmasını kontrol edin', true);
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
      if (pageInputRef.current) pageInputRef.current.value = '';
    }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!selectedCatalog || !confirm('Bu sayfayı silmek istediğinizden emin misiniz?')) return;
    try {
      await catalogsApi.removePage(selectedCatalog.id, pageId);
      showToast('Sayfa silindi');
      await refreshSelected();
    } catch { showToast('Sayfa silinemedi', true); }
  };

  const handleSetCoverFromFirst = async () => {
    if (!selectedCatalog) return;
    try {
      await catalogsApi.setCoverFromFirstPage(selectedCatalog.id);
      showToast('Kapak güncellendi');
      await refreshSelected();
    } catch { showToast('Kapak ayarlanamadı', true); }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      const result = await catalogsApi.scrapeOwnMarket();
      const created = result?.created ?? 0;
      const pages = result?.pages ?? 0;
      showToast(`Otomatik çekildi: +${created} katalog, ${pages} sayfa`);
      load();
    } catch { showToast('Otomatik çekim başarısız', true); }
    finally { setScraping(false); }
  };

  const brand = market?.brandColor ?? '#3b82f6';

  const inputStyle = {
    background: C.cardAlt,
    border: `1px solid ${C.border}`,
    color: C.text,
  };

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-6">

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{
            background: toast.err ? '#fee2e2' : '#dcfce7',
            color: toast.err ? '#dc2626' : '#16a34a',
            border: `1px solid ${toast.err ? '#fca5a5' : '#86efac'}`,
          }}>
          {toast.err ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brand }}>
            {market?.name ?? 'Market'} · Katalog Yönetimi
          </p>
          <h1 className="text-2xl font-bold">Aktüel Kataloglar</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Kendi marketinizin kataloglarını görüntüleyin, düzenleyin ve yükleyin
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleScrape} disabled={scraping}
            className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            style={{ background: `${brand}15`, color: brand, border: `1px solid ${brand}30` }}>
            {scraping ? (
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : '⬇'}
            Otomatik Çek
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: brand }}>
            + Yeni Katalog
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl p-4 text-sm leading-relaxed"
        style={{ background: `${brand}08`, border: `1px solid ${brand}20`, color: C.secondary }}>
        <strong style={{ color: C.text }}>Nasıl çalışır?</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside" style={{ color: C.muted }}>
          <li><strong>Otomatik Çek</strong> — kimbino.com.tr üzerinden güncel katalogları sisteme alır</li>
          <li><strong>Manuel</strong> — başlık/tarih girin, ardından sayfa URL&apos;leri veya dosya yükleyin</li>
          <li><strong>Aktif</strong> kataloglar mobil uygulamada görünür; pasif olanlar gizlenir</li>
        </ul>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam', value: stats.total, icon: '📚' },
          { label: 'Aktif', value: stats.active, icon: '✅' },
          { label: 'Sayfalı', value: stats.withPages, icon: '🖼' },
          { label: 'Otomatik', value: stats.scraped, icon: '🤖' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</p>
            <p className="text-2xl font-black mt-1">{s.icon} {s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          ['all', `Tümü (${stats.total})`],
          ['active', `Aktif (${stats.active})`],
          ['inactive', `Pasif (${stats.total - stats.active})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: filter === key ? `${brand}18` : C.card,
              color: filter === key ? brand : C.muted,
              border: `1px solid ${filter === key ? brand + '40' : C.border}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fp-card py-20 text-center rounded-2xl">
          <p className="text-5xl mb-4">📖</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>
            {filter === 'all' ? 'Henüz katalog yok' : 'Bu filtrede katalog yok'}
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={handleScrape} disabled={scraping}
              className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: `${brand}15`, color: brand, border: `1px solid ${brand}30` }}>
              Otomatik Çek
            </button>
            <button onClick={() => setShowAdd(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: brand }}>
              Manuel Oluştur
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((cat) => {
            const st = catalogStatus(cat);
            const start = new Date(cat.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
            const end = new Date(cat.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
            const pageCount = cat._count?.pages ?? cat.pageCount;

            return (
              <div key={cat.id} className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="h-44 relative cursor-pointer" onClick={() => openPages(cat)}
                  style={{ background: cat.coverImageUrl ? undefined : `linear-gradient(135deg, ${brand}18, ${brand}06)` }}>
                  {cat.coverImageUrl ? (
                    <img src={cat.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                      <span className="text-4xl opacity-20">📖</span>
                      <span className="text-xs opacity-40">Kapak yok</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: `${st.color}25`, color: st.color }}>{st.label}</span>
                    {!cat.isActive && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-500/30 text-slate-300">Gizli</span>
                    )}
                  </div>
                  {pageCount > 0 && (
                    <div className="absolute bottom-3 left-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/60 text-white">
                        {pageCount} sayfa
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div>
                    <p className="font-bold text-sm line-clamp-2">{cat.title}</p>
                    <p className="text-xs mt-1" style={{ color: C.muted }}>📅 {start} → {end}</p>
                    {cat.scrapeSource === 'scraper' && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: `${brand}15`, color: brand }}>Otomatik</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button onClick={() => openPages(cat)}
                      className="py-2 rounded-xl text-xs font-bold col-span-2"
                      style={{ background: `${brand}12`, color: brand }}>
                      Sayfaları Yönet ({pageCount})
                    </button>
                    <button onClick={() => openEdit(cat)}
                      className="py-2 rounded-xl text-xs font-bold"
                      style={{ background: C.cardAlt, color: C.secondary, border: `1px solid ${C.border}` }}>
                      Düzenle
                    </button>
                    <button onClick={() => handleToggle(cat.id)}
                      className="py-2 rounded-xl text-xs font-bold"
                      style={{
                        background: cat.isActive ? '#fef3c7' : '#dcfce7',
                        color: cat.isActive ? '#d97706' : '#16a34a',
                      }}>
                      {cat.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.title)}
                      className="py-2 rounded-xl text-xs font-bold col-span-2"
                      style={{ background: '#fee2e2', color: '#dc2626' }}>
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showAdd && (
        <Modal title="Yeni Katalog" onClose={() => setShowAdd(false)} C={C}>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label="Başlık *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required C={C} />
            <FormField label="Açıklama" value={form.description} onChange={(v) => setForm({ ...form, description: v })} C={C} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Başlangıç *" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} required C={C} />
              <FormField label="Bitiş *" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} required C={C} />
            </div>
            <FormField label="Kapak Görseli URL" value={form.coverImageUrl} onChange={(v) => setForm({ ...form, coverImageUrl: v })} type="url" C={C} />
            <FormField label="PDF URL" value={form.pdfUrl} onChange={(v) => setForm({ ...form, pdfUrl: v })} type="url" C={C} />
            <ModalActions onCancel={() => setShowAdd(false)} saving={saving} brand={brand} submitLabel="Oluştur" C={C} />
          </form>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editCatalog && (
        <Modal title="Katalog Düzenle" onClose={() => setEditCatalog(null)} C={C}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <FormField label="Başlık *" value={editForm.title} onChange={(v) => setEditForm({ ...editForm, title: v })} required C={C} />
            <FormField label="Açıklama" value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} C={C} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Başlangıç *" type="date" value={editForm.startDate} onChange={(v) => setEditForm({ ...editForm, startDate: v })} required C={C} />
              <FormField label="Bitiş *" type="date" value={editForm.endDate} onChange={(v) => setEditForm({ ...editForm, endDate: v })} required C={C} />
            </div>
            <FormField label="Kapak Görseli URL" value={editForm.coverImageUrl} onChange={(v) => setEditForm({ ...editForm, coverImageUrl: v })} type="url" C={C} />
            <FormField label="PDF URL" value={editForm.pdfUrl} onChange={(v) => setEditForm({ ...editForm, pdfUrl: v })} type="url" C={C} />
            <ModalActions onCancel={() => setEditCatalog(null)} saving={saving} brand={brand} submitLabel="Kaydet" C={C} />
          </form>
        </Modal>
      )}

      {/* PAGE MANAGEMENT MODAL */}
      {selectedCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>

            <div className="flex items-start justify-between px-6 py-4 flex-shrink-0 gap-4"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="min-w-0">
                <p className="font-bold truncate">{selectedCatalog.title}</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {selectedCatalog.pages?.length ?? 0} sayfa
                  {selectedCatalog.coverImageUrl ? ' · Kapak mevcut' : ' · Kapak yok'}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                <button onClick={handleSetCoverFromFirst}
                  className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  Kapak = 1. Sayfa
                </button>
                <label className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer text-white"
                  style={{ background: brand, opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? '…' : '📤 Kapak Yükle'}
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleUpload(e.target.files, 'cover')} />
                </label>
                {selectedCatalog.pdfUrl && (
                  <a href={selectedCatalog.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: '#fee2e210', color: '#dc2626', border: '1px solid #fca5a540' }}>
                    PDF
                  </a>
                )}
                <button onClick={() => setSelectedCatalog(null)} style={{ color: C.muted }} className="px-2">✕</button>
              </div>
            </div>

            {/* Page tabs */}
            <div className="flex gap-1 px-4 pt-3 flex-shrink-0 flex-wrap">
              {([
                ['grid', 'Galeri'],
                ['add-url', 'Tek URL'],
                ['bulk-url', 'Toplu URL'],
                ['upload', 'Dosya Yükle'],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPageTab(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: pageTab === key ? `${brand}18` : 'transparent',
                    color: pageTab === key ? brand : C.muted,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {pageTab === 'grid' && (
                (selectedCatalog.pages?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-4">
                    <span className="text-4xl opacity-30">🖼</span>
                    <p className="text-sm" style={{ color: C.muted }}>Henüz sayfa yok</p>
                    <button onClick={() => setPageTab('bulk-url')}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: brand }}>
                      Sayfa Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {selectedCatalog.pages?.map((p) => (
                      <div key={p.id} className="relative rounded-xl overflow-hidden group"
                        style={{ border: `1px solid ${C.border}` }}>
                        <img src={p.thumbnailUrl || p.imageUrl} alt={`Sayfa ${p.pageNumber}`}
                          className="w-full aspect-[3/4] object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity
                          flex items-center justify-center gap-2">
                          <a href={p.imageUrl} target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 rounded text-[10px] font-bold bg-white/20 text-white">Aç</a>
                          <button onClick={() => handleRemovePage(p.id)}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-red-600 text-white">Sil</button>
                        </div>
                        <div className="absolute bottom-2 left-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-white">
                            {p.pageNumber}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {pageTab === 'add-url' && (
                <form onSubmit={handleAddPage} className="max-w-lg space-y-3">
                  <FormField label="Tam boyut görsel URL *" value={pageForm.imageUrl}
                    onChange={(v) => setPageForm({ ...pageForm, imageUrl: v })} type="url" required C={C} />
                  <FormField label="Küçük resim URL (opsiyonel)" value={pageForm.thumbnailUrl}
                    onChange={(v) => setPageForm({ ...pageForm, thumbnailUrl: v })} type="url" C={C} />
                  <button type="submit" disabled={saving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: brand }}>
                    {saving ? 'Ekleniyor…' : 'Sayfa Ekle'}
                  </button>
                </form>
              )}

              {pageTab === 'bulk-url' && (
                <form onSubmit={handleBulkAdd} className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: C.muted }}>
                    Görsel URL listesi (her satır bir sayfa)
                  </label>
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => setBulkUrls(e.target.value)}
                    rows={10}
                    placeholder={'https://cdn.example.com/sayfa1.jpg\nhttps://cdn.example.com/sayfa2.jpg'}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none font-mono"
                    style={inputStyle}
                  />
                  <p className="text-xs" style={{ color: C.muted }}>
                    Maksimum 200 URL. İlk URL kapak yoksa otomatik kapak olarak atanır.
                  </p>
                  <button type="submit" disabled={saving}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: brand }}>
                    {saving ? 'Ekleniyor…' : 'Toplu Ekle'}
                  </button>
                </form>
              )}

              {pageTab === 'upload' && (
                <div className="max-w-lg space-y-4">
                  <div className="rounded-xl p-6 text-center border-2 border-dashed"
                    style={{ borderColor: `${brand}40`, background: `${brand}06` }}>
                    <p className="text-3xl mb-2">📁</p>
                    <p className="font-bold text-sm">Sayfa görselleri yükle</p>
                    <p className="text-xs mt-1" style={{ color: C.muted }}>
                      JPG, PNG, WebP — maks. 8 MB — MinIO depolama
                    </p>
                    <label className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer"
                      style={{ background: brand, opacity: uploading ? 0.6 : 1 }}>
                      {uploading ? 'Yükleniyor…' : 'Dosya Seç (çoklu)'}
                      <input ref={pageInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => handleUpload(e.target.files, 'page')} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Yardımcı bileşenler ──────────────────────────────

function Modal({ title, onClose, children, C }: {
  title: string; onClose: () => void; children: React.ReactNode;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="font-bold text-lg">{title}</p>
          <button onClick={onClose} style={{ color: C.muted }}>✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required, C }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; C: ReturnType<typeof useColors>;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: C.muted }}>
        {label}
      </label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
    </div>
  );
}

function ModalActions({ onCancel, saving, brand, submitLabel, C }: {
  onCancel: () => void; saving: boolean; brand: string; submitLabel: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel}
        className="flex-1 py-3 rounded-xl text-sm font-bold"
        style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
        İptal
      </button>
      <button type="submit" disabled={saving}
        className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
        style={{ background: brand }}>
        {saving ? 'Kaydediliyor…' : submitLabel}
      </button>
    </div>
  );
}
