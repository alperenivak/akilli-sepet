'use client';

import { useColors } from '../../context/ThemeContext';

const INSPECTOR_STEPS = [
  { icon: '📥', title: 'Kuyruğu Tara', desc: 'SKT acil ve fotoğraflı ihbarlara öncelik verin' },
  { icon: '🔍', title: 'İncelemeye Al', desc: 'Geçerli vakayı inceleme durumuna çekin' },
  { icon: '📤', title: 'Markete İlet', desc: 'Market notu ekleyerek yöneticiye push edin' },
  { icon: '✅', title: 'Sonuçlandır', desc: 'Onay/red verin; kullanıcıya ayrı yanıt notu yazın' },
];

const MARKET_STEPS = [
  { icon: '⚠️', title: 'İhbarı İncele', desc: 'Denetçi notu, SKT ve kanıt fotoğraflarını okuyun' },
  { icon: '🏪', title: 'Saha Kontrolü', desc: 'İlgili şubede ürünü ve rafı doğrulayın' },
  { icon: '💬', title: 'Yanıt Verin', desc: 'Durum güncelleyin; kullanıcıya not iletin' },
  { icon: '🏁', title: 'Kapatın', desc: 'Sorun giderildiyse çözüldü olarak işaretleyin' },
];

export function WorkflowGuide({ variant }: { variant: 'inspector' | 'market' }) {
  const C = useColors();
  const steps = variant === 'inspector' ? INSPECTOR_STEPS : MARKET_STEPS;
  const accent = variant === 'inspector' ? C.amber : (C.blue);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: accent }}>
        İş Akışı Rehberi
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, i) => (
          <div key={step.title} className="relative">
            <div
              className="rounded-xl p-3 h-full"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                  style={{ background: accent }}
                >
                  {i + 1}
                </span>
                <span className="text-base">{step.icon}</span>
              </div>
              <p className="text-xs font-bold" style={{ color: C.text }}>{step.title}</p>
              <p className="text-[10px] mt-1 leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <span
                className="hidden lg:block absolute top-1/2 -right-2 text-xs -translate-y-1/2 z-10"
                style={{ color: C.muted }}
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
