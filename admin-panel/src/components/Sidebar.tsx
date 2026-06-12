'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useColors } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Kontrol Merkezi', icon: '🎯', desc: 'Sistem özeti' },
  { href: '/statistics', label: 'İstatistikler',   icon: '📈', desc: 'Raporlar & analitik' },
  { href: '/products',   label: 'Ürünler',          icon: '📦', desc: 'Ürün kataloğu' },
  { href: '/markets',    label: 'Marketler',         icon: '🏪', desc: 'Marketler & şubeler' },
  { href: '/reports',    label: 'İhbarlar',          icon: '⚠️', desc: 'İhbar merkezi' },
  { href: '/users',      label: 'Kullanıcılar',      icon: '👥', desc: 'Hesap yönetimi' },
  { href: '/data-sync',   label: 'Veri Yönetimi',     icon: '🔄', desc: 'Import & veri kalitesi' },
  { href: '/submissions', label: 'Fiyat Bildirimleri', icon: '💬', desc: 'Crowdsource onay kuyruğu' },
  { href: '/rewards', label: 'Topluluk Ödülleri', icon: '🎁', desc: 'İtibar kuponları' },
  { href: '/catalogs', label: 'Aktüel Kataloglar', icon: '📰', desc: 'Haftalık kampanya katalogları' },
];

const ACCENT = '#60a5fa';

export function Sidebar() {
  const pathname = usePathname();
  const C = useColors();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_portal');
    window.location.href = '/';
  };

  return (
    <aside
      className="w-60 min-h-screen flex flex-col flex-shrink-0"
      style={{ background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}` }}
    >
      {/* Logo */}
      <div className="px-4 py-5" style={{ borderBottom: `1px solid ${C.sidebarBorder}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0">
            <img src="/logo-outline.png" alt="Akıllı Sepet" className="w-full h-full object-contain scale-125"
              style={{ mixBlendMode: 'screen' }} />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Akıllı Sepet</p>
            <p className="text-xs mt-1 font-medium" style={{ color: ACCENT }}>Yönetici Paneli</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              style={isActive
                ? { background: `${ACCENT}20`, color: '#fff' }
                : { color: 'rgba(255,255,255,0.55)' }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 transition-all"
                style={isActive ? { background: 'rgba(255,255,255,0.12)' } : {}}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                  {item.label}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.desc}</p>
              </div>
              {isActive && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />}
            </Link>
          );
        })}
      </nav>

      {/* Alt */}
      <div className="px-3 py-4 space-y-2" style={{ borderTop: `1px solid ${C.sidebarBorder}` }}>
        <ThemeToggle />
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={(e) => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(239,68,68,0.12)', color: '#f87171' }); }}
          onMouseLeave={(e) => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'transparent', color: 'rgba(255,255,255,0.4)' }); }}>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base">🚪</span>
          <span className="font-medium">Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
}
