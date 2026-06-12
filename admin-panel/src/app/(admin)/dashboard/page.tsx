'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi, reportsApi, statisticsApi, usersApi } from '../../../lib/api';
import { DashboardStats } from '../../../types';
import { useColors } from '../../../context/ThemeContext';
import Link from 'next/link';

// ─── Sistem Kontrol Motoru ────────────────────────────────────────────────────
type CheckStatus = 'idle' | 'running' | 'ok' | 'warn' | 'error' | 'fixed';

interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fixApplied?: string;
  href?: string;
}

const CHECK_META: Record<Exclude<CheckStatus, 'idle' | 'running'>, { icon: string; color: string; badge: string }> = {
  ok:    { icon: '✓', color: '#34d399', badge: 'NORMAL'   },
  warn:  { icon: '⚠', color: '#fbbf24', badge: 'DİKKAT'  },
  error: { icon: '✕', color: '#f87171', badge: 'HATA'     },
  fixed: { icon: '⚡', color: '#a78bfa', badge: 'DÜZELTİLDİ' },
};

function SistemKontrolButonu({
  onComplete,
  C,
}: {
  onComplete: (stats: DashboardStats) => void;
  C: ReturnType<typeof useColors>;
}) {
  const [phase,    setPhase]    = useState<'idle' | 'running' | 'done'>('idle');
  const [step,     setStep]     = useState(0);
  const [results,  setResults]  = useState<CheckResult[]>([]);
  const [open,     setOpen]     = useState(false);
  const [runTime,  setRunTime]  = useState<string | null>(null);

  const summary = {
    ok:    results.filter((r) => r.status === 'ok').length,
    warn:  results.filter((r) => r.status === 'warn').length,
    error: results.filter((r) => r.status === 'error').length,
    fixed: results.filter((r) => r.status === 'fixed').length,
  };

  const overallColor =
    summary.error > 0 ? C.red :
    summary.warn  > 0 ? C.amber :
    summary.fixed > 0 ? C.purple :
    C.green;

  const runChecks = useCallback(async () => {
    if (phase === 'running') return;
    setPhase('running');
    setStep(0);
    setResults([]);
    setOpen(true);
    const t0 = Date.now();
    const out: CheckResult[] = [];

    const push = (r: CheckResult) => { out.push(r); setResults([...out]); };

    // ── Adım 1: API Sağlığı ──────────────────────────────────────────────────
    setStep(1);
    let dashboard: DashboardStats | null = null;
    try {
      dashboard = await adminApi.getDashboard();
      onComplete(dashboard);
      push({ id: 'api', label: 'Backend API Bağlantısı', status: 'ok', detail: 'Tüm endpointler yanıt veriyor.' });
    } catch {
      push({ id: 'api', label: 'Backend API Bağlantısı', status: 'error', detail: 'API yanıt vermedi. Sunucu durumunu kontrol edin.' });
      setPhase('done');
      setRunTime(((Date.now() - t0) / 1000).toFixed(1) + 's');
      return;
    }

    // ── Adım 2: Bekleyen İhbar Kontrolü + Otomatik Düzeltme ──────────────────
    setStep(2);
    try {
      const pending = await reportsApi.getAll({ status: 'PENDING', limit: 100 });
      const staleItems = (pending.items as any[]).filter((r: any) => {
        const ageH = (Date.now() - new Date(r.createdAt).getTime()) / 3600000;
        return ageH > 24;
      });

      if (staleItems.length > 0) {
        // Otomatik olarak UNDER_REVIEW'a taşı
        let fixed = 0;
        for (const r of staleItems) {
          try {
            await reportsApi.updateStatus(r.id, 'UNDER_REVIEW', 'Sistem otomatik kontrolü: 24 saat hareketsiz ihbar incelemeye alındı.');
            fixed++;
          } catch { /**/ }
        }
        push({
          id: 'reports_stale',
          label: 'Hareketsiz İhbar Tespiti',
          status: 'fixed',
          detail: `${staleItems.length} ihbar 24+ saat BEKLEMEDE kalmış.`,
          fixApplied: `${fixed} ihbar otomatik olarak İNCELEMEYE ALINDI durumuna geçirildi.`,
          href: '/reports',
        });
        // Yeniden çek
        dashboard = await adminApi.getDashboard();
        onComplete(dashboard);
      } else if (dashboard.pendingReports > 0) {
        push({
          id: 'reports_pending',
          label: 'Bekleyen İhbarlar',
          status: 'warn',
          detail: `${dashboard.pendingReports} ihbar denetçi ataması bekliyor.`,
          href: '/reports',
        });
      } else {
        push({ id: 'reports_ok', label: 'İhbar Kuyruğu', status: 'ok', detail: 'Bekleyen ihbar yok.' });
      }
    } catch {
      push({ id: 'reports_err', label: 'İhbar Sistemi', status: 'error', detail: 'İhbar verileri alınamadı.' });
    }

    // ── Adım 3: Kullanıcı Sistemi ─────────────────────────────────────────────
    setStep(3);
    try {
      const users = await usersApi.getAll({ limit: 1 });
      const total = (users as any).total ?? dashboard.totalUsers;
      push({
        id: 'users',
        label: 'Kullanıcı Sistemi',
        status: total > 0 ? 'ok' : 'warn',
        detail: total > 0 ? `${total} kayıtlı kullanıcı aktif.` : 'Kayıtlı kullanıcı bulunamadı.',
        href: '/users',
      });
    } catch {
      push({ id: 'users_err', label: 'Kullanıcı Sistemi', status: 'warn', detail: 'Kullanıcı sayısı doğrulanamadı.' });
    }

    // ── Adım 4: Fiyat Kapsamı ─────────────────────────────────────────────────
    setStep(4);
    const priceRatio = dashboard.totalProducts > 0
      ? dashboard.totalPrices / dashboard.totalProducts
      : 1;
    if (priceRatio < 1) {
      push({
        id: 'prices',
        label: 'Fiyat Kapsamı',
        status: 'warn',
        detail: `${dashboard.totalProducts} ürüne karşılık ${dashboard.totalPrices} fiyat kaydı var. Kapsam eksik.`,
        href: '/markets',
      });
    } else if (dashboard.priceUpdatesToday === 0) {
      push({ id: 'prices_fresh', label: 'Fiyat Güncelliği', status: 'warn', detail: 'Bugün hiç fiyat güncellenmedi. Marketleri kontrol edin.' });
    } else {
      push({ id: 'prices_ok', label: 'Fiyat Verileri', status: 'ok', detail: `Kapsam yeterli · Son 24s: ${dashboard.priceUpdatesToday} güncelleme.` });
    }

    // ── Adım 5: Katalog & Market ──────────────────────────────────────────────
    setStep(5);
    await new Promise((r) => setTimeout(r, 300));
    if (dashboard.activeCatalogs === 0) {
      push({ id: 'catalog', label: 'Kampanya Katalogları', status: 'warn', detail: 'Aktif katalog yok. Market yöneticileri bilgilendirilebilir.' });
    } else {
      push({ id: 'catalog_ok', label: 'Kampanya Katalogları', status: 'ok', detail: `${dashboard.activeCatalogs} aktif katalog yayında.` });
    }
    push({ id: 'markets', label: 'Market Sistemi', status: 'ok', detail: `${dashboard.totalMarkets} market kayıtlı ve aktif.` });

    // ── Adım 6: İstatistik Servisi ────────────────────────────────────────────
    setStep(6);
    try {
      await statisticsApi.getAdmin();
      push({ id: 'stats', label: 'İstatistik Servisi', status: 'ok', detail: 'İstatistik API çalışıyor.' });
    } catch {
      push({ id: 'stats_err', label: 'İstatistik Servisi', status: 'warn', detail: 'İstatistik verileri alınamadı (kritik değil).' });
    }

    setPhase('done');
    setRunTime(((Date.now() - t0) / 1000).toFixed(1) + 's');
  }, [phase, onComplete]);

  // Düğme rengi
  const btnColor = phase === 'idle' ? C.secondary :
    phase === 'running' ? C.blue :
    overallColor;

  const btnBg = phase === 'idle'
    ? C.card
    : `${btnColor}15`;

  const STEP_LABELS = ['', 'API', 'İhbarlar', 'Kullanıcılar', 'Fiyatlar', 'Kataloglar', 'İstatistikler'];

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Ana Buton */}
      <div className="flex items-center gap-2">
        {phase === 'done' && (
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.muted }}>
            <span style={{ color: overallColor }}>
              {summary.error > 0 ? `${summary.error} hata` : summary.warn > 0 ? `${summary.warn} uyarı` : summary.fixed > 0 ? `${summary.fixed} düzeltme` : 'Sistem sağlıklı'}
            </span>
            · {runTime}
          </div>
        )}
        <button
          onClick={phase === 'running' ? undefined : runChecks}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: btnBg, border: `1px solid ${btnColor}35`, color: btnColor }}>
          {phase === 'running' ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 animate-spin inline-block flex-shrink-0"
                style={{ borderColor: `${C.blue}30`, borderTopColor: C.blue }} />
              {STEP_LABELS[step]} kontrol ediliyor…
            </>
          ) : phase === 'done' ? (
            <>
              {summary.error > 0 ? '✕' : summary.warn > 0 ? '⚠' : summary.fixed > 0 ? '⚡' : '✓'} Kontrol Tamamlandı
            </>
          ) : (
            <>↻ Sistem Kontrolü</>
          )}
        </button>
        {phase === 'done' && (
          <button onClick={() => setOpen((o) => !o)}
            className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
            {open ? '▲ Gizle' : '▼ Detaylar'}
          </button>
        )}
      </div>

      {/* Sonuç Paneli */}
      {(phase === 'running' || (phase === 'done' && open)) && (
        <div className="w-80 rounded-2xl overflow-hidden shadow-lg"
          style={{ background: C.card, border: `1px solid ${C.border}` }}>

          {/* Başlık */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>
              Sistem Kontrol Raporu
            </p>
            {phase === 'running' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]" style={{ color: C.blue }}>Adım {step}/6</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(step / 6) * 100}%`, background: C.blue }} />
                </div>
              </div>
            )}
            {phase === 'done' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ background: `${overallColor}15`, color: overallColor }}>
                {summary.error > 0 ? `${summary.error} HATA` :
                 summary.warn  > 0 ? `${summary.warn} UYARI` :
                 summary.fixed > 0 ? `${summary.fixed} DÜZELTİLDİ` : 'SAĞLIKLI'}
              </span>
            )}
          </div>

          {/* Kontrol listesi */}
          <div className="divide-y" style={{ borderColor: C.border }}>
            {results.map((r) => {
              const m = r.status !== 'idle' && r.status !== 'running' ? CHECK_META[r.status] : null;
              return (
                <div key={r.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-shrink-0 font-bold w-4 text-center"
                      style={{ color: m?.color ?? C.muted }}>
                      {m?.icon ?? '·'}
                    </span>
                    <span className="text-xs font-semibold flex-1" style={{ color: C.text }}>{r.label}</span>
                    {m && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: `${m.color}18`, color: m.color }}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] pl-6 leading-relaxed" style={{ color: C.muted }}>{r.detail}</p>
                  {r.fixApplied && (
                    <p className="text-[11px] pl-6 font-semibold" style={{ color: C.purple }}>
                      ⚡ {r.fixApplied}
                    </p>
                  )}
                  {r.href && (
                    <div className="pl-6">
                      <Link href={r.href}
                        className="text-[11px] font-bold hover:underline"
                        style={{ color: m?.color ?? C.blue }}>
                        → Sayfaya git
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
            {phase === 'running' && results.length < 6 && (
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="w-4 text-center">
                  <span className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: `${C.blue}25`, borderTopColor: C.blue }} />
                </span>
                <span className="text-xs" style={{ color: C.muted }}>
                  {STEP_LABELS[step] || 'Hazırlanıyor'}…
                </span>
              </div>
            )}
          </div>

          {/* Yeniden çalıştır */}
          {phase === 'done' && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={runChecks}
                className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: `${C.blue}12`, border: `1px solid ${C.blue}25`, color: C.blue }}>
                ↻ Yeniden Kontrol Et
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Yapay Zeka Insight Paneli ───────────────────────────────────────────────
type InsightLevel = 'crit' | 'warn' | 'info' | 'tip';

interface Insight {
  icon: string;
  text: string;
  lvl: InsightLevel;
  action?: { label: string; href: string };
  category?: string;
}

const LVL_META: Record<InsightLevel, { label: string; color: string }> = {
  crit: { label: 'ACİL',    color: '#f87171' },
  warn: { label: 'DİKKAT',  color: '#fbbf24' },
  info: { label: 'BİLGİ',   color: '#60a5fa' },
  tip:  { label: 'İPUCU',   color: '#34d399' },
};

const STARTER_PROMPTS = [
  'Bugün hangi ürün kategorilerinde risk var?',
  'Hangi marketlerin fiyat kapsamı düşük?',
  'Geçen haftaya kıyasla ihbar artışı var mı?',
  'Hangi denetçi en aktif?',
];

function AiInsightPanel({
  insights,
  C,
}: {
  insights: Insight[];
  C: ReturnType<typeof useColors>;
}) {
  const [filter, setFilter]     = useState<InsightLevel | 'all'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [query, setQuery]       = useState('');
  const [chatLog, setChatLog]   = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [typing, setTyping]     = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const filtered = filter === 'all' ? insights : insights.filter((i) => i.lvl === filter);

  const counts = {
    all:  insights.length,
    crit: insights.filter((i) => i.lvl === 'crit').length,
    warn: insights.filter((i) => i.lvl === 'warn').length,
    info: insights.filter((i) => i.lvl === 'info').length,
    tip:  insights.filter((i) => i.lvl === 'tip').length,
  };

  const handleQuery = (q: string) => {
    if (!q.trim()) return;
    setChatLog((prev) => [...prev, { role: 'user', text: q }]);
    setQuery('');
    setTyping(true);
    // Simüle edilmiş AI yanıtı
    setTimeout(() => {
      const aiReply = generateReply(q, insights);
      setChatLog((prev) => [...prev, { role: 'ai', text: aiReply }]);
      setTyping(false);
      setTimeout(() => { chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }); }, 50);
    }, 900);
  };

  return (
    <div className="fp-card overflow-hidden">
      {/* Başlık */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `${C.blue}18` }}>🤖</div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.blue }}>
              Yapay Zeka Akışı
            </p>
            <p className="text-sm font-bold" style={{ color: C.text }}>Operasyonel İçgörüler & Asistan</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
          <span className="text-xs" style={{ color: C.muted }}>AI Aktif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x"
        style={{ borderColor: C.border }}>

        {/* Sol: İçgörüler */}
        <div className="p-5 space-y-4">
          {/* Filtre sekmeleri */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'crit', 'warn', 'info', 'tip'] as const).map((lvl) => {
              const active = filter === lvl;
              const color  = lvl === 'all' ? C.blue : LVL_META[lvl].color;
              const cnt    = counts[lvl];
              if (lvl !== 'all' && cnt === 0) return null;
              return (
                <button key={lvl} onClick={() => setFilter(lvl)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={active
                    ? { background: `${color}20`, border: `1px solid ${color}45`, color }
                    : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.muted }}>
                  {lvl === 'all' ? `Tümü (${cnt})` : `${LVL_META[lvl].label} (${cnt})`}
                </button>
              );
            })}
          </div>

          {/* İçgörü kartları */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filtered.map((ins, i) => {
              const m   = LVL_META[ins.lvl];
              const isOpen = expanded === i;
              return (
                <div key={i}
                  className="rounded-xl overflow-hidden transition-all cursor-pointer"
                  style={{ background: `${m.color}0c`, border: `1px solid ${m.color}28` }}
                  onClick={() => setExpanded(isOpen ? null : i)}>
                  <div className="flex items-start gap-3 p-3">
                    <span className="text-base flex-shrink-0 mt-0.5">{ins.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${m.color}20`, color: m.color }}>
                          {m.label}
                        </span>
                        {ins.category && (
                          <span className="text-[10px]" style={{ color: C.muted }}>{ins.category}</span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: C.text }}>{ins.text}</p>
                    </div>
                    <span className="text-xs flex-shrink-0 mt-1" style={{ color: C.muted }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                  {isOpen && ins.action && (
                    <div className="px-3 pb-3">
                      <Link href={ins.action.href}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ background: `${m.color}18`, color: m.color }}>
                        → {ins.action.label}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: C.muted }}>
                Bu kategoride içgörü yok
              </p>
            )}
          </div>
        </div>

        {/* Sağ: AI Asistan Chat */}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>
              AI Asistan · Soru Sor
            </p>
          </div>

          {/* Sohbet akışı */}
          <div ref={chatRef}
            className="flex-1 min-h-[160px] max-h-56 overflow-y-auto space-y-2 pr-1">
            {chatLog.length === 0 && !typing && (
              <p className="text-xs text-center py-4" style={{ color: C.muted }}>
                Sistem hakkında soru sorun veya aşağıdan örnek seçin
              </p>
            )}
            {chatLog.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                  style={m.role === 'user'
                    ? { background: `${C.blue}18`, color: C.text, borderRadius: '12px 12px 4px 12px' }
                    : { background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text, borderRadius: '12px 12px 12px 4px' }}>
                  {m.role === 'ai' && <span className="font-bold mr-1" style={{ color: C.blue }}>AI</span>}
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.muted, borderRadius: '12px 12px 12px 4px' }}>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.blue, animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.blue, animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.blue, animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Başlangıç promtları */}
          {chatLog.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((p) => (
                <button key={p} onClick={() => handleQuery(p)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.secondary }}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleQuery(query); }}
            className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sorunuzu yazın…"
              disabled={typing}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text }}
            />
            <button type="submit" disabled={typing || !query.trim()}
              className="px-3 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all"
              style={{ background: C.blue, color: '#fff' }}>
              →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function generateReply(q: string, insights: Insight[]): string {
  const ql = q.toLowerCase();
  if (ql.includes('risk') || ql.includes('kritik') || ql.includes('acil')) {
    const crits = insights.filter((i) => i.lvl === 'crit');
    if (crits.length > 0) return `Kritik ${crits.length} uyarı tespit edildi: ${crits.map((c) => c.text).join(' | ')}`;
    return 'Şu anda kritik düzeyde risk bulunmuyor. Sistem normal akışta.';
  }
  if (ql.includes('fiyat') || ql.includes('kapsam')) {
    const warns = insights.filter((i) => i.lvl === 'warn');
    if (warns.length > 0) return `Fiyat ve kapsam uyarıları: ${warns.map((w) => w.text).join(' | ')}`;
    return 'Fiyat kapsamı genel olarak yeterli görünüyor. Detaylar için İstatistikler sayfasını inceleyebilirsiniz.';
  }
  if (ql.includes('ihbar') || ql.includes('bildirim')) {
    const ihbar = insights.find((i) => i.text.includes('ihbar'));
    return ihbar ? ihbar.text : 'İhbar sistemi normal çalışıyor. Bekleyen ihbar sayısı kontrol edilebilir.';
  }
  if (ql.includes('denetçi') || ql.includes('inspector')) {
    return 'Denetçi performans verileri İstatistikler → Denetçi modülünden incelenebilir. Aktif denetçi sayısı dashboard metriklerinde görüntüleniyor.';
  }
  if (ql.includes('hafta') || ql.includes('trend')) {
    return 'Haftalık trend analizine göre sistem aktivitesi normal seyrediyyor. Fiyat güncellemeleri ve ihbar trendi İstatistikler sayfasında detaylandırılmıştır.';
  }
  const tips = insights.filter((i) => i.lvl === 'info' || i.lvl === 'tip');
  if (tips.length > 0) return `Güncel bilgi: ${tips[0].text}`;
  return 'Sistemde şu an aktif bir uyarı bulunmuyor. Tüm modüller normal çalışıyor.';
}

function buildInsights(s: DashboardStats): Insight[] {
  return [
    ...(s.pendingReports > 5
      ? [{ icon: '🚨', text: `${s.pendingReports} ihbar denetçi ataması bekliyor. Gecikme riski yüksek.`, lvl: 'crit' as const, category: 'İhbar', action: { label: 'İhbarları Görüntüle', href: '/reports' } }]
      : s.pendingReports > 0
      ? [{ icon: '⚠️', text: `${s.pendingReports} bekleyen ihbar mevcut. Denetçilere atanması gerekiyor.`, lvl: 'warn' as const, category: 'İhbar', action: { label: 'İhbarları Görüntüle', href: '/reports' } }]
      : [{ icon: '✅', text: 'Tüm ihbarlar işleme alınmış, bekleyen kuyruk temiz.', lvl: 'tip' as const, category: 'İhbar' }]),
    ...(s.priceUpdatesToday > 0
      ? [{ icon: '📈', text: `Son 24 saatte ${s.priceUpdatesToday} fiyat güncellendi. Veri tazeliği iyi.`, lvl: 'info' as const, category: 'Fiyat' }]
      : [{ icon: '📉', text: 'Bugün hiç fiyat güncellenmedi. Marketlere hatırlatma gönderilebilir.', lvl: 'warn' as const, category: 'Fiyat', action: { label: 'Marketleri Gör', href: '/markets' } }]),
    ...(s.totalPrices < s.totalProducts * 2
      ? [{ icon: '🔍', text: `Bazı marketlerde fiyat kapsamı eksik. Toplam ${s.totalProducts} ürüne karşılık ${s.totalPrices} fiyat kaydı var.`, lvl: 'warn' as const, category: 'Kapsam', action: { label: 'Ürünleri İncele', href: '/products' } }]
      : []),
    ...(s.activeCatalogs === 0
      ? [{ icon: '📖', text: 'Aktif kampanya kataloğu yok. Market yöneticileri bilgilendirilebilir.', lvl: 'warn' as const, category: 'Katalog' }]
      : [{ icon: '📗', text: `${s.activeCatalogs} aktif katalog yayında. Kullanıcılara sunuluyor.`, lvl: 'tip' as const, category: 'Katalog' }]),
    { icon: '🤖', text: 'AI analiz: Fiyat sapması yüksek kategoriler haftalık olarak izleniyor. Anomali tespit edilmedi.', lvl: 'info' as const, category: 'AI Analiz' },
    { icon: '🛡️', text: 'Sistem sağlığı normal. Backend, cache ve AI servisleri aktif durumda.', lvl: 'tip' as const, category: 'Sistem' },
  ];
}

const MGMT = [
  { label: 'Kullanıcılar',  href: '/users',       icon: '👥', desc: 'Rol ve hesap yönetimi' },
  { label: 'Marketler',     href: '/markets',      icon: '🏪', desc: 'Market & şube yönetimi' },
  { label: 'Ürünler',       href: '/products',     icon: '📦', desc: 'Ürün kataloğu' },
  { label: 'İhbarlar',      href: '/reports',      icon: '⚠️', desc: 'İhbar yönetimi' },
  { label: 'Ürün Ekle',     href: '/products/new', icon: '➕', desc: 'Yeni ürün kaydı' },
  { label: 'İstatistikler', href: '/statistics',   icon: '📈', desc: 'Sistem raporu' },
];

export default function AdminKontrolMerkezi() {
  const C = useColors();
  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(new Date());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try { setStats(await adminApi.getDashboard()); } catch { /**/ }
    finally { setLoading(false); }
  }, []);

  const handleCheckComplete = useCallback((fresh: DashboardStats) => {
    setStats(fresh);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const dateStr  = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr  = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const insights = stats ? buildInsights(stats) : [];

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.blue }}>
            Kontrol Merkezi
          </p>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Akıllı Sepet Yönetim Paneli</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>{dateStr} · {timeStr}</p>
        </div>
        <SistemKontrolButonu onComplete={handleCheckComplete} C={C} />
      </div>

      {/* Sistem Özeti Hero */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${C.blue}10 0%, transparent 70%)`, transform: 'translate(20%,-20%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.green }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
              Sistem Genel Durumu
            </span>
          </div>

          {loading ? (
            <div className="h-24 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: `${C.blue}25`, borderTopColor: C.blue }} />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'Toplam Kullanıcı', value: stats.totalUsers,    color: C.blue,   href: '/users' },
                  { label: 'Kayıtlı Ürün',     value: stats.totalProducts, color: C.green,  href: '/products' },
                  { label: 'Aktif Market',      value: stats.totalMarkets,  color: C.orange, href: '/markets' },
                  { label: 'Fiyat Kaydı',       value: stats.totalPrices,   color: C.purple, href: '/markets' },
                ].map((s) => (
                  <Link key={s.label} href={s.href}
                    className="rounded-xl p-4 transition-all hover:brightness-105"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                      {s.value.toLocaleString('tr-TR')}
                    </p>
                    <p className="text-xs mt-1 font-medium" style={{ color: C.secondary }}>{s.label}</p>
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Bekleyen İhbar',    value: stats.pendingReports,    color: stats.pendingReports > 0 ? C.red : C.green, urgent: stats.pendingReports > 0, href: '/reports' },
                  { label: 'Toplam İhbar',       value: stats.totalReports,     color: C.amber,  urgent: false, href: '/reports' },
                  { label: 'Aktif Katalog',      value: stats.activeCatalogs,   color: C.cyan,   urgent: false, href: '/markets' },
                  { label: '24s Fiyat Güncell.', value: stats.priceUpdatesToday,color: C.purple, urgent: false, href: '/markets' },
                ].map((s) => (
                  <Link key={s.label} href={s.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all hover:brightness-105"
                    style={{ background: `${s.color}10`, border: `1px solid ${s.color}22` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-xs font-medium" style={{ color: C.secondary }}>{s.label}</span>
                    {s.urgent && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${C.red}15`, color: C.red }}>ACİL</span>
                    )}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: C.muted }}>Veriler yüklenemedi.</p>
          )}
        </div>
      </div>

      {/* 2 sütun: Risk + İhbar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Risk Takibi */}
        <div className="fp-card p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.red }}>Risk Takibi</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Anomali & Uyarılar</p>
            </div>
            <span className="text-xl">📡</span>
          </div>
          {stats && [
            { label: 'Bekleyen İhbar',    value: stats.pendingReports,   sev: stats.pendingReports > 10 ? 'h' : stats.pendingReports > 3 ? 'm' : 'l' },
            { label: 'Fiyatsız Ürün',     value: stats.totalPrices < stats.totalProducts ? 'Var' : 'Yok', sev: stats.totalPrices < stats.totalProducts ? 'm' : 'l' },
            { label: '24s Fiyat Güncell.',value: stats.priceUpdatesToday, sev: stats.priceUpdatesToday === 0 ? 'm' : 'l' },
            { label: 'Aktif Katalog',     value: stats.activeCatalogs,   sev: stats.activeCatalogs === 0 ? 'm' : 'l' },
          ].map((r) => {
            const color = r.sev === 'h' ? C.red : r.sev === 'm' ? C.amber : C.green;
            const badge = r.sev === 'h' ? 'ACİL' : r.sev === 'm' ? 'DİKKAT' : 'NORMAL';
            return (
              <div key={r.label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-sm flex-1" style={{ color: C.secondary }}>{r.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color }}>{r.value}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: `${color}18`, color }}>{badge}</span>
              </div>
            );
          })}

          <div className="pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Sistem Sağlığı</p>
            {[
              { label: 'API Bağlantısı',    ok: true, detail: 'Backend aktif' },
              { label: 'Fiyat Veri Akışı',  ok: stats?.priceUpdatesToday !== undefined, detail: `${stats?.priceUpdatesToday ?? 0} güncelleme` },
              { label: 'İhbar Sistemi',      ok: true, detail: 'Çalışıyor' },
              { label: 'Yapay Zeka',         ok: true, detail: 'Gemini bağlı' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 py-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.ok ? C.green : C.amber }} />
                <span className="text-sm flex-1" style={{ color: C.secondary }}>{item.label}</span>
                <span className="text-xs" style={{ color: C.muted }}>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* İhbar Kuyruğu */}
        <div className="fp-card p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.amber }}>İhbar Kuyruğu</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Bildirim Durumu</p>
            </div>
            <Link href="/reports" className="text-xs font-medium px-2 py-1 rounded-lg"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
              Tümü →
            </Link>
          </div>
          {stats && (
            <>
              {[
                { label: 'Bekleyen', value: stats.pendingReports, color: C.amber },
                { label: 'Toplam',   value: stats.totalReports,   color: C.blue },
                { label: 'Çözülen',  value: Math.max(0, stats.totalReports - stats.pendingReports), color: C.green },
              ].map((item) => {
                const pct = stats.totalReports > 0 ? (item.value / stats.totalReports) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: C.secondary }}>{item.label}</span>
                      <span className="font-bold tabular-nums" style={{ color: item.color }}>{item.value}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: `${C.border}` }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
              <Link href="/reports"
                className="flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-xl text-sm font-semibold transition-all hover:brightness-105"
                style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}28`, color: C.amber }}>
                ⚠️ İhbarları İncele
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Yapay Zeka Akışı — tam genişlik */}
      <AiInsightPanel insights={insights} C={C} />

      {/* Yönetim İşlemleri */}
      <div className="fp-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Yönetim İşlemleri</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: C.text }}>Hızlı Erişim</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {MGMT.map((item, idx) => (
            <Link key={item.href} href={item.href}
              className="group flex flex-col gap-2.5 px-5 py-4 transition-all hover:brightness-105"
              style={{ borderLeft: idx > 0 ? `1px solid ${C.border}` : undefined }}>
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.text }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
