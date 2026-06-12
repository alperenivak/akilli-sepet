'use client';

import { useState, useEffect, useCallback } from 'react';
import { submissionsApi } from '../../../lib/api';
import { useColors } from '../../../context/ThemeContext';

type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface SubmissionStats {
  needsReview: number;
  queued: number;
  autoApproved: number;
  provisionalPrices: number;
}

interface PriceSubmission {
  id: string;
  amount: number;
  note?: string | null;
  status: SubmissionStatus;
  isAbnormal: boolean;
  adminNote?: string | null;
  processingLabel?: string;
  priceId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
    brand?: string | null;
  };
  market: {
    id: string;
    name: string;
    logoUrl?: string | null;
  };
  user?: {
    id: string;
    name: string;
    surname: string;
    email: string;
    reputationScore: number;
    reputationLevel?: string;
    reputationIcon?: string;
  } | null;
  reviewedBy?: { id: string; name: string } | null;
}

interface SubmissionsResponse {
  items: PriceSubmission[];
  total: number;
  page: number;
  limit: number;
  stats?: SubmissionStats;
}

type ViewMode = 'REVIEW' | 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_META: Record<SubmissionStatus, { label: string; colorKey: 'amber' | 'green' | 'red' }> = {
  PENDING:  { label: 'Beklemede',  colorKey: 'amber' },
  APPROVED: { label: 'Onaylandı',  colorKey: 'green' },
  REJECTED: { label: 'Reddedildi', colorKey: 'red' },
};

