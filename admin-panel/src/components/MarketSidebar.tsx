'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ManagedMarket } from '../types';
import { useColors } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { useMarketBadges } from '../hooks/usePanelBadges';

const NAV_ITEMS = [
  { href: '/market-panel/dashboard',   label: 'Genel Bakış',    icon: '🎯', desc: 'Performans özeti' },
  { href: '/market-panel/statistics',  label: 'İstatistikler',  icon: '📈', desc: 'Analitik & metrikler' },
  { href: '/market-panel/reports',     label: 'İhbarlar',       icon: '⚠️', desc: 'Gelen bildirimler' },
  { href: '/market-panel/catalog',     label: 'Kataloglar',     icon: '📖', desc: 'Kampanya katalogları' },
  { href: '/market-panel/prices',      label: 'Fiyatlar',       icon: '💰', desc: 'Fiyat yönetimi' },
  { href: '/market-panel/categories',  label: 'Kategoriler',    icon: '🏷️', desc: 'Ürün kategorileme' },
  { href: '/market-panel/branches',    label: 'Şubeler',        icon: '📍', desc: 'Şube yönetimi' },
  { href: '/market-panel/rewards',     label: 'Topluluk Ödülleri', icon: '🎁', desc: 'İtibar kuponları' },
];

export function MarketSidebar() {
  const pathname = usePathname();
  const C = useColors();
  const [market, setMarket] = useState<ManagedMarket | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (raw) {
        const user = JSON.parse(raw);
        setMarket(user.managedMarket ?? null);
      }
    } catch { /* localStorage bozuksa sessizce atla */ }
  }, []);

  const brandColor = market?.brandColor ?? '#3B82F6';
  const { pending } = useMarketBadges(market?.id ?? null);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_portal');
    window.location.href = '/';
  };

  return (
    <aside className="w-60 min-h-screen flex flex-col flex-shrink-0" style={{ background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}` }}>
      {/* Market Başlığı */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg"
            style={{ backgroundColor: brandColor }}
          >
            {market?.logoUrl ? (
              <img src={market.logoUrl} alt="" className="w-7 h-7 object-contain" />
            ) : (
              market?.name.slice(0, 2).toUpperCase() ?? 'M'
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{market?.name ?? 'Market Paneli'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <img src="/logo-outline.png" alt="" className="w-5 h-5 object-contain scale-125" style={{ mixBlendMode: 'screen', opacity: 0.8 }} />
              <p className="text-gray-500 text-xs">Akıllı Sepet</p>
            </div>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              style={isActive ? { background: brandColor + '18' } : {}}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 transition-all ${
                  isActive ? 'bg-white/10' : 'group-hover:bg-white/5'
                }`}
              >
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold">{item.label}</p>
                <p className="truncate text-[10px] text-slate-600">{(item as any).desc}</p>
              </div>
              {item.href.includes('/reports') && pending > 0 && (
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: '#ef4444', color: '#fff' }}
                >
                  {pending > 99 ? '99+' : pending}
                </span>
              )}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: brandColor }} />
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
