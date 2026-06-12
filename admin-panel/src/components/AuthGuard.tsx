'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/forgot-password'];
const MARKET_PANEL_PREFIX = '/market-panel';
const INSPECTOR_PANEL_PREFIX = '/inspector-panel';
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const INSPECTOR_ROLES = ['INSPECTOR'];
const MARKET_ROLES = ['MARKET_MANAGER', ...ADMIN_ROLES, ...INSPECTOR_ROLES];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [checked, setChecked] = useState(isPublic);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');

    if (!token && !isPublic) {
      router.replace('/');
      return;
    }

    if (token && !isPublic) {
      try {
        const user = JSON.parse(localStorage.getItem('admin_user') ?? '{}');
        const role: string = user.role ?? '';
        const isMarketPanel = pathname.startsWith(MARKET_PANEL_PREFIX);
        const isInspectorPanel = pathname.startsWith(INSPECTOR_PANEL_PREFIX);

        if (isMarketPanel && !MARKET_ROLES.includes(role)) {
          router.replace('/dashboard');
          return;
        }
        if (isInspectorPanel && ![...INSPECTOR_ROLES, ...ADMIN_ROLES].includes(role)) {
          router.replace('/');
          return;
        }
        if (!isMarketPanel && !isInspectorPanel && !ADMIN_ROLES.includes(role)) {
          if (INSPECTOR_ROLES.includes(role)) {
            router.replace('/inspector-panel/dashboard');
          } else {
            router.replace('/market-panel/dashboard');
          }
          return;
        }
      } catch {}
    }

    setChecked(true);
  }, [pathname, router, isPublic]);

  if (!checked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      </div>
    );
  }

  return <>{children}</>;
}
