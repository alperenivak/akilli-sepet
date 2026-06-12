'use client';

import { useState, useEffect, useCallback } from 'react';
import { usersApi, marketsApi } from '../../../lib/api';
import { User, UserRole, PaginatedResponse, Market } from '../../../types';
import { useColors } from '../../../context/ThemeContext';

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const ROLE_META: Record<UserRole, { label: string; icon: string; color: string }> = {
  SUPER_ADMIN:    { label: 'Süper Admin',       icon: '👑', color: '#a78bfa' },
  ADMIN:          { label: 'Admin',             icon: '🛡️', color: '#60a5fa' },
  INSPECTOR:      { label: 'Denetçi',           icon: '🔍', color: '#34d399' },
  MARKET_MANAGER: { label: 'Market Yöneticisi', icon: '🏪', color: '#fb923c' },
  USER:           { label: 'Kullanıcı',         icon: '👤', color: '#94a3b8' },
};

// ─── Kullanıcı Detay Drawer ───────────────────────────────────────────────────
function KullaniciDrawer({
  user,
  markets,
  onClose,
  onRefresh,
  C,
}: {
  user: User;
  markets: Market[];
  onClose: () => void;
  onRefresh: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);
  const [newRole,      setNewRole]      = useState<UserRole>(user.role);
  const [confirmDeact, setConfirmDeact] = useState(false);
  const [tab,          setTab]          = useState<'profil' | 'rol' | 'islemler'>('profil');
  const [banDuration,  setBanDuration]  = useState(60);
  const [banReason,    setBanReason]    = useState('');
  const [banCustomMin, setBanCustomMin] = useState(120);
  const [confirmBan,   setConfirmBan]   = useState(false);

  const rm    = ROLE_META[user.role];
  const isSA  = user.role === 'SUPER_ADMIN';

  // Ban hesaplamaları
  const isBanned = user.isPermanentBan || (user.bannedUntil ? new Date(user.bannedUntil) > new Date() : false);
  const isPermanentBan = !!user.isPermanentBan;
  const banEndsAt = user.bannedUntil ? new Date(user.bannedUntil) : null;
  const banMsLeft = banEndsAt ? Math.max(0, banEndsAt.getTime() - Date.now()) : 0;
  const banHoursLeft = Math.floor(banMsLeft / 3600000);
  const banMinsLeft  = Math.floor((banMsLeft % 3600000) / 60000);

  const BAN_PRESETS = [
    { label: '30 dk',  minutes: 30 },
    { label: '1 saat', minutes: 60 },
    { label: '6 saat', minutes: 360 },
    { label: '1 gün',  minutes: 1440 },
    { label: '3 gün',  minutes: 4320 },
    { label: '7 gün',  minutes: 10080 },
  ];

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      await usersApi.toggleActive(user.id);
      showToast(user.isActive ? 'Hesap askıya alındı' : 'Hesap aktifleştirildi');
      onRefresh();
      setConfirmDeact(false);
    } catch { showToast('İşlem başarısız', true); }
    finally { setSaving(false); }
  };

  const handleChangeRole = async () => {
    if (newRole === user.role) return;
    setSaving(true);
    try {
      await usersApi.changeRole(user.id, newRole);
      showToast(`Rol → ${ROLE_META[newRole].label}`);
      onRefresh();
    } catch { showToast('Rol değiştirilemedi', true); }
    finally { setSaving(false); }
  };

  const handleBan = async () => {
    if (!banReason.trim()) { showToast('Ban sebebi zorunludur', true); return; }
    const isPermanent = banDuration === -2;
    const mins = banDuration === -1 ? banCustomMin : banDuration;
    setSaving(true);
    try {
      await usersApi.banUser(user.id, {
        reason: banReason.trim(),
        ...(isPermanent ? { isPermanent: true } : { durationMinutes: mins }),
      });
      showToast(
        isPermanent
          ? 'Kalıcı ban uygulandı'
          : `Ban uygulandı — ${mins < 60 ? `${mins} dk` : mins < 1440 ? `${mins / 60} saat` : `${Math.round(mins / 1440)} gün`}`,
      );
      setBanReason('');
      setConfirmBan(false);
      onRefresh();
    } catch { showToast('Ban uygulanamadı', true); }
    finally { setSaving(false); }
  };

  const handleUnban = async () => {
    setSaving(true);
    try {
      await usersApi.unbanUser(user.id);
      showToast('Ban kaldırıldı');
      onRefresh();
    } catch { showToast('Ban kaldırılamadı', true); }
    finally { setSaving(false); }
  };

  const assignedMarket = markets.find((m) => m.id === user.managedMarket?.id);
  const joinedDays     = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);

  const TABS = [
    { id: 'profil'   as const, label: 'Profil',   icon: '👤' },
    { id: 'rol'      as const, label: 'Rol & Erişim', icon: '🛡️' },
    { id: 'islemler' as const, label: 'İşlemler', icon: '⚙️' },
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

      <div className="ml-auto w-full max-w-md h-full flex flex-col overflow-hidden"
        style={{ background: C.card, borderLeft: `1px solid ${C.border}` }}>

        {/* ── Profil Başlığı ─────────────────────────────────── */}
        <div className="flex-shrink-0 relative overflow-hidden">
          {/* Gradient arka plan */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${rm.color}18 0%, ${rm.color}06 100%)` }} />

          <div className="relative px-5 pt-5 pb-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md flex-shrink-0"
                  style={{ background: rm.color }}>
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-base leading-tight" style={{ color: C.text }}>
                    {user.name} {user.surname}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ background: `${rm.color}20`, color: rm.color }}>
                      {rm.icon} {rm.label}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: user.isActive ? '#34d39918' : '#f8717118', color: user.isActive ? '#34d399' : '#f87171' }}>
                      {user.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                    {isBanned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse"
                        style={{ background: '#f97316' + '25', color: '#f97316', border: '1px solid #f9731640' }}>
                        🚫 Banlı
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: C.cardAlt, color: C.muted }}>✕</button>
            </div>

            {/* Sekmeler */}
            <div className="flex gap-0.5">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex-1 py-2.5 text-xs font-bold transition-all rounded-t-lg flex items-center justify-center gap-1.5"
                  style={tab === t.id
                    ? { color: rm.color, background: C.card, borderBottom: `2px solid ${rm.color}`, marginBottom: -1 }
                    : { color: C.muted, borderBottom: '2px solid transparent', marginBottom: -1, background: 'transparent' }}>
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sekme İçeriği ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ borderTop: `1px solid ${C.border}` }}>

          {/* PROFIL */}
          {tab === 'profil' && (
            <div className="p-5 space-y-4">

              {/* Temel bilgiler */}
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Hesap Bilgileri</p>
                </div>
                {[
                  { icon: '✉️', label: 'E-posta',    value: user.email },
                  { icon: '📱', label: 'Telefon',    value: user.phone ?? 'Girilmemiş' },
                  { icon: '📅', label: 'Kayıt Tarihi', value: new Date(user.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  { icon: '⏱', label: 'Üyelik Süresi', value: joinedDays < 1 ? 'Bugün katıldı' : `${joinedDays} gün` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: `1px solid ${C.border}` }}>
                    <span className="text-base w-6 text-center flex-shrink-0">{row.icon}</span>
                    <span className="text-xs font-semibold w-28 flex-shrink-0" style={{ color: C.muted }}>{row.label}</span>
                    <span className="text-sm font-medium truncate" style={{ color: C.text }}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-base w-6 text-center flex-shrink-0">🆔</span>
                  <span className="text-xs font-semibold w-28 flex-shrink-0" style={{ color: C.muted }}>Kullanıcı ID</span>
                  <span className="text-xs font-mono truncate" style={{ color: C.muted }}>{user.id}</span>
                </div>
              </div>

              {/* Atanmış market (MARKET_MANAGER ise) */}
              {user.role === 'MARKET_MANAGER' && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Yönetilen Market</p>
                  </div>
                  {assignedMarket ? (
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: assignedMarket.brandColor ?? '#3b82f6' }}>
                        {assignedMarket.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm" style={{ color: C.text }}>{assignedMarket.name}</p>
                        {assignedMarket.website && (
                          <a href={assignedMarket.website} target="_blank" rel="noreferrer"
                            className="text-xs hover:underline" style={{ color: assignedMarket.brandColor ?? '#3b82f6' }}>
                            {assignedMarket.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: `${assignedMarket.brandColor ?? '#3b82f6'}20`, color: assignedMarket.brandColor ?? '#3b82f6' }}>
                        Atanmış
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm" style={{ color: C.muted }}>Market atanmamış</p>
                      <p className="text-xs mt-1" style={{ color: C.muted }}>
                        Market sayfasından bu kişiye market atayabilirsiniz
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Hızlı istatistikler */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: '📅', label: 'Gün', value: joinedDays },
                  { icon: '✅', label: 'Durum', value: user.isActive ? 'Aktif' : 'Pasif' },
                  { icon: rm.icon, label: 'Rol', value: rm.label.split(' ')[0] },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl p-3 text-center"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                    <p className="text-base">{s.icon}</p>
                    <p className="text-sm font-black mt-1 leading-tight" style={{ color: C.text }}>{s.value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: C.muted }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROL & ERİŞİM */}
          {tab === 'rol' && (
            <div className="p-5 space-y-4">
              {/* Mevcut rol */}
              <div className="p-4 rounded-2xl flex items-center gap-3"
                style={{ background: `${rm.color}10`, border: `1.5px solid ${rm.color}30` }}>
                <span className="text-2xl">{rm.icon}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: rm.color }}>Mevcut Rol</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: C.text }}>{rm.label}</p>
                </div>
              </div>

              {/* Rol yetkili açıklamaları */}
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Rol Yetkileri</p>
                </div>
                {({
                  SUPER_ADMIN:    ['Tüm sistem yönetimi', 'Kullanıcı rol ataması', 'Market oluşturma/silme', 'Sistem ayarları'],
                  ADMIN:          ['Market yönetimi', 'İhbar yönetimi', 'Ürün kataloğu', 'İstatistik görüntüleme'],
                  INSPECTOR:      ['İhbar inceleme/onaylama', 'Sonucu markete iletme', 'Denetim raporu oluşturma'],
                  MARKET_MANAGER: ['Market profil düzenleme', 'Şube yönetimi', 'Fiyat güncelleme', 'Katalog yönetimi'],
                  USER:           ['Ürün arama', 'İhbar bildirimi', 'Profil düzenleme'],
                } as Record<UserRole, string[]>)[user.role].map((perm) => (
                  <div key={perm} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: rm.color }}>✓</span>
                    <span className="text-xs" style={{ color: C.text }}>{perm}</span>
                  </div>
                ))}
              </div>

              {/* Rol değiştir */}
              {!isSA && (
                <div className="space-y-3 p-4 rounded-2xl" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>Rol Değiştir</p>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
                    {(Object.keys(ROLE_META) as UserRole[])
                      .filter((r) => r !== 'SUPER_ADMIN')
                      .map((r) => (
                        <option key={r} value={r}>
                          {ROLE_META[r].icon} {ROLE_META[r].label}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleChangeRole}
                    disabled={saving || newRole === user.role}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
                    style={{ background: ROLE_META[newRole].color }}>
                    {saving ? 'Kaydediliyor…' : newRole === user.role ? 'Rol Değiştirilmedi' : `→ ${ROLE_META[newRole].label} Yap`}
                  </button>
                </div>
              )}

              {isSA && (
                <div className="p-4 rounded-2xl text-center"
                  style={{ background: `${'#a78bfa'}10`, border: `1px solid ${'#a78bfa'}25` }}>
                  <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>👑 Süper Admin</p>
                  <p className="text-xs mt-1" style={{ color: C.muted }}>Bu kullanıcının rolü değiştirilemez</p>
                </div>
              )}
            </div>
          )}

          {/* İŞLEMLER */}
          {tab === 'islemler' && (
            <div className="p-5 space-y-4">

              {/* ── Aktif Ban Uyarısı ─────────────────────────────── */}
              {isBanned && (
                <div className="rounded-2xl p-4"
                  style={{ background: '#f9731610', border: '1.5px solid #f9731640' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-sm flex items-center gap-2" style={{ color: '#f97316' }}>
                      🚫 Aktif Ban
                    </p>
                    {!isSA && (
                      <button onClick={handleUnban} disabled={saving}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40 text-white"
                        style={{ background: '#f97316' }}>
                        {saving ? '…' : 'Banı Kaldır'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold w-20 flex-shrink-0" style={{ color: '#f97316' }}>Sebep:</span>
                      <span className="text-xs font-medium" style={{ color: C.text }}>{user.banReason ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold w-20 flex-shrink-0" style={{ color: '#f97316' }}>Tür:</span>
                      <span className="text-xs font-medium" style={{ color: C.text }}>
                        {isPermanentBan ? 'Kalıcı ban' : 'Geçici ban'}
                      </span>
                    </div>
                    {!isPermanentBan && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold w-20 flex-shrink-0" style={{ color: '#f97316' }}>Bitiş:</span>
                          <span className="text-xs font-medium" style={{ color: C.text }}>
                            {banEndsAt?.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold w-20 flex-shrink-0" style={{ color: '#f97316' }}>Kalan:</span>
                          <span className="text-xs font-bold" style={{ color: '#f97316' }}>
                            {banHoursLeft > 0 ? `${banHoursLeft} saat ` : ''}{banMinsLeft} dakika
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Ban Uygula ────────────────────────────────────── */}
              {!isSA && !isBanned && (
                <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  <div className="px-4 py-2.5 flex items-center justify-between"
                    style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Ban Uygula</p>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
                      style={{ background: '#f9731615', color: '#f97316' }}>Kısıtlama</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                      Ban uygulanan kullanıcı mobil uygulamada tam ekran ban mesajı görür.
                      Geçici ban süresi dolduğunda erişim otomatik açılır; kalıcı ban yönetici kaldırana kadar sürer.
                    </p>

                    {/* Süre Seçimi */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Süre</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BAN_PRESETS.map((p) => (
                          <button key={p.minutes} onClick={() => setBanDuration(p.minutes)}
                            className="py-2 rounded-xl text-xs font-bold transition-all"
                            style={banDuration === p.minutes
                              ? { background: '#f97316', color: '#fff' }
                              : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                            {p.label}
                          </button>
                        ))}
                        <button onClick={() => setBanDuration(-1)}
                          className="col-span-3 py-2 rounded-xl text-xs font-bold transition-all"
                          style={banDuration === -1
                            ? { background: '#f97316', color: '#fff' }
                            : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                          Özel Süre
                        </button>
                        <button onClick={() => setBanDuration(-2)}
                          className="col-span-3 py-2 rounded-xl text-xs font-bold transition-all"
                          style={banDuration === -2
                            ? { background: '#dc2626', color: '#fff' }
                            : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                          Kalıcı Ban
                        </button>
                      </div>
                      {banDuration === -1 && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number" min={1} max={43200}
                            value={banCustomMin}
                            onChange={(e) => setBanCustomMin(parseInt(e.target.value) || 60)}
                            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
                          <span className="text-xs" style={{ color: C.muted }}>dakika</span>
                        </div>
                      )}
                    </div>

                    {/* Sebep */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Sebep (zorunlu)</p>
                      <textarea
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Ban sebebini açıklayın..."
                        rows={2}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                        style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
                    </div>

                    {/* Uygula Butonu */}
                    {!confirmBan ? (
                      <button
                        onClick={() => { if (!banReason.trim()) { showToast('Sebep boş olamaz', true); return; } setConfirmBan(true); }}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                        style={{ background: '#f97316' }}>
                        🚫 Ban Uygula
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl space-y-3"
                        style={{ background: '#f9731610', border: '1.5px solid #f9731640' }}>
                        <p className="text-sm font-bold" style={{ color: '#f97316' }}>
                          ⚠ Emin misiniz?
                        </p>
                        <p className="text-xs" style={{ color: C.muted }}>
                          {user.name} {user.surname} adlı kullanıcıya{' '}
                          <strong style={{ color: banDuration === -2 ? '#dc2626' : '#f97316' }}>
                            {banDuration === -2
                              ? 'kalıcı ban'
                              : banDuration === -1
                                ? `${banCustomMin} dakika`
                                : BAN_PRESETS.find((p) => p.minutes === banDuration)?.label}
                          </strong>{' '}
                          uygulanacak.
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmBan(false)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold"
                            style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                            İptal
                          </button>
                          <button onClick={handleBan} disabled={saving}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                            style={{ background: '#f97316' }}>
                            {saving ? '…' : 'Evet, Ban Uygula'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Hesap Durumu ──────────────────────────────────── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                <div className="px-4 py-2.5" style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Hesap Durumu</p>
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold" style={{ color: C.text }}>
                      {user.isActive ? '✅ Hesap Aktif' : '⛔ Hesap Askıda'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {user.isActive
                        ? 'Kullanıcı uygulamaya giriş yapabilir'
                        : 'Kullanıcı uygulamaya giriş yapamaz'}
                    </p>
                  </div>
                  {!isSA && (
                    <button
                      onClick={handleToggleActive}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex-shrink-0"
                      style={user.isActive
                        ? { background: '#f8717118', border: `1px solid #f8717130`, color: '#f87171' }
                        : { background: '#34d39918', border: `1px solid #34d39930`, color: '#34d399' }}>
                      {saving ? '…' : user.isActive ? 'Askıya Al' : 'Aktifleştir'}
                    </button>
                  )}
                </div>
              </div>

              {/* Bilgi kutusu */}
              <div className="p-4 rounded-2xl space-y-3"
                style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>Sistem Notları</p>
                {[
                  { icon: '🚫', text: 'Ban uygulanan kullanıcıya anlık push bildirimi gönderilir ve mobil uygulama kısıtlanır.' },
                  { icon: '⏱', text: 'Ban süresi dolduğunda kullanıcı erişimi otomatik olarak yeniden açılır.' },
                  { icon: '📊', text: 'Kullanıcı aktivitesi audit log\'larında takip edilmektedir.' },
                ].map((note) => (
                  <div key={note.text} className="flex items-start gap-2.5">
                    <span className="text-base flex-shrink-0 mt-0.5">{note.icon}</span>
                    <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Kullanıcı Kartı ──────────────────────────────────────────────────────────
function KullaniciKart({
  user, onClick, C,
}: {
  user: User;
  onClick: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const rm = ROLE_META[user.role];
  const joinedDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
  const isBanned = user.isPermanentBan || (user.bannedUntil ? new Date(user.bannedUntil) > new Date() : false);

  return (
    <div
      onClick={onClick}
      className="group overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: C.card,
        border: isBanned ? '1.5px solid #f9731650' : `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: isBanned ? '0 0 0 2px #f9731615' : '0 1px 4px rgba(0,0,0,0.05)',
      }}>

      {/* Rol rengi üst şerit */}
      <div className="h-1" style={{ background: isBanned ? '#f97316' : rm.color }} />

      <div className="p-4">
        {/* Başlık */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
            style={{ background: rm.color }}>
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: C.text }}>
              {user.name} {user.surname}
            </p>
            <p className="text-[11px] truncate mt-0.5" style={{ color: C.muted }}>{user.email}</p>
          </div>
          {/* Aktif/Pasif nokta */}
          <span className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
            style={{ background: user.isActive ? '#34d399' : '#f87171' }} />
        </div>

        {/* Rol badge + ban */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5"
              style={{ background: `${rm.color}14`, color: rm.color }}>
              <span>{rm.icon}</span>
              {rm.label}
            </span>
            {isBanned && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                style={{ background: '#f9731618', color: '#f97316' }}>🚫 Banlı</span>
            )}
          </div>
          <span className="text-[10px]" style={{ color: C.muted }}>
            {joinedDays < 1 ? 'Bugün' : joinedDays < 30 ? `${joinedDays}g` : joinedDays < 365 ? `${Math.floor(joinedDays / 30)}ay` : `${Math.floor(joinedDays / 365)}y`}
          </span>
        </div>

        {/* Market bilgisi (MARKET_MANAGER için) */}
        {user.role === 'MARKET_MANAGER' && user.managedMarket && (
          <div className="mt-2.5 pt-2.5 flex items-center gap-1.5"
            style={{ borderTop: `1px solid ${C.border}` }}>
            <span className="text-xs">🏪</span>
            <span className="text-xs font-medium truncate" style={{ color: C.secondary }}>
              {user.managedMarket.name}
            </span>
          </div>
        )}

        {/* Hover: Detaylar ok */}
        <div className="mt-2.5 pt-2.5 flex items-center justify-between"
          style={{ borderTop: `1px solid ${C.border}` }}>
          <span className="text-[10px] font-semibold" style={{ color: C.muted }}>
            {user.phone ?? 'Tel yok'}
          </span>
          <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
            style={{ color: rm.color }}>
            Detay →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const C = useColors();
  const [data,          setData]          = useState<PaginatedResponse<User> | null>(null);
  const [userStats,     setUserStats]     = useState<{ total: number; active: number; inactive: number; roles: Record<string, number> } | null>(null);
  const [markets,       setMarkets]       = useState<Market[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter,    setRoleFilter]    = useState<UserRole | ''>('');
  const [page,          setPage]          = useState(1);
  const [selectedUser,  setSelectedUser]  = useState<User | null>(null);
  const [viewMode,      setViewMode]      = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await usersApi.getAll({
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        page, limit: 24,
      });
      setData(result);
    } catch { /**/ }
    finally { setLoading(false); }
  }, [debouncedSearch, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    marketsApi.getAll().then(setMarkets).catch(() => {});
    usersApi.getStats().then(setUserStats).catch(() => {});
  }, []);

  const handleRefresh = () => {
    fetchUsers();
    // Drawer'daki kullanıcıyı güncelle
    if (selectedUser) {
      usersApi.getAll({ search: selectedUser.email, limit: 1 })
        .then((res) => { if (res.items[0]) setSelectedUser(res.items[0] as User); })
        .catch(() => {});
    }
  };

  const items = data?.items ?? [];

  // Rol sayaçları — API'den (tüm veritabanı, sayfa bazlı değil)
  const activeCount = userStats?.active ?? 0;
  const inactiveCount = userStats?.inactive ?? 0;

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {/* ── Komut Başlığı ───────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}>

        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.blue }}>
              Kullanıcı Yönetim Merkezi
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Kullanıcılar</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Grid / Liste */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {(['grid', 'list'] as const).map((m) => (
                <button key={m} onClick={() => setViewMode(m)}
                  className="px-3 py-2 text-xs font-bold transition-all"
                  style={viewMode === m
                    ? { background: C.blue, color: '#fff' }
                    : { background: C.card, color: C.secondary }}>
                  {m === 'grid' ? '⊞' : '≡'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rol dağılımı şeridi */}
        <div className="grid grid-cols-3 sm:grid-cols-5"
          style={{ borderTop: `1px solid ${C.border}` }}>
          {(Object.keys(ROLE_META) as UserRole[]).map((r, i) => {
            const rm2  = ROLE_META[r];
            const cnt  = userStats?.roles?.[r] ?? 0;
            return (
              <button key={r} onClick={() => { setRoleFilter(roleFilter === r ? '' : r); setPage(1); }}
                className="px-4 py-3 flex items-center gap-2.5 transition-all"
                style={{
                  borderLeft: i > 0 ? `1px solid ${C.border}` : undefined,
                  background: roleFilter === r ? `${rm2.color}12` : 'transparent',
                  borderBottom: roleFilter === r ? `2px solid ${rm2.color}` : '2px solid transparent',
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${rm2.color}18` }}>
                  {rm2.icon}
                </div>
                <div className="min-w-0">
                  {!userStats ? (
                    <div className="h-4 w-8 rounded animate-pulse mb-0.5" style={{ background: `${rm2.color}30` }} />
                  ) : (
                    <p className="text-base font-black tabular-nums leading-none" style={{ color: rm2.color }}>{cnt.toLocaleString('tr-TR')}</p>
                  )}
                  <p className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: C.muted }}>
                    {rm2.label.split(' ')[0]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Arama + filtre */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-3"
          style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
          <div className="relative flex-1 min-w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, soyad veya e-posta ara…"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
          </div>
          {/* Aktif/Pasif hızlı filtre */}
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.muted }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#34d399' }} />
            {activeCount.toLocaleString('tr-TR')} aktif
            <span className="mx-1" style={{ color: C.border }}>·</span>
            <span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
            {inactiveCount.toLocaleString('tr-TR')} pasif
          </div>
          {roleFilter && (
            <button onClick={() => setRoleFilter('')}
              className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
              style={{ background: `${ROLE_META[roleFilter].color}18`, color: ROLE_META[roleFilter].color, border: `1px solid ${ROLE_META[roleFilter].color}30` }}>
              {ROLE_META[roleFilter].icon} {ROLE_META[roleFilter].label}
              <span className="ml-1 opacity-70">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Kullanıcı Grid/Liste ─────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }} />
        </div>
      ) : items.length === 0 ? (
        <div className="fp-card py-20 text-center">
          <p className="text-5xl mb-4">👥</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>
            {search || roleFilter ? 'Eşleşen kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((u) => (
            <KullaniciKart key={u.id} user={u as User} onClick={() => setSelectedUser(u as User)} C={C} />
          ))}
        </div>
      ) : (
        /* Liste görünümü */
        <div className="rounded-2xl overflow-hidden"
          style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <table className="w-full">
            <thead style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
              <tr>
                {['Kullanıcı', 'Rol', 'Telefon', 'Durum', 'Kayıt', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest"
                    style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u, i) => {
                const rm2 = ROLE_META[u.role as UserRole];
                return (
                  <tr key={u.id}
                    onClick={() => setSelectedUser(u as User)}
                    className="cursor-pointer transition-all hover:brightness-95"
                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ background: rm2.color }}>
                          {u.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: C.text }}>
                            {u.name} {u.surname}
                          </p>
                          <p className="text-xs" style={{ color: C.muted }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
                        style={{ background: `${rm2.color}14`, color: rm2.color }}>
                        {rm2.icon} {rm2.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.secondary }}>{u.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: u.isActive ? '#34d399' : '#f87171' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: u.isActive ? '#34d399' : '#f87171' }} />
                        {u.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: C.muted }}>
                      {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold" style={{ color: rm2.color }}>Detay →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Sayfalama */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${C.border}` }}>
              <p className="text-xs" style={{ color: C.muted }}>
                {data.total.toLocaleString('tr-TR')} kullanıcı · Sayfa {page}/{data.totalPages}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 transition-all"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  ← Önceki
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30 text-white transition-all"
                  style={{ background: C.blue }}>
                  Sonraki →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid görünümde sayfalama */}
      {viewMode === 'grid' && data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: C.muted }}>
            {data.total.toLocaleString('tr-TR')} kullanıcı · Sayfa {page}/{data.totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 transition-all"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
              ← Önceki
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-30 text-white transition-all"
              style={{ background: C.blue }}>
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/* Kullanıcı Drawer */}
      {selectedUser && (
        <KullaniciDrawer
          user={selectedUser}
          markets={markets}
          onClose={() => setSelectedUser(null)}
          onRefresh={handleRefresh}
          C={C}
        />
      )}
    </div>
  );
}
