'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../lib/api';
import { UserRole } from '../types';

type Step = 'select' | 'login';
type PortalId = 'admin' | 'inspector' | 'market';

interface Portal {
  id: PortalId;
  label: string;
  subtitle: string;
  desc: string;
  icon: string;
  color: string;
  allowedRoles: UserRole[];
}

const DEMO_CREDENTIALS: Record<'admin' | 'inspector', { email: string; password: string }> = {
  admin: { email: 'admin@marketapp.com', password: 'Admin123!' },
  inspector: { email: 'denetci@marketapp.com', password: 'Admin123!' },
};

/** Seed ile uyumlu market yönetici demo hesapları */
const MARKET_DEMO_MANAGERS = [
  { id: 'migros', name: 'Migros', email: 'yonetici@migros.com', password: 'yonetici123' },
  { id: 'a101', name: 'A101', email: 'yonetici@a101.com', password: 'yonetici123' },
  { id: 'bim', name: 'BİM', email: 'yonetici@bim.com', password: 'yonetici123' },
  { id: 'sok', name: 'Şok Market', email: 'yonetici@sokmarket.com', password: 'yonetici123' },
  { id: 'carrefoursa', name: 'CarrefourSA', email: 'yonetici@carrefoursa.com', password: 'yonetici123' },
  { id: 'macrocenter', name: 'Macrocenter', email: 'yonetici@macrocenter.com', password: 'yonetici123' },
] as const;

