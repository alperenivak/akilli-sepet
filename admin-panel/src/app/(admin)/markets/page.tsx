'use client';

import { useState, useEffect, useCallback } from 'react';
import { marketsApi, reportsApi, usersApi } from '../../../lib/api';
import { Market, Branch, Report, User } from '../../../types';
import { useColors } from '../../../context/ThemeContext';

// ─── Yardımcı Tipler ──────────────────────────────────────────────────────────
type DrawerTab = 'genel' | 'subeler' | 'raporlar' | 'yonetici';

const EMPTY_MARKET = { name: '', brandColor: '#3B82F6', website: '', logoUrl: '' };
const EMPTY_BRANCH = { name: '', address: '', city: '', district: '', phone: '', workingHours: '', latitude: '', longitude: '' };

interface MarketWithExtra extends Market {
  reportCount?: number;
  pendingReports?: number;
  manager?: User | null;
}

// ─── Sağlık Skoru ─────────────────────────────────────────────────────────────
function healthScore(m: MarketWithExtra): { score: number; label: string; color: string } {
  let score = 0;
  if (m.isActive)                    score += 30;
  if ((m._count?.branches ?? 0) > 0) score += 25;
  if ((m._count?.catalogs ?? 0) > 0) score += 25;
  if (m.website)                     score += 10;
  if (m.manager)                     score += 10;

  if (score >= 80) return { score, label: 'Sağlıklı',   color: '#34d399' };
  if (score >= 50) return { score, label: 'Orta',        color: '#fbbf24' };
  return              { score, label: 'Zayıf',        color: '#f87171' };
}

// ─── BranchForm ───────────────────────────────────────────────────────────────
function BranchForm({
  initial, onSubmit, onCancel, saving, C,
}: {
  initial: typeof EMPTY_BRANCH;
  onSubmit: (d: typeof EMPTY_BRANCH) => void;
  onCancel: () => void;
  saving: boolean;
  C: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState(initial);
  const f = (k: keyof typeof EMPTY_BRANCH) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const fields: { key: keyof typeof EMPTY_BRANCH; label: string; placeholder: string; required?: boolean; type?: string; span?: number }[] = [
    { key: 'name',         label: 'Şube Adı',         placeholder: 'Merkez Şube',   required: true, span: 2 },
    { key: 'address',      label: 'Adres',             placeholder: 'Tam adres…',   required: true, span: 2 },
    { key: 'city',         label: 'Şehir',             placeholder: 'İstanbul',     required: true },
    { key: 'district',     label: 'İlçe',              placeholder: 'Kadıköy' },
    { key: 'phone',        label: 'Telefon',           placeholder: '0212 xxx xx xx' },
    { key: 'workingHours', label: 'Çalışma Saatleri',  placeholder: '08:00–22:00' },
    { key: 'latitude',     label: 'Enlem',             placeholder: '41.0082', type: 'number', required: true },
    { key: 'longitude',    label: 'Boylam',            placeholder: '28.9784', type: 'number', required: true },
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f2) => (
          <div key={f2.key} className={f2.span === 2 ? 'col-span-2' : ''}>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: C.muted }}>
              {f2.label}{f2.required ? ' *' : ''}
            </label>
            <input
              type={f2.type ?? 'text'}
              step={f2.type === 'number' ? 'any' : undefined}
              required={!!f2.required}
              value={form[f2.key]}
              onChange={f(f2.key)}
              placeholder={f2.placeholder}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-xs font-bold"
          style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
          İptal
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
          style={{ background: '#3b82f6' }}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}

