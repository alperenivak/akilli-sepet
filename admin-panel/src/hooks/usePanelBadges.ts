'use client';

import { useState, useEffect, useCallback } from 'react';
import { reportsApi, marketPanelApi } from '../lib/api';

export function useInspectorBadges() {
  const [badges, setBadges] = useState({ pending: 0, inReview: 0, urgent: 0 });
  const refresh = useCallback(async () => {
    try {
      const [pendingRes, reviewRes] = await Promise.all([
        reportsApi.getAll({ status: 'PENDING', limit: 50 }),
        reportsApi.getAll({ status: 'UNDER_REVIEW', limit: 1 }),
      ]);
      const urgent = (pendingRes.items ?? []).filter((r) => {
        if (!r.expiryDate) return false;
        return new Date(r.expiryDate).getTime() - Date.now() < 7 * 86400000;
      }).length;
      setBadges({
        pending: pendingRes.total,
        inReview: reviewRes.total,
        urgent,
      });
    } catch { /* sessiz */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { ...badges, refresh };
}

export function useMarketBadges(marketId: string | null) {
  const [badges, setBadges] = useState({ pending: 0, inReview: 0, total: 0 });
  const refresh = useCallback(async () => {
    if (!marketId) return;
    try {
      const [pendingRes, reviewRes, allRes] = await Promise.all([
        marketPanelApi.getReports(marketId, { status: 'PENDING', limit: 1 }),
        marketPanelApi.getReports(marketId, { status: 'UNDER_REVIEW', limit: 1 }),
        marketPanelApi.getReports(marketId, { limit: 1 }),
      ]);
      setBadges({
        pending: pendingRes.total ?? 0,
        inReview: reviewRes.total ?? 0,
        total: allRes.total ?? 0,
      });
    } catch { /* sessiz */ }
  }, [marketId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { ...badges, refresh };
}
