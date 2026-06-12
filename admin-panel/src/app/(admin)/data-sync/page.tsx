'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { dataSyncApi, adminApi } from '../../../lib/api';
import { useColors } from '../../../context/ThemeContext';
import {
  AdminToast, PageHero, TabBar, StatusDot, EmptyState, LoadingCenter, ProgressBar,
} from '../../../components/admin/AdminUIKit';

interface ProviderStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  message: string;
}

interface SyncLog {
  id: string;
  jobType: string;
  provider: string;
  status: string;
  recordsTotal: number;
  recordsSuccess: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
}

interface SyncStatus {
  cronEnabled: boolean;
  externalProvidersEnabled: boolean;
  providers: ProviderStatus[];
  stats: {
    totalPrices: number;
    staleOrUnverified: number;
    negativeFeedbackLast30d: number;
  };
  message: string;
}

interface DataQuality {
  products: {
    total: number;
    active: number;
    withoutImage: number;
    withoutPrice: number;
    imageCoveragePct: number;
    priceCoveragePct: number;
  };
  categoryMismatchCount: number;
  scraper: { failuresLast24h: number };
}

type TabKey = 'overview' | 'import' | 'maintenance' | 'logs';

function parseCsv(text: string): Array<{ barcode: string; marketSlug: string; amount: number }> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const items: Array<{ barcode: string; marketSlug: string; amount: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && /barkod|barcode|market/i.test(line) && !/^\d/.test(line)) continue;
    const parts = line.includes(';') ? line.split(';') : line.split(',');
    if (parts.length < 3) continue;
    const barcode = parts[0].trim().replace(/"/g, '');
    const marketSlug = parts[1].trim().replace(/"/g, '');
    const priceRaw = parts[2].trim().replace(/"/g, '').replace(',', '.');
    const priceNum = parseFloat(priceRaw);
    if (!barcode || !marketSlug || Number.isNaN(priceNum) || priceNum <= 0) continue;
    const amount = priceRaw.includes('.') && priceNum < 1000
      ? Math.round(priceNum * 100)
      : Math.round(priceNum);
    items.push({ barcode, marketSlug, amount });
  }
  return items;
}

function logStatusStyle(status: string, C: ReturnType<typeof useColors>) {
  if (status === 'success') return { bg: `${C.green}18`, color: C.green, label: 'Başarılı' };
  if (status === 'failed' || status === 'error') return { bg: `${C.red}18`, color: C.red, label: 'Hata' };
  return { bg: `${C.amber}18`, color: C.amber, label: status };
}

export default function DataSyncPage() {
  const C = useColors();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [maintaining, setMaintaining] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedPreview = useMemo(() => parseCsv(csvText), [csvText]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, lg, dq] = await Promise.all([
        dataSyncApi.getStatus(),
        dataSyncApi.getLogs(1, 20),
        adminApi.getDataQuality().catch(() => null),
      ]);
      setStatus(st);
      setLogs(lg?.items ?? []);
      setQuality(dq);
    } catch {
      showToast('Veri altyapısı yüklenemedi', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImport = async () => {
    if (parsedPreview.length === 0) {
      showToast('Geçerli CSV satırı bulunamadı', true);
      return;
    }
    setImporting(true);
    try {
      const res = await dataSyncApi.importPricesByBarcode(parsedPreview);
      showToast(`${res.processed} fiyat yüklendi · ${res.failed} hata`);
      setCsvText('');
      load();
    } catch {
      showToast('Import başarısız', true);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const runMaintenance = async (type: 'stale' | 'catalog') => {
    setMaintaining(type);
    try {
      if (type === 'stale') await dataSyncApi.runStaleCheck();
      else await dataSyncApi.runCatalogExpire();
      showToast(type === 'stale' ? 'Eski fiyatlar işaretlendi' : 'Süresi dolan kataloglar kapatıldı');
      load();
    } catch {
      showToast('Bakım işlemi başarısız', true);
    } finally {
      setMaintaining(null);
    }
  };

  const providerDot = (p: ProviderStatus): 'ok' | 'warn' | 'off' | 'error' => {
    if (p.ready) return 'ok';
    if (p.enabled) return 'warn';
    return 'off';
  };

  if (loading && !status) return <LoadingCenter />;

  return (
    <div className="space-y-6 max-w-6xl" style={{ color: C.text }}>
      {toast && <AdminToast message={toast.msg} error={toast.err} />}

      <PageHero
        badge="Veri Operasyon Merkezi"
        title="Veri Yönetimi"
        subtitle="Fiyat import, veri kalitesi izleme, scraper durumu ve sistem bakımı — tek panelden yönetin."
        gradient="linear-gradient(135deg, #0f172a 0%, #1e40af 45%, #0891b2 100%)"
        actions={(
          <button
            type="button"
            onClick={load}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white/90 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            ↻ Yenile
          </button>
        )}
        metrics={[
          { label: 'Aktif Fiyat', value: status?.stats.totalPrices ?? '—', icon: '💰' },
          { label: 'Doğrulama Bekleyen', value: status?.stats.staleOrUnverified ?? '—', icon: '⏳' },
          { label: 'Görsel Kapsamı', value: quality ? `%${quality.products.imageCoveragePct}` : '—', icon: '🖼️' },
          { label: 'Scraper Hata (24s)', value: quality?.scraper.failuresLast24h ?? '—', icon: '⚙️' },
        ]}
      />

      <TabBar<TabKey>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Genel Bakış', icon: '📊' },
          { key: 'import', label: 'CSV Import', icon: '📥', count: parsedPreview.length || undefined },
          { key: 'maintenance', label: 'Bakım', icon: '🔧' },
          { key: 'logs', label: 'İşlem Geçmişi', icon: '📋', count: logs.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Veri kalitesi */}
          <section className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
              <h2 className="text-sm font-bold">Ürün Veri Kalitesi</h2>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>Görsel, fiyat ve kategori tutarlılığı</p>
            </div>
            <div className="p-5 space-y-4">
              {quality ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: C.muted }}>Görsel kapsamı</span>
                      <span className="font-bold" style={{ color: C.green }}>%{quality.products.imageCoveragePct}</span>
                    </div>
                    <ProgressBar value={quality.products.imageCoveragePct} max={100} color={C.green} />
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                      {quality.products.withoutImage} ürün görsel eksik
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: C.muted }}>Fiyat kapsamı</span>
                      <span className="font-bold" style={{ color: C.blue }}>%{quality.products.priceCoveragePct}</span>
                    </div>
                    <ProgressBar value={quality.products.priceCoveragePct} max={100} color={C.blue} />
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                      {quality.products.withoutPrice} aktif ürün fiyatsız
                    </p>
                  </div>
                  {quality.categoryMismatchCount > 0 && (
                    <div className="rounded-xl p-3 flex items-start gap-3" style={{ background: `${C.amber}12`, border: `1px solid ${C.amber}30` }}>
                      <span>⚠️</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: C.amber }}>
                          ~{quality.categoryMismatchCount} olası kategori uyumsuzluğu
                        </p>
                        <Link href="/products" className="text-[10px] font-semibold underline mt-1 inline-block" style={{ color: C.blue }}>
                          Ürün yönetiminde incele →
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: C.muted }}>Kalite verisi alınamadı</p>
              )}
            </div>
          </section>

          {/* Kaynaklar + sistem */}
          <section className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="px-5 py-4 flex justify-between items-center" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
              <div>
                <h2 className="text-sm font-bold">Veri Kaynakları</h2>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  Cron: {status?.cronEnabled ? 'Açık' : 'Kapalı'} · Harici API: {status?.externalProvidersEnabled ? 'Açık' : 'Kapalı'}
                </p>
              </div>
              <Link href="/catalogs" className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: `${C.purple}15`, color: C.purple }}>
                Kataloglar →
              </Link>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {status?.providers.map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: C.bg }}>
                  <StatusDot status={providerDot(p)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{p.description}</p>
                    <p className="text-[10px] mt-1 font-medium" style={{ color: p.ready ? C.green : C.muted }}>{p.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Hızlı istatistik */}
          <section
            className="lg:col-span-2 rounded-2xl p-5 grid sm:grid-cols-3 gap-4"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            {[
              { label: 'Olumsuz geri bildirim (30g)', value: status?.stats.negativeFeedbackLast30d ?? 0, color: C.red, hint: 'Fiyat doğrulama' },
              { label: 'Aktif ürün', value: quality?.products.active ?? '—', color: C.blue, hint: 'Katalogda' },
              { label: 'Sistem mesajı', value: status?.message ? '✓' : '—', color: C.green, hint: status?.message?.slice(0, 40) ?? '' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: C.cardAlt }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{s.label}</p>
                <p className="text-2xl font-black mt-2 tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] mt-1 truncate" style={{ color: C.muted }}>{s.hint}</p>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'import' && (
        <section className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
            <h2 className="text-sm font-bold">Toplu Fiyat Import</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              Format: <code className="px-1 rounded" style={{ background: C.bg }}>barkod,market_slug,fiyat</code> — örn. <code className="px-1 rounded" style={{ background: C.bg }}>8690552000001,migros,24.99</code>
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div
              className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all hover:brightness-[1.02]"
              style={{ borderColor: `${C.blue}40`, background: `${C.blue}08` }}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm font-bold">CSV dosyası sürükleyin veya tıklayın</p>
              <p className="text-xs mt-1" style={{ color: C.muted }}>.csv veya .txt</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={'barkod,market_slug,fiyat\n8690552000001,migros,24.99'}
              className="w-full rounded-xl border p-4 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400/30"
              style={{ background: C.bg, borderColor: C.border, color: C.text }}
            />

            {parsedPreview.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: `${C.green}10`, border: `1px solid ${C.green}30` }}>
                <p className="text-xs font-bold" style={{ color: C.green }}>
                  ✓ {parsedPreview.length} satır hazır — ilk 3 önizleme:
                </p>
                <pre className="text-[10px] mt-2 font-mono overflow-x-auto" style={{ color: C.muted }}>
                  {parsedPreview.slice(0, 3).map((r) => `${r.barcode} → ${r.marketSlug} → ${(r.amount / 100).toFixed(2)} TL`).join('\n')}
                </pre>
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsedPreview.length === 0}
              className="w-full py-3.5 rounded-xl text-sm font-black text-white disabled:opacity-40 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
            >
              {importing ? 'Yükleniyor…' : `${parsedPreview.length || 0} Fiyatı İçe Aktar`}
            </button>
          </div>
        </section>
      )}

      {tab === 'maintenance' && (
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              id: 'stale' as const,
              icon: '⏳',
              title: 'Eski Fiyatları İşaretle',
              desc: 'Belirli süredir güncellenmeyen fiyatları doğrulama bekliyor olarak işaretler.',
              color: C.amber,
            },
            {
              id: 'catalog' as const,
              icon: '📕',
              title: 'Süresi Dolan Katalogları Kapat',
              desc: 'Bitiş tarihi geçmiş aktif katalogları otomatik pasife alır.',
              color: C.purple,
            },
          ].map((job) => (
            <div key={job.id} className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{job.icon}</span>
                <div>
                  <h3 className="font-bold">{job.title}</h3>
                  <p className="text-xs mt-1" style={{ color: C.muted }}>{job.desc}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => runMaintenance(job.id)}
                disabled={maintaining !== null}
                className="mt-auto py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: `${job.color}15`, color: job.color, border: `1px solid ${job.color}35` }}
              >
                {maintaining === job.id ? 'Çalışıyor…' : 'Şimdi Çalıştır'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <section className="space-y-3">
          {logs.length === 0 ? (
            <EmptyState icon="📋" title="Henüz işlem kaydı yok" subtitle="Import veya bakım çalıştırdığınızda burada görünür." />
          ) : (
            logs.map((log) => {
              const st = logStatusStyle(log.status, C);
              const duration = log.completedAt
                ? `${Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}sn`
                : '—';
              return (
                <div
                  key={log.id}
                  className="rounded-xl p-4 flex flex-wrap items-center gap-4"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}
                >
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-lg" style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-bold">{log.jobType}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>{log.provider} · {duration}</p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <p className="font-bold" style={{ color: C.green }}>{log.recordsSuccess}/{log.recordsTotal} başarılı</p>
                    {log.recordsFailed > 0 && (
                      <p style={{ color: C.red }}>{log.recordsFailed} hata</p>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                      {new Date(log.startedAt).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
