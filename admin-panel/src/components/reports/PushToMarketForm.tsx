'use client';

import { useState, useEffect } from 'react';
import { marketsApi, reportsApi } from '../../lib/api';
import { Market, Report } from '../../types';

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
}

interface Props {
  report: Report;
  accentColor?: string;
  onSuccess: (updated: Report) => void;
}

export default function PushToMarketForm({ report, accentColor = '#F59E0B', onSuccess }: Props) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [marketId, setMarketId] = useState(report.market?.id ?? '');
  const [branchId, setBranchId] = useState(report.branch?.id ?? '');
  const [pushNote, setPushNote] = useState('');
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState('');

  const alreadyPushed = !!report.pushedToMarketAt;

  useEffect(() => {
    marketsApi.getAll()
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoadingMarkets(false));
  }, []);

  useEffect(() => {
    if (!marketId) {
      setBranches([]);
      setBranchId('');
      return;
    }
    marketsApi.getBranches(marketId)
      .then((list) => setBranches(Array.isArray(list) ? list : []))
      .catch(() => setBranches([]));
  }, [marketId]);

  const handlePush = async () => {
    if (!marketId) {
      setError('Lütfen bir market seçin');
      return;
    }
    setError('');
    setPushing(true);
    try {
      const updated = await reportsApi.pushToMarket(report.id, {
        marketId,
        branchId: branchId || undefined,
        marketNote: pushNote.trim() || undefined,
      });
      onSuccess(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Markete iletilemedi');
    } finally {
      setPushing(false);
    }
  };

  if (alreadyPushed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-xs font-bold text-green-700 mb-1">✓ Markete İletildi</p>
        <p className="text-sm text-green-900 font-semibold">{report.market?.name ?? '—'}</p>
        {report.branch && (
          <p className="text-xs text-green-700 mt-0.5">Şube: {report.branch.name}</p>
        )}
        {report.pushedBy && (
          <p className="text-xs text-green-600 mt-1">
            İleten: {report.pushedBy.name} {report.pushedBy.surname ?? ''} ·{' '}
            {report.pushedToMarketAt
              ? new Date(report.pushedToMarketAt).toLocaleString('tr-TR')
              : ''}
          </p>
        )}
        {report.marketNote && (
          <p className="text-xs text-green-800 mt-2 bg-white/60 rounded-lg px-2 py-1.5">
            <strong>Market notu:</strong> {report.marketNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-indigo-900">🏪 Markete İlet</p>
        <p className="text-xs text-indigo-700 mt-0.5">
          İhbarı ilgili market yöneticilerine iletin. Bildirim otomatik gönderilir.
        </p>
        {report.marketNameOther && (
          <p className="text-xs text-indigo-800 mt-2 bg-white/60 rounded-lg px-2 py-1.5">
            Kullanıcı yazdı: <strong>{report.marketNameOther}</strong>
          </p>
        )}
        {report.market && !report.marketNameOther && (
          <p className="text-xs text-indigo-800 mt-2">
            Bildirilen market: <strong>{report.market.name}</strong>
          </p>
        )}
      </div>

      {loadingMarkets ? (
        <p className="text-xs text-indigo-600">Marketler yükleniyor…</p>
      ) : (
        <>
          <div>
            <label className="block text-xs font-bold text-indigo-800 mb-1">Market *</label>
            <select
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
              value={marketId}
              onChange={(e) => { setMarketId(e.target.value); setBranchId(''); }}
            >
              <option value="">Market seçin…</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {branches.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-indigo-800 mb-1">Şube (opsiyonel)</label>
              <select
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">Şube seçmeyin</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.city ? ` — ${b.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-indigo-800 mb-1">Market yöneticisine not</label>
            <p className="text-[10px] text-indigo-600 mb-1">Bu not yalnızca market panelinde görünür; kullanıcıya iletilmez.</p>
            <textarea
              className="w-full border border-indigo-200 rounded-lg p-2 text-sm bg-white resize-none"
              rows={2}
              placeholder="Market yöneticisine özel talimat veya açıklama…"
              value={pushNote}
              onChange={(e) => setPushNote(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="button"
            onClick={handlePush}
            disabled={pushing || !marketId}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: accentColor }}
          >
            {pushing ? '⏳ İletiliyor…' : '📤 Market Yöneticisine İlet'}
          </button>
        </>
      )}
    </div>
  );
}