const PORTALS: Portal[] = [
  {
    id: 'admin',
    label: 'Sistem Yönetim Paneli',
    subtitle: 'Sistem Yöneticisi',
    desc: 'Tüm sistemi yönetin. Marketler, kullanıcılar, raporlar ve istatistikler.',
    icon: '🖥️',
    color: '#3B82F6',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'inspector',
    label: 'Denetçi Paneli',
    subtitle: 'Denetçi',
    desc: 'İhbarları inceleyin, durum güncelleyin ve kullanıcılara geri bildirim verin.',
    icon: '🔍',
    color: '#F59E0B',
    allowedRoles: ['INSPECTOR'],
  },
  {
    id: 'market',
    label: 'Market Yönetici Paneli',
    subtitle: 'Market Yönetim Paneli',
    desc: 'Marketinize ait ihbarları, ürün kataloglarını, fiyatları ve şubeleri yönetin.',
    icon: '🏪',
    color: '#10B981',
    allowedRoles: ['MARKET_MANAGER'],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('select');
  const [selectedPortal, setSelectedPortal] = useState<Portal | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMarketDemo, setSelectedMarketDemo] = useState<string>(MARKET_DEMO_MANAGERS[0].id);

  // Sayfa açılınca eski oturum verilerini temizle — stale token yönlendirmesin
  useEffect(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_portal');
  }, []);

  const handlePortalSelect = (portal: Portal) => {
    setSelectedPortal(portal);
    setError('');
    setStep('login');
  };

  const handleBack = () => {
    setStep('select');
    setError('');
    setEmail('');
    setPassword('');
    setSelectedMarketDemo(MARKET_DEMO_MANAGERS[0].id);
  };

  const fillMarketDemo = () => {
    const mgr = MARKET_DEMO_MANAGERS.find((m) => m.id === selectedMarketDemo);
    if (!mgr) return;
    setEmail(mgr.email);
    setPassword(mgr.password);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortal) return;
    setLoading(true);
    setError('');

    try {
      const data = await authApi.login(email, password);
      const role: UserRole = data.user.role;

      if (!selectedPortal.allowedRoles.includes(role)) {
        setError('Bu portala erişim yetkiniz bulunmuyor. Lütfen doğru paneli seçin veya geri dönün.');
        setLoading(false);
        return;
      }

      // Yalnızca doğru rol onaylandıktan sonra kaydet ve yönlendir
      localStorage.setItem('admin_token', data.accessToken);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      localStorage.setItem('admin_portal', selectedPortal.id);

      if (selectedPortal.id === 'admin') router.push('/dashboard');
      else if (selectedPortal.id === 'inspector') router.push('/inspector-panel/dashboard');
      else router.push('/market-panel/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        typeof msg === 'string'
          ? msg
          : 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080d1a] p-4 relative overflow-hidden">

      {/* Arka plan ışık efektleri */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-700/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-700/8 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-900/10 rounded-full blur-[100px]" />
        {/* Izgara deseni */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* ── ADIM 1: PORTAL SEÇİMİ ── */}
      {step === 'select' && (
        <div className="relative z-10 w-full max-w-4xl">

          {/* Logo & Başlık */}
          <div className="text-center mb-12">
            <div className="relative inline-block mb-5">
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center overflow-hidden">
                <img src="/logo-outline.png" alt="Akıllı Sepet" className="w-[120%] h-[120%] object-contain scale-125" style={{ mixBlendMode: 'screen' }} />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-3xl blur opacity-20 -z-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Akıllı Sepet</h1>
            <p className="text-gray-400 mt-2 text-base">Yönetim Sistemine Hoş Geldiniz</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-gray-700" />
              <p className="text-gray-600 text-xs font-medium px-3">Hangi paneli kullanacağınızı seçin</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-gray-700" />
            </div>
          </div>

          {/* Portal Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                onClick={() => handlePortalSelect(portal)}
                className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.025] hover:shadow-2xl"
                style={{
                  backgroundColor: '#0f172a',
                  border: `1px solid #1e293b`,
                  '--hover-border': portal.color + '60',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = portal.color + '60';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 20px 60px ${portal.color}20`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e293b';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                }}
              >
                {/* Gradient glow arka plan */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at top left, ${portal.color}15, transparent 65%)` }}
                />

                {/* Üst dekoratif çizgi */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${portal.color}, transparent)` }}
                />

                {/* İkon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{ backgroundColor: portal.color + '18', border: `1px solid ${portal.color}35` }}
                >
                  {portal.icon}
                </div>

                {/* İçerik */}
                <p className="text-xs font-bold tracking-widest mb-1.5 uppercase" style={{ color: portal.color }}>
                  {portal.subtitle}
                </p>
                <h3 className="text-white font-bold text-lg mb-2.5 leading-snug">{portal.label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{portal.desc}</p>

                {/* Alt buton efekti */}
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-sm font-semibold transition-all duration-300" style={{ color: portal.color }}>
                    Giriş Yap
                  </span>
                  <span
                    className="text-sm font-bold transition-transform duration-300 group-hover:translate-x-1"
                    style={{ color: portal.color }}
                  >
                    →
                  </span>
                </div>

                {/* Sağ alt büyük ikonla süsleme */}
                <div className="absolute bottom-4 right-4 text-6xl opacity-[0.04] group-hover:opacity-[0.07] transition-opacity select-none pointer-events-none">
                  {portal.icon}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ADIM 2: GİRİŞ FORMU ── */}
      {step === 'login' && selectedPortal && (
        <div className="relative z-10 w-full max-w-sm">

          {/* Geri */}
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-300 text-sm mb-8 transition-colors group"
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            Panel seçimine dön
          </button>

          {/* Seçili portal rozeti */}
          <div className="flex items-center gap-3 mb-8 p-3 rounded-2xl" style={{ backgroundColor: selectedPortal.color + '12', border: `1px solid ${selectedPortal.color}30` }}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: selectedPortal.color + '20', border: `1px solid ${selectedPortal.color}40` }}
            >
              {selectedPortal.icon}
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide" style={{ color: selectedPortal.color }}>{selectedPortal.subtitle}</p>
              <h2 className="text-white font-bold text-base leading-tight">{selectedPortal.label}</h2>
            </div>
          </div>

          {/* Demo giriş — yalnızca giriş adımında */}
          {selectedPortal.id === 'market' ? (
            <div
              className="mb-5 p-4 rounded-xl"
              style={{
                backgroundColor: selectedPortal.color + '20',
                border: `1px solid ${selectedPortal.color}`,
              }}
            >
              <p
                className="text-[11px] font-black uppercase tracking-widest mb-3"
                style={{ color: selectedPortal.color }}
              >
                Demo Giriş
              </p>
              <label className="block text-xs text-gray-400 mb-1.5">Market seç</label>
              <select
                value={selectedMarketDemo}
                onChange={(e) => setSelectedMarketDemo(e.target.value)}
                className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none"
                style={{ borderColor: selectedPortal.color + '50' }}
              >
                {MARKET_DEMO_MANAGERS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {(() => {
                const mgr = MARKET_DEMO_MANAGERS.find((m) => m.id === selectedMarketDemo);
                if (!mgr) return null;
                return (
                  <>
                    <p className="text-sm text-white leading-relaxed">
                      <span className="text-gray-400">E-posta:</span>{' '}
                      <span className="font-semibold">{mgr.email}</span>
                    </p>
                    <p className="text-sm text-white leading-relaxed mt-1">
                      <span className="text-gray-400">Şifre:</span>{' '}
                      <span className="font-semibold">{mgr.password}</span>
                    </p>
                  </>
                );
              })()}
              <button
                type="button"
                onClick={fillMarketDemo}
                className="mt-3 w-full py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: selectedPortal.color + '30',
                  color: selectedPortal.color,
                  border: `1px solid ${selectedPortal.color}60`,
                }}
              >
                Demo bilgilerini doldur
              </button>
            </div>
          ) : selectedPortal.id in DEMO_CREDENTIALS ? (
            <div
              className="mb-5 p-4 rounded-xl"
              style={{
                backgroundColor: selectedPortal.color + '20',
                border: `1px solid ${selectedPortal.color}`,
              }}
            >
              <p
                className="text-[11px] font-black uppercase tracking-widest mb-2"
                style={{ color: selectedPortal.color }}
              >
                Demo Giriş
              </p>
              <p className="text-sm text-white leading-relaxed">
                <span className="text-gray-400">E-posta:</span>{' '}
                <span className="font-semibold">{DEMO_CREDENTIALS[selectedPortal.id as 'admin' | 'inspector'].email}</span>
              </p>
              <p className="text-sm text-white leading-relaxed mt-1">
                <span className="text-gray-400">Şifre:</span>{' '}
                <span className="font-semibold">{DEMO_CREDENTIALS[selectedPortal.id as 'admin' | 'inspector'].password}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  const demo = DEMO_CREDENTIALS[selectedPortal.id as 'admin' | 'inspector'];
                  setEmail(demo.email);
                  setPassword(demo.password);
                }}
                className="mt-3 w-full py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: selectedPortal.color + '30',
                  color: selectedPortal.color,
                  border: `1px solid ${selectedPortal.color}60`,
                }}
              >
                Demo bilgilerini doldur
              </button>
            </div>
          ) : null}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-950/60 border border-red-700/50 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInvalid={(e) => {
                  const el = e.target as HTMLInputElement;
                  if (el.validity.valueMissing) el.setCustomValidity('Lütfen e-posta adresinizi girin.');
                  else if (el.validity.typeMismatch) el.setCustomValidity('Geçerli bir e-posta adresi girin.');
                  else el.setCustomValidity('');
                }}
                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                onFocus={(e) => (e.target.style.borderColor = selectedPortal.color + '80')}
                onBlur={(e) => (e.target.style.borderColor = '#334155')}
                className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors placeholder-gray-600"
                placeholder="ornek@Akıllı Sepet.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInvalid={(e) => {
                    const el = e.target as HTMLInputElement;
                    if (el.validity.valueMissing) el.setCustomValidity('Lütfen şifrenizi girin.');
                    else el.setCustomValidity('');
                  }}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  onFocus={(e) => (e.target.style.borderColor = selectedPortal.color + '80')}
                  onBlur={(e) => (e.target.style.borderColor = '#334155')}
                  className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none transition-colors placeholder-gray-600"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="text-right">
              <a
                href="/forgot-password"
                className="text-xs font-semibold hover:underline"
                style={{ color: selectedPortal.color }}
              >
                Şifremi unuttum
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 mt-2 relative overflow-hidden group"
              style={{
                backgroundColor: selectedPortal.color,
                boxShadow: `0 8px 30px ${selectedPortal.color}45`,
              }}
            >
              <span className="relative z-10">
                {loading ? '⏳ Giriş Yapılıyor...' : 'Giriş Yap →'}
              </span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </form>
        </div>
      )}

      {/* Versiyon */}
      <p className="absolute bottom-4 right-5 text-gray-700 text-xs select-none">
        Akıllı Sepet Admin v1.0.0
      </p>
    </div>
  );
}
