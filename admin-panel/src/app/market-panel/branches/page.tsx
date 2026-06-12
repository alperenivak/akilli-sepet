'use client';

import { useState, useEffect } from 'react';
import { marketsApi, marketPanelApi } from '../../../lib/api';
import { ManagedMarket } from '../../../types';
import { useColors } from '../../../context/ThemeContext';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

export default function MarketBranchesPage() {
  const C = useColors();
  const [market,   setMarket]   = useState<ManagedMarket | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', district: '', latitude: '', longitude: '', phone: '' });

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('admin_user') ?? '{}'); setMarket(u.managedMarket ?? null); }
    catch { /**/ }
  }, []);

  const load = async () => {
    if (!market) return;
    setLoading(true);
    try { setBranches(await marketPanelApi.getBranches(market.id) as Branch[]); }
    catch { setBranches([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [market]);

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!market) return;
    setSaving(true);
    try {
      await marketsApi.createBranch(market.id, {
        name: form.name, address: form.address, city: form.city,
        district: form.district || undefined,
        latitude: parseFloat(form.latitude) || 0,
        longitude: parseFloat(form.longitude) || 0,
      } as any);
      setShowAdd(false);
      setForm({ name: '', address: '', city: '', district: '', latitude: '', longitude: '', phone: '' });
      showToast('Şube eklendi');
      load();
    } catch { showToast('Şube eklenemedi', true); }
    finally { setSaving(false); }
  };

  const brand    = market?.brandColor ?? '#3b82f6';
  const filtered = branches.filter((b) =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  // Group by city
  const cities = [...new Set(filtered.map((b) => b.city))].sort();

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>{toast}</div>
      )}

      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: brand }}>Şube Ağı</p>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Şubeler</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {market?.name} · {branches.length} şube · {cities.length} şehir
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: brand }}>
          + Şube Ekle
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Şube', value: branches.length,   icon: '🏪', color: brand },
          { label: 'Şehir',       value: cities.length,      icon: '🗺', color: C.green },
          { label: 'İlçe',        value: [...new Set(branches.map((b) => b.district ?? '—'))].length, icon: '📍', color: C.amber },
          { label: 'Telefon Kayıtlı', value: branches.filter((b) => b.phone).length, icon: '📞', color: '#60a5fa' },
        ].map((s) => (
          <div key={s.label} className="fp-card p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Arama */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>🔍</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Şube adı, şehir veya adres ara…"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
      </div>

      {/* Şubeler */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${brand}20`, borderTopColor: brand }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fp-card py-20 text-center">
          <p className="text-5xl mb-4">📍</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>
            {search ? 'Eşleşen şube bulunamadı' : 'Henüz şube yok'}
          </p>
          {!search && (
            <button onClick={() => setShowAdd(true)}
              className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: brand }}>
              İlk Şubeyi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {cities.map((city) => {
            const cityBranches = filtered.filter((b) => b.city === city);
            return (
              <div key={city}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-bold" style={{ color: C.secondary }}>
                    🗺 {city}
                  </p>
                  <div className="flex-1 h-px" style={{ background: C.border }} />
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                    style={{ background: `${brand}15`, color: brand }}>
                    {cityBranches.length} şube
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {cityBranches.map((branch) => (
                    <div key={branch.id} className="fp-card p-5 hover:brightness-105 transition-all">
                      <div className="flex items-start gap-3">
                        {/* İkon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: `${brand}15` }}>
                          🏪
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm truncate" style={{ color: C.text }}>{branch.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                            {city}{branch.district ? ` / ${branch.district}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                          📍 {branch.address}
                        </p>
                        {branch.phone && (
                          <p className="text-xs" style={{ color: C.muted }}>📞 {branch.phone}</p>
                        )}
                        {branch.latitude !== undefined && branch.latitude !== 0 && (
                          <a href={`https://maps.google.com/?q=${branch.latitude},${branch.longitude}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs font-medium flex items-center gap-1 hover:underline"
                            style={{ color: brand }}>
                            🗺 Haritada Gör →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Şube Ekle Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="font-bold" style={{ color: C.text }}>Yeni Şube Ekle</p>
              <button onClick={() => setShowAdd(false)} style={{ color: C.muted }}>✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 grid grid-cols-2 gap-4">
              {[
                { key: 'name',      label: 'Şube Adı',    type: 'text', placeholder: 'Merkez Şube', span: 2 },
                { key: 'address',   label: 'Adres',       type: 'text', placeholder: 'Tam adres', span: 2 },
                { key: 'city',      label: 'Şehir',       type: 'text', placeholder: 'İstanbul', span: 1 },
                { key: 'district',  label: 'İlçe (opsiyonel)', type: 'text', placeholder: 'Kadıköy', span: 1 },
                { key: 'phone',     label: 'Telefon (opsiyonel)', type: 'tel', placeholder: '0212...', span: 2 },
                { key: 'latitude',  label: 'Enlem',       type: 'number', placeholder: '41.01', span: 1 },
                { key: 'longitude', label: 'Boylam',      type: 'number', placeholder: '28.97', span: 1 },
              ].map((f) => (
                <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
                    {f.label}
                  </label>
                  <input type={f.type} placeholder={f.placeholder}
                    required={!f.label.includes('opsiyonel')}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }} />
                </div>
              ))}
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>İptal</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: brand }}>{saving ? 'Ekleniyor…' : 'Şube Ekle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