// ─── Detay Drawer ─────────────────────────────────────────────────────────────
function MarketDetayDrawer({
  market,
  onClose,
  onRefresh,
  C,
}: {
  market: MarketWithExtra;
  onClose: () => void;
  onRefresh: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const [tab,       setTab]       = useState<DrawerTab>('genel');
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [reports,   setReports]   = useState<Report[]>([]);
  const [managers,  setManagers]  = useState<User[]>([]);
  const [loadB,     setLoadB]     = useState(false);
  const [loadR,     setLoadR]     = useState(false);
  const [loadM,     setLoadM]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState<string | null>(null);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editBranch,    setEditBranch]    = useState<Branch | null>(null);

  // Genel form
  const [form, setForm] = useState({
    name:       market.name,
    brandColor: market.brandColor ?? '#3B82F6',
    website:    market.website ?? '',
    logoUrl:    market.logoUrl ?? '',
    isActive:   market.isActive,
  });

  const brand = market.brandColor ?? '#3b82f6';

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  // Şubeler
  const loadBranches = useCallback(async () => {
    setLoadB(true);
    try {
      const list = await marketsApi.getBranches(market.id, true);
      setBranches(Array.isArray(list) ? list : []);
    } catch { /**/ }
    finally { setLoadB(false); }
  }, [market.id]);

  // Raporlar
  const loadReports = useCallback(async () => {
    setLoadR(true);
    try {
      const d = await reportsApi.getAll({ marketId: market.id, limit: 50 } as any);
      setReports((d.items ?? []) as Report[]);
    } catch { /**/ }
    finally { setLoadR(false); }
  }, [market.id]);

  // Yöneticiler
  const loadManagers = useCallback(async () => {
    setLoadM(true);
    try {
      const d = await usersApi.getAll({ role: 'MARKET_MANAGER', limit: 100 });
      setManagers((d.items ?? []) as User[]);
    } catch { /**/ }
    finally { setLoadM(false); }
  }, []);

  useEffect(() => {
    if (tab === 'subeler')   loadBranches();
    if (tab === 'raporlar')  loadReports();
    if (tab === 'yonetici')  loadManagers();
  }, [tab, loadBranches, loadReports, loadManagers]);

  const handleSaveGenel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await marketsApi.update(market.id, form);
      showToast('Market güncellendi');
      onRefresh();
    } catch { showToast('Güncelleme başarısız', true); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async () => {
    try {
      await marketsApi.update(market.id, { isActive: !form.isActive });
      setForm((f) => ({ ...f, isActive: !f.isActive }));
      showToast(!form.isActive ? 'Market aktifleştirildi' : 'Market devre dışı bırakıldı');
      onRefresh();
    } catch { showToast('Durum güncellenemedi', true); }
  };

  const handleAddBranch = async (data: typeof EMPTY_BRANCH) => {
    setSaving(true);
    try {
      await marketsApi.createBranch(market.id, {
        name: data.name, address: data.address, city: data.city,
        district: data.district || undefined,
        latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude),
        phone: data.phone || undefined, workingHours: data.workingHours || undefined,
      });
      setShowAddBranch(false);
      showToast('Şube eklendi');
      loadBranches();
      onRefresh();
    } catch { showToast('Şube eklenemedi', true); }
    finally { setSaving(false); }
  };

  const handleUpdateBranch = async (data: typeof EMPTY_BRANCH) => {
    if (!editBranch) return;
    setSaving(true);
    try {
      await marketsApi.updateBranch(editBranch.id, {
        name: data.name, address: data.address, city: data.city,
        district: data.district || undefined,
        latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude),
        phone: data.phone || undefined, workingHours: data.workingHours || undefined,
      });
      setEditBranch(null);
      showToast('Şube güncellendi');
      loadBranches();
    } catch { showToast('Güncelleme başarısız', true); }
    finally { setSaving(false); }
  };

  const handleToggleBranch = async (b: Branch) => {
    try {
      await marketsApi.updateBranch(b.id, { isActive: !b.isActive });
      showToast(!b.isActive ? 'Şube aktifleştirildi' : 'Şube devre dışı');
      loadBranches();
    } catch { showToast('Durum güncellenemedi', true); }
  };

  const hs = healthScore(market);

  const TABS: { id: DrawerTab; label: string; icon: string }[] = [
    { id: 'genel',    label: 'Genel',    icon: '⚙️' },
    { id: 'subeler',  label: 'Şubeler',  icon: '📍' },
    { id: 'raporlar', label: 'Raporlar', icon: '⚠️' },
    { id: 'yonetici', label: 'Yönetici', icon: '👤' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      {toast && (
        <div className="fixed top-5 right-5 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
          {toast}
        </div>
      )}

      <div className="ml-auto w-full max-w-xl h-full flex flex-col overflow-hidden"
        style={{ background: C.card, borderLeft: `1px solid ${C.border}` }}>

        {/* Drawer Üst */}
        <div className="relative flex-shrink-0">
          {/* Brand banner */}
          <div className="h-2" style={{ background: brand }} />
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: brand }}>
                {market.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: C.text }}>{market.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: `${hs.color}18`, color: hs.color }}>
                    {hs.label} %{hs.score}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: form.isActive ? '#34d39920' : '#f8717120', color: form.isActive ? '#34d399' : '#f87171' }}>
                    {form.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: C.cardAlt, color: C.muted }}>✕</button>
          </div>

          {/* Sekmeler */}
          <div className="flex px-1 pt-1 gap-0.5" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 rounded-t-lg"
                style={tab === t.id
                  ? { color: brand, background: C.card, borderBottom: `2px solid ${brand}`, marginBottom: -1 }
                  : { color: C.muted, borderBottom: '2px solid transparent', marginBottom: -1 }}>
                <span className="text-sm">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sekme İçeriği */}
        <div className="flex-1 overflow-y-auto">

          {/* ── GENEL ── */}
          {tab === 'genel' && (
            <div className="p-5 space-y-5">
              {/* Hızlı özet satırı */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Şube',    value: market._count?.branches ?? 0, color: brand,    onClick: () => setTab('subeler'), icon: '📍' },
                  { label: 'Katalog', value: market._count?.catalogs ?? 0, color: C.amber,  onClick: () => {},                icon: '📖' },
                  { label: 'İhbar',   value: market.reportCount ?? 0,       color: (market.reportCount ?? 0) > 0 ? C.red : C.muted, onClick: () => setTab('raporlar'), icon: '📋' },
                ].map((s) => (
                  <button key={s.label} onClick={s.onClick}
                    className="rounded-2xl p-3.5 text-center transition-all hover:scale-105"
                    style={{ background: `${s.color}10`, border: `1.5px solid ${s.color}28` }}>
                    <span className="text-base">{s.icon}</span>
                    <p className="text-2xl font-black tabular-nums mt-1 leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] font-bold mt-1 uppercase tracking-wider" style={{ color: C.muted }}>{s.label}</p>
                  </button>
                ))}
              </div>

              {/* Sağlık paneli */}
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>
                    Operasyonel Sağlık
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${hs.score}%`, background: `linear-gradient(90deg, ${brand}, ${hs.color})` }} />
                    </div>
                    <span className="text-xs font-black tabular-nums" style={{ color: hs.color }}>%{hs.score}</span>
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: C.border }}>
                  {[
                    { label: 'Market Aktif',  desc: 'Kullanıcılara gösteriliyor',    ok: form.isActive },
                    { label: 'Şube Kayıtlı',  desc: `${market._count?.branches ?? 0} şube mevcut`, ok: (market._count?.branches ?? 0) > 0 },
                    { label: 'Katalog Aktif', desc: `${market._count?.catalogs ?? 0} katalog`,      ok: (market._count?.catalogs ?? 0) > 0 },
                    { label: 'Website',       desc: market.website || 'Girilmemiş',  ok: !!market.website },
                    { label: 'Yönetici',      desc: market.manager ? `${market.manager.name} ${market.manager.surname}` : 'Atanmamış', ok: !!market.manager },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ background: c.ok ? '#34d39920' : '#f8717115', color: c.ok ? '#34d399' : '#f87171' }}>
                        {c.ok ? '✓' : '✕'}
                      </span>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: C.text, minWidth: 90 }}>{c.label}</span>
                      <span className="text-xs truncate" style={{ color: C.muted }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aktif/Pasif hızlı toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: C.text }}>Uygulama Görünürlüğü</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                    {form.isActive ? 'Market kullanıcılara gösteriliyor' : 'Market gizli — kullanıcılar göremez'}
                  </p>
                </div>
                <button onClick={handleToggleActive}
                  className="w-12 h-6 rounded-full relative transition-colors flex-shrink-0"
                  style={{ background: form.isActive ? '#34d399' : C.border }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: form.isActive ? 'translateX(26px)' : 'translateX(2px)' }} />
                </button>
              </div>

              {/* Düzenleme Formu */}
              <form onSubmit={handleSaveGenel} className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
                  Market Bilgileri
                </p>
                {[
                  { key: 'name',    label: 'Market Adı',   type: 'text', placeholder: 'Migros', required: true },
                  { key: 'website', label: 'Website',      type: 'url',  placeholder: 'https://…' },
                  { key: 'logoUrl', label: 'Logo URL',     type: 'url',  placeholder: 'https://…/logo.png' },
                ].map((f2) => (
                  <div key={f2.key}>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
                      {f2.label}{f2.required ? ' *' : ''}
                    </label>
                    <input type={f2.type} required={!!f2.required}
                      value={(form as any)[f2.key]} placeholder={f2.placeholder}
                      onChange={(e) => setForm({ ...form, [f2.key]: e.target.value })}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
                    Marka Rengi
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.brandColor}
                      onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                      className="h-10 w-14 rounded-xl cursor-pointer p-1"
                      style={{ border: `1px solid ${C.border}` }} />
                    <div className="flex-1 h-10 rounded-xl flex items-center px-3"
                      style={{ background: form.brandColor + '22', border: `1px solid ${C.border}` }}>
                      <span className="text-sm font-mono" style={{ color: C.secondary }}>{form.brandColor}</span>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: brand }}>
                  {saving ? 'Kaydediliyor…' : '💾 Değişiklikleri Kaydet'}
                </button>
              </form>
            </div>
          )}

          {/* ── ŞUBELER ── */}
          {tab === 'subeler' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: C.text }}>
                  {branches.length} şube
                </p>
                <button onClick={() => { setShowAddBranch(true); setEditBranch(null); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                  style={{ background: brand }}>
                  + Şube Ekle
                </button>
              </div>

              {showAddBranch && (
                <div className="p-4 rounded-xl space-y-3"
                  style={{ background: `${brand}08`, border: `1px solid ${brand}25` }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brand }}>
                    Yeni Şube
                  </p>
                  <BranchForm initial={EMPTY_BRANCH} onSubmit={handleAddBranch}
                    onCancel={() => setShowAddBranch(false)} saving={saving} C={C} />
                </div>
              )}

              {loadB ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
                </div>
              ) : branches.length === 0 ? (
                <div className="text-center py-12 fp-card">
                  <p className="text-3xl mb-2">📍</p>
                  <p className="text-sm" style={{ color: C.muted }}>Henüz şube eklenmemiş</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id}>
                      {editBranch?.id === b.id ? (
                        <div className="p-4 rounded-xl"
                          style={{ background: `${C.amber}08`, border: `1px solid ${C.amber}25` }}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.amber }}>
                            Şube Düzenle
                          </p>
                          <BranchForm
                            initial={{ name: b.name, address: b.address, city: b.city, district: b.district ?? '', phone: b.phone ?? '', workingHours: b.workingHours ?? '', latitude: String(b.latitude), longitude: String(b.longitude) }}
                            onSubmit={handleUpdateBranch} onCancel={() => setEditBranch(null)} saving={saving} C={C} />
                        </div>
                      ) : (
                        <div className="fp-card p-4 hover:brightness-105 transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold truncate" style={{ color: C.text }}>{b.name}</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: b.isActive ? '#34d39918' : '#f8717118', color: b.isActive ? '#34d399' : '#f87171' }}>
                                  {b.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                              </div>
                              <p className="text-xs line-clamp-1" style={{ color: C.muted }}>{b.address}</p>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <span className="text-xs" style={{ color: C.muted }}>
                                  📍 {b.city}{b.district ? `, ${b.district}` : ''}
                                </span>
                                {b.phone && <span className="text-xs" style={{ color: C.muted }}>📞 {b.phone}</span>}
                                {b.workingHours && <span className="text-xs" style={{ color: C.muted }}>🕐 {b.workingHours}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                              <button onClick={() => { setEditBranch(b); setShowAddBranch(false); }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={{ background: `${brand}15`, color: brand }}>
                                Düzenle
                              </button>
                              <button onClick={() => handleToggleBranch(b)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                                style={b.isActive
                                  ? { background: '#f8717115', color: '#f87171' }
                                  : { background: '#34d39915', color: '#34d399' }}>
                                {b.isActive ? 'Pasif' : 'Aktif'}
                              </button>
                            </div>
                          </div>
                          {b.latitude !== 0 && (
                            <a href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                              target="_blank" rel="noreferrer"
                              className="mt-2 text-xs font-medium flex items-center gap-1 hover:underline"
                              style={{ color: brand }}>
                              🗺 Haritada Gör →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── RAPORLAR ── */}
          {tab === 'raporlar' && (
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: C.text }}>Gelen İhbarlar</p>
                <p className="text-xs" style={{ color: C.muted }}>{reports.length} kayıt</p>
              </div>

              {loadR ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 fp-card">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm" style={{ color: C.muted }}>Bu markete ait ihbar yok</p>
                </div>
              ) : (
                <>
                  {/* Mini istatistik */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Bekleyen', value: reports.filter(r => r.status === 'PENDING').length, color: '#fbbf24' },
                      { label: 'Onaylanan', value: reports.filter(r => r.status === 'APPROVED').length, color: '#34d399' },
                      { label: 'Reddedilen', value: reports.filter(r => r.status === 'REJECTED').length, color: '#f87171' },
                    ].map(s => (
                      <div key={s.label} className="fp-card p-3 text-center">
                        <p className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {reports.slice(0, 20).map((r) => {
                      const statusColor: Record<string, string> = {
                        PENDING: '#fbbf24', UNDER_REVIEW: '#60a5fa',
                        APPROVED: '#34d399', REJECTED: '#f87171', RESOLVED: '#94a3b8',
                      };
                      const statusLabel: Record<string, string> = {
                        PENDING: 'Bekliyor', UNDER_REVIEW: 'İnceleniyor',
                        APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', RESOLVED: 'Çözüldü',
                      };
                      const sc = statusColor[r.status] ?? C.muted;
                      return (
                        <div key={r.id} className="fp-card p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{ background: `${sc}18`, color: sc }}>
                              {statusLabel[r.status] ?? r.status}
                            </span>
                            <span className="text-[10px]" style={{ color: C.muted }}>
                              {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: C.text }}>
                            {r.description}
                          </p>
                          {r.expiryDate && (
                            <p className="text-[10px] mt-1 font-semibold" style={{ color: '#f87171' }}>
                              SKT: {new Date(r.expiryDate).toLocaleDateString('tr-TR')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── YÖNETİCİ ── */}
          {tab === 'yonetici' && (
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
                  Bu Markete Atanmış Yönetici
                </p>
                {market.manager ? (
                  <div className="fp-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: brand }}>
                        {(market.manager.name ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: C.text }}>
                          {market.manager.name} {market.manager.surname}
                        </p>
                        <p className="text-xs" style={{ color: C.muted }}>{market.manager.email}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: '#34d39918', color: '#34d399' }}>
                        Atanmış
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="fp-card p-4 text-center">
                    <p className="text-sm" style={{ color: C.muted }}>Bu markete atanmış yönetici yok</p>
                    <p className="text-xs mt-1" style={{ color: C.muted }}>
                      Kullanıcılar sayfasından Market Yöneticisi rolü atayabilirsiniz
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>
                  Tüm Market Yöneticileri ({managers.filter((m) => m.managedMarket?.id === market.id).length} atanmış)
                </p>

                {loadM ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 rounded-full border-2 animate-spin"
                      style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
                  </div>
                ) : managers.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: C.muted }}>Market yöneticisi bulunamadı</p>
                ) : (
                  <div className="space-y-2">
                    {managers.map((u) => {
                      const isAssigned = u.managedMarket?.id === market.id;
                      return (
                        <div key={u.id} className="fp-card p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: isAssigned ? brand : C.secondary }}>
                            {u.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>
                              {u.name} {u.surname}
                            </p>
                            <p className="text-xs truncate" style={{ color: C.muted }}>
                              {u.managedMarket ? `→ ${u.managedMarket.name}` : 'Atanmamış'}
                            </p>
                          </div>
                          {isAssigned && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0"
                              style={{ background: `${brand}20`, color: brand }}>Bu Market</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Market Kartı ─────────────────────────────────────────────────────────────
function MarketKart({
  market, onClick, onQuickToggle, C,
}: {
  market: MarketWithExtra;
  onClick: () => void;
  onQuickToggle: (m: MarketWithExtra) => void;
  C: ReturnType<typeof useColors>;
}) {
  const brand = market.brandColor ?? '#3b82f6';
  const hs    = healthScore(market);

  return (
    <div
      className="group overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: `0 1px 4px rgba(0,0,0,0.06)`,
      }}
      onClick={onClick}
    >
      {/* ── Renkli başlık bloğu ──────────────────────────────── */}
      <div className="relative px-5 pt-5 pb-4 flex items-start justify-between gap-3"
        style={{ background: `linear-gradient(135deg, ${brand}18 0%, ${brand}06 100%)`, borderBottom: `1px solid ${brand}20` }}>

        {/* Avatar */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-sm"
            style={{ background: brand }}>
            {market.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight truncate" style={{ color: C.text }}>
              {market.name}
            </p>
            {market.website ? (
              <a href={market.website} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] hover:underline truncate block mt-0.5 max-w-[160px]"
                style={{ color: brand }}>
                {market.website.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>website yok</p>
            )}
          </div>
        </div>

        {/* Sağ üst: aktif toggle + sağlık */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onQuickToggle(market); }}
            title={market.isActive ? 'Pasife Al' : 'Aktifleştir'}
            className="relative rounded-full transition-all flex-shrink-0"
            style={{ width: 44, height: 24, background: market.isActive ? '#34d399' : `${C.border}` }}>
            <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
              style={{ left: market.isActive ? 24 : 4 }} />
          </button>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
            style={{ background: `${hs.color}18`, color: hs.color }}>
            {hs.label}
          </span>
        </div>
      </div>

      {/* ── Gövde ────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* Metrik üçlüsü */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '🏢', label: 'Şube',    value: market._count?.branches ?? 0, accent: brand },
            { icon: '📖', label: 'Katalog', value: market._count?.catalogs ?? 0, accent: C.amber },
            { icon: '📋', label: 'İhbar',   value: market.reportCount ?? 0,
              accent: (market.pendingReports ?? 0) > 0 ? C.red : C.muted,
              alert: (market.pendingReports ?? 0) > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center relative"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
              {s.alert && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
                  style={{ background: C.red, borderColor: C.card }} />
              )}
              <p className="text-xl font-black tabular-nums leading-none" style={{ color: s.accent }}>
                {s.value}
              </p>
              <p className="text-[10px] font-semibold mt-1 uppercase tracking-wide" style={{ color: C.muted }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Sağlık çubuğu */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Operasyonel Sağlık</span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: hs.color }}>%{hs.score}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
            <div className="h-full rounded-full transition-all duration-700 group-hover:opacity-100"
              style={{ width: `${hs.score}%`, background: `linear-gradient(90deg, ${brand}, ${hs.color})` }} />
          </div>
        </div>

        {/* Alt aksiyon satırı */}
        <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: market.isActive ? '#34d399' : '#f87171' }} />
            <span className="text-xs font-semibold" style={{ color: market.isActive ? '#34d399' : '#f87171' }}>
              {market.isActive ? 'Aktif' : 'Pasif'}
            </span>
            {(market.pendingReports ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1"
                style={{ background: '#f8717118', color: '#f87171' }}>
                ⚠ {market.pendingReports} bekleyen
              </span>
            )}
          </div>
          <span className="text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: brand }}>
            Aç <span className="text-base leading-none">→</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function MarketsPage() {
  const C = useColors();
  const [markets,  setMarkets]  = useState<MarketWithExtra[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'active' | 'passive'>('all');
  const [showAdd,  setShowAdd]  = useState(false);
  const [drawer,   setDrawer]   = useState<MarketWithExtra | null>(null);
  const [form,     setForm]     = useState(EMPTY_MARKET);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<string | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketsApi.getAll();
      setMarkets(data as MarketWithExtra[]);
    } catch { showToast('Marketler yüklenemedi', true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await marketsApi.create(form);
      setShowAdd(false);
      setForm(EMPTY_MARKET);
      showToast('Market oluşturuldu');
      loadMarkets();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Oluşturulamadı', true);
    } finally { setSaving(false); }
  };

  const handleQuickToggle = async (market: MarketWithExtra) => {
    try {
      await marketsApi.update(market.id, { isActive: !market.isActive });
      showToast(!market.isActive ? `${market.name} aktifleştirildi` : `${market.name} devre dışı`);
      loadMarkets();
    } catch { showToast('Durum güncellenemedi', true); }
  };

  const filtered = markets.filter((m) => {
    const nameMatch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    const statusMatch = filter === 'all' || (filter === 'active' ? m.isActive : !m.isActive);
    return nameMatch && statusMatch;
  });

  const activeCount  = markets.filter((m) => m.isActive).length;
  const passiveCount = markets.length - activeCount;
  const totalBranches = markets.reduce((s, m) => s + (m._count?.branches ?? 0), 0);
  const totalCatalogs = markets.reduce((s, m) => s + (m._count?.catalogs ?? 0), 0);

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>{toast}</div>
      )}

      {/* ── Komut Başlığı ───────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}>

        {/* Üst bant */}
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.blue }}>
              Market İstihbarat Merkezi
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Market Yönetimi</h1>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{ background: C.blue }}>
            <span className="text-base leading-none">+</span> Yeni Market
          </button>
        </div>

        {/* Metrik şerit */}
        <div className="grid grid-cols-2 md:grid-cols-4"
          style={{ borderTop: `1px solid ${C.border}` }}>
          {[
            { label: 'Toplam',    value: markets.length,  sub: 'market',   color: C.blue,   icon: '🏪' },
            { label: 'Aktif',     value: activeCount,     sub: 'çalışıyor', color: C.green,  icon: '✅' },
            { label: 'Şube',      value: totalBranches,   sub: 'toplam',   color: C.amber,  icon: '📍' },
            { label: 'Katalog',   value: totalCatalogs,   sub: 'yayında',  color: C.purple, icon: '📖' },
          ].map((s, i) => (
            <div key={s.label}
              className="px-5 py-4 flex items-center gap-3"
              style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${s.color}14` }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-black tabular-nums leading-none" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-[11px] mt-0.5 font-medium" style={{ color: C.muted }}>
                  {s.label} <span style={{ color: C.border }}>·</span> {s.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Arama + Filtre */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-3"
          style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
          <div className="relative flex-1 min-w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Market adına göre ara…"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          <div className="flex gap-1">
            {([['all', 'Tümü'], ['active', `Aktif (${activeCount})`], ['passive', `Pasif (${passiveCount})`]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className="px-3.5 py-2 rounded-lg text-xs font-bold transition-all"
                style={filter === val
                  ? { background: C.blue, color: '#fff' }
                  : { background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fp-card py-20 text-center">
          <p className="text-5xl mb-4">🏪</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>
            {search ? 'Eşleşen market bulunamadı' : 'Henüz market yok'}
          </p>
          {!search && (
            <button onClick={() => setShowAdd(true)}
              className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: C.blue }}>
              İlk Marketi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MarketKart key={m.id} market={m}
              onClick={() => setDrawer(m)}
              onQuickToggle={handleQuickToggle}
              C={C} />
          ))}
        </div>
      )}

      {/* Yeni Market Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="font-bold" style={{ color: C.text }}>Yeni Market Ekle</p>
              <button onClick={() => setShowAdd(false)} style={{ color: C.muted }}>✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {[
                { key: 'name',    label: 'Market Adı',  type: 'text', placeholder: 'Migros', required: true },
                { key: 'website', label: 'Website',     type: 'url',  placeholder: 'https://…' },
                { key: 'logoUrl', label: 'Logo URL',    type: 'url',  placeholder: 'https://…/logo.png' },
              ].map((f2) => (
                <div key={f2.key}>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
                    {f2.label}{f2.required ? ' *' : ''}
                  </label>
                  <input type={f2.type} required={!!f2.required} placeholder={f2.placeholder}
                    value={(form as any)[f2.key]}
                    onChange={(e) => setForm({ ...form, [f2.key]: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
                  Marka Rengi
                </label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brandColor}
                    onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                    className="h-10 w-14 rounded-xl cursor-pointer p-1"
                    style={{ border: `1px solid ${C.border}` }} />
                  <div className="flex-1 h-10 rounded-xl flex items-center px-3"
                    style={{ background: form.brandColor + '22', border: `1px solid ${C.border}` }}>
                    <span className="text-sm font-mono" style={{ color: C.secondary }}>{form.brandColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  İptal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: C.blue }}>
                  {saving ? 'Oluşturuluyor…' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay Drawer */}
      {drawer && (
        <MarketDetayDrawer
          market={drawer}
          onClose={() => setDrawer(null)}
          onRefresh={() => { loadMarkets(); }}
          C={C}
        />
      )}
    </div>
  );
}
