'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useColors } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { useInspectorBadges } from '../hooks/usePanelBadges';

const NAV_ITEMS = [
  { href: '/inspector-panel/dashboard',  label: 'Genel Bakış',    icon: '🎯', desc: 'Özet ve vaka kuyruğu' },
  { href: '/inspector-panel/statistics', label: 'İstatistikler',  icon: '📈', desc: 'Performans & metrikler' },
  { href: '/inspector-panel/reports',    label: 'Bekleyen İhbarlar', icon: '📥', desc: 'İnceleme kuyruğu' },
  { href: '/inspector-panel/in-review',  label: 'İncelemede',     icon: '🔍', desc: 'Üzerinde çalışılanlar' },
  { href: '/inspector-panel/resolved',   label: 'Tamamlananlar',  icon: '✅', desc: 'Onaylanan & reddedilen' },
];

const ACCENT = '#F59E0B'; // amber

function NavBadge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
      style={{ background: color, color: '#fff' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function InspectorSidebar() {
  const pathname = usePathname();
  const C = useColors();
  const { pending, inReview, urgent } = useInspectorBadges();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const badgeFor = (href: string) => {
    if (href.includes('/reports')) return pending;
    if (href.includes('/in-review')) return inReview;
    return 0;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (raw) {
        const u = JSON.parse(raw);
        setUserName(u.name ?? 'Denetçi');
        setUserEmail(u.email ?? '');
      }
    } catch { /* localStorage bozuksa sessizce atla */ }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_portal');
    window.location.href = '/';
  };

  return (
    <aside className="w-60 min-h-screen flex flex-col flex-shrink-0" style={{ background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}` }}>
      {/* Başlık */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0">
            <img src="/logo-outline.png" alt="Akıllı Sepet" className="w-full h-full object-contain scale-125" style={{ mixBlendMode: 'screen' }} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">Denetçi Paneli</p>
            <p className="text-amber-400/70 text-xs">Akıllı Sepet</p>
          </div>
        </div>

        {/* Kullanıcı */}
        <div className="mt-4 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: ACCENT }}
          >
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{userName}</p>
            <p className="text-gray-400 text-xs truncate">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive ? 'text-white' : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              style={isActive ? { backgroundColor: ACCENT + '22' } : {}}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 transition-all ${isActive ? 'bg-white/10' : 'group-hover:bg-white/5'}`}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.label}</p>
              </div>
              <NavBadge count={badgeFor(item.href)} color={item.href.includes('/reports') && urgent > 0 ? '#ef4444' : ACCENT} />
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCENT }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alt */}
      <div className="px-3 py-4 space-y-2" style={{ borderTop: `1px solid ${C.sidebarBorder}` }}>
        <ThemeToggle />
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={(e) => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(239,68,68,0.12)', color: '#f87171' }); }}
          onMouseLeave={(e) => { Object.assign((e.currentTarget as HTMLElement).style, { background: 'transparent', color: 'rgba(255,255,255,0.4)' }); }}>
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base">🚪</span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
}