function formatPrice(kurus: number) {
  return `₺${(kurus / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusStyle(status: SubmissionStatus, C: ReturnType<typeof useColors>) {
  const key = STATUS_META[status].colorKey;
  const color = C[key];
  return { background: `${color}18`, color, border: `1px solid ${color}30` };
}

function ReviewModal({
  reviewModal,
  adminNote,
  setAdminNote,
  reviewing,
  onClose,
  onConfirm,
  C,
}: {
  reviewModal: { submission: PriceSubmission; decision: 'APPROVED' | 'REJECTED' };
  adminNote: string;
  setAdminNote: (v: string) => void;
  reviewing: boolean;
  onClose: () => void;
  onConfirm: () => void;
  C: ReturnType<typeof useColors>;
}) {
  const isApprove = reviewModal.decision === 'APPROVED';
  const accent = isApprove ? C.green : C.red;
  const sub = reviewModal.submission;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inp: React.CSSProperties = {
    background: C.cardAlt, border: `1px solid ${C.border}`, color: C.text,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              {isApprove ? 'Onay İşlemi' : 'Ret İşlemi'}
            </p>
            <h2 className="text-lg font-bold mt-0.5" style={{ color: C.text }}>
              {isApprove ? 'Bildirimi Onayla' : 'Bildirimi Reddet'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all hover:opacity-80"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl p-4" style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>
            <p className="font-bold text-sm" style={{ color: C.text }}>{sub.product.name}</p>
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              {sub.market.name} · <span className="font-bold" style={{ color: C.text }}>{formatPrice(sub.amount)}</span>
            </p>
            {sub.user && (
              <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: C.muted }}>
                {sub.user.reputationIcon && <span>{sub.user.reputationIcon}</span>}
                {sub.user.name} {sub.user.surname} · {sub.user.reputationScore.toFixed(2)} itibar
              </p>
            )}
          </div>

          {sub.isAbnormal && (
            <div className="rounded-xl p-3" style={{ background: `${C.red}12`, border: `1px solid ${C.red}30` }}>
              <p className="text-xs font-bold" style={{ color: C.red }}>⚠️ Anormal Fiyat</p>
              <p className="text-xs mt-1" style={{ color: C.secondary }}>
                Migros referansına göre anormal aralıkta. Onaylamadan önce doğrulayın.
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: C.muted }}>
              Admin Notu (opsiyonel)
            </label>
            <textarea
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-400/40"
              style={inp}
              rows={3}
              placeholder="Kabul / ret sebebi…"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
            İptal
          </button>
          <button type="button" onClick={onConfirm} disabled={reviewing}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: accent }}>
            {reviewing ? 'İşleniyor…' : isApprove ? 'Onayla' : 'Reddet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubmissionsPage() {
  const C = useColors();
  const [submissions, setSubmissions] = useState<PriceSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('REVIEW');
  const [stats, setStats] = useState<SubmissionStats | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    submission: PriceSubmission;
    decision: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const limit = 20;

  const showToast = (msg: string, err = false) => {
    setToast(err ? `❌ ${msg}` : `✓ ${msg}`);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (viewMode === 'REVIEW') params.needsReview = true;
      else if (viewMode !== 'ALL') params.status = viewMode;

      const data: SubmissionsResponse = await submissionsApi.list(params as Parameters<typeof submissionsApi.list>[0]);
      setSubmissions(data.items ?? []);
      setTotal(data.total ?? 0);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Bildirimler yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [page, viewMode]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const openReview = (submission: PriceSubmission, decision: 'APPROVED' | 'REJECTED') => {
    setReviewModal({ submission, decision });
    setAdminNote('');
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    setReviewing(true);
    try {
      await submissionsApi.review(reviewModal.submission.id, reviewModal.decision, adminNote || undefined);
      setReviewModal(null);
      showToast(reviewModal.decision === 'APPROVED' ? 'Bildirim onaylandı' : 'Bildirim reddedildi');
      fetchSubmissions();
    } catch (err) {
      console.error('İnceleme hatası:', err);
      showToast('İşlem başarısız oldu', true);
    } finally {
      setReviewing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const TABS: { key: ViewMode; label: string; icon: string; count?: number }[] = [
    { key: 'REVIEW', label: 'İnceleme Gereken', icon: '🔴', count: stats?.needsReview },
    { key: 'ALL', label: 'Tümü', icon: '📋' },
    { key: 'PENDING', label: 'Beklemede', icon: '⏳' },
    { key: 'APPROVED', label: 'Onaylandı', icon: '✅' },
    { key: 'REJECTED', label: 'Reddedildi', icon: '❌' },
  ];

  return (
    <div style={{ color: C.text, maxWidth: 1400 }} className="space-y-5">

      {toast && (
        <div className="fixed top-5 right-5 z-[60] px-4 py-3 rounded-xl text-sm font-bold shadow-lg"
          style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }}>
          {toast}
        </div>
      )}

      {/* Komut başlığı */}
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.cyan }}>
              Crowdsource Pipeline
            </p>
            <h1 className="text-2xl font-bold" style={{ color: C.text }}>Fiyat Bildirimleri</h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: C.muted }}>
              Otomatik pipeline çoğu bildirimi işler. Yalnızca anormal fiyatlar manuel inceleme bekler.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums" style={{ color: C.blue }}>{total}</p>
            <p className="text-[10px] font-semibold" style={{ color: C.muted }}>Listelenen kayıt</p>
          </div>
        </div>

        {/* Metrik şeridi */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderTop: `1px solid ${C.border}` }}>
            {[
              { label: 'İnceleme Gerekli', value: stats.needsReview, color: C.red, icon: '🔴' },
              { label: 'Konsensus Kuyruğu', value: stats.queued, color: C.amber, icon: '⏳' },
              { label: 'Otomatik Onay', value: stats.autoApproved, color: C.green, icon: '⚡' },
              { label: 'Geçici Fiyat', value: stats.provisionalPrices, color: C.blue, icon: '📊' },
            ].map((s, i) => (
              <div key={s.label} className="px-5 py-4 flex items-center gap-3"
                style={{ borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="text-xl font-black tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[10px] font-semibold mt-1" style={{ color: C.muted }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline bilgi */}
        <div className="px-6 py-3 space-y-1 text-xs" style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt, color: C.secondary }}>
          <p><strong style={{ color: C.text }}>Otomatik akış:</strong> Güvenilir kullanıcı → anında onay · Konsensus → ağırlıklı onay · Normal → geçici yansıtma</p>
          <p><strong style={{ color: C.text }}>Koruma:</strong> Anormal fiyatlar admin kuyruğuna düşer · Doğrulama oyları itibar skorunu günceller</p>
        </div>

        {/* Sekmeler */}
        <div className="px-4 py-2 flex gap-1 flex-wrap" style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}>
          {TABS.map((t) => (
            <button key={t.key}
              onClick={() => { setViewMode(t.key); setPage(1); }}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              style={viewMode === t.key
                ? { background: C.card, color: C.text, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: C.muted }}>
              <span>{t.icon}</span>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black"
                  style={{ background: `${C.red}20`, color: C.red }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${C.blue}20`, borderTopColor: C.blue }} />
        </div>
      ) : submissions.length === 0 ? (
        <div className="fp-card py-20 text-center">
          <p className="text-5xl mb-4">📭</p>
          <p className="font-bold text-lg" style={{ color: C.secondary }}>Gösterilecek bildirim yok</p>
          <p className="text-sm mt-2" style={{ color: C.muted }}>
            {viewMode === 'REVIEW' ? 'İnceleme bekleyen bildirim bulunmuyor — pipeline sorunsuz çalışıyor' : 'Bu filtrede kayıt yok'}
          </p>
        </div>
      ) : (
        <div className="fp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.cardAlt, borderBottom: `1px solid ${C.border}` }}>
                  {['Ürün', 'Market', 'Fiyat', 'Kullanıcı', 'Pipeline', 'Durum', 'Tarih', 'İşlem'].map((h) => (
                    <th key={h}
                      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${h === 'Fiyat' || h === 'İşlem' ? 'text-right' : 'text-left'}`}
                      style={{ color: C.muted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="transition-all hover:brightness-[1.02]"
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: sub.isAbnormal ? `${C.red}08` : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {sub.product.imageUrl ? (
                          <img src={sub.product.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0"
                            style={{ border: `1px solid ${C.border}` }} />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
                            style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}>📦</div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs truncate max-w-[180px]" style={{ color: C.text }}>
                            {sub.product.name}
                          </p>
                          {sub.product.brand && (
                            <p className="text-[10px] truncate" style={{ color: C.muted }}>{sub.product.brand}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sub.market.logoUrl ? (
                          <img src={sub.market.logoUrl} alt="" className="w-5 h-5 rounded object-contain" />
                        ) : null}
                        <span className="text-xs font-bold" style={{ color: C.text }}>{sub.market.name}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <p className="font-black tabular-nums" style={{ color: C.text }}>{formatPrice(sub.amount)}</p>
                      {sub.isAbnormal && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-1"
                          style={{ background: `${C.red}18`, color: C.red }}>
                          ⚠️ Anormal
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {sub.user ? (
                        <div>
                          <p className="text-xs font-semibold" style={{ color: C.text }}>
                            {sub.user.name} {sub.user.surname}
                          </p>
                          <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: C.muted }}>
                            {sub.user.reputationIcon && <span>{sub.user.reputationIcon}</span>}
                            <span className="font-bold" style={{ color: C.secondary }}>
                              {sub.user.reputationLevel ?? 'Yeni Üye'}
                            </span>
                            · {sub.user.reputationScore.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: C.muted }}>Anonim</span>
                      )}
                      {sub.note && (
                        <p className="text-[10px] mt-0.5 italic max-w-[130px] truncate" style={{ color: C.muted }}
                          title={sub.note}>
                          &ldquo;{sub.note}&rdquo;
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[10px] leading-tight block max-w-[130px]" style={{ color: C.muted }}>
                        {sub.processingLabel ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={statusStyle(sub.status, C)}>
                        {STATUS_META[sub.status].label}
                      </span>
                      {sub.reviewedBy && (
                        <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                          {sub.reviewedBy.name}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: C.muted }}>
                      {formatDate(sub.createdAt)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {sub.status === 'PENDING' ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => openReview(sub, 'APPROVED')} title="Onayla"
                            className="w-8 h-8 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
                            style={{ background: C.green }}>
                            ✓
                          </button>
                          <button onClick={() => openReview(sub, 'REJECTED')} title="Reddet"
                            className="w-8 h-8 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110"
                            style={{ background: C.red }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px]" style={{ color: C.muted }}>
                          {sub.reviewedAt ? formatDate(sub.reviewedAt) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 transition-all"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
            ← Önceki
          </button>
          <span className="text-xs font-bold tabular-nums px-3 py-2 rounded-xl"
            style={{ background: C.cardAlt, color: C.muted }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 transition-all"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.secondary }}>
            Sonraki →
          </button>
        </div>
      )}

      {reviewModal && (
        <ReviewModal
          reviewModal={reviewModal}
          adminNote={adminNote}
          setAdminNote={setAdminNote}
          reviewing={reviewing}
          onClose={() => setReviewModal(null)}
          onConfirm={handleReview}
          C={C}
        />
      )}
    </div>
  );
}
