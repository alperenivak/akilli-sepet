// =====================================================
// Fiyat Uyarıları — React Query hook'ları
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPriceAlerts,
  createPriceAlert,
  updatePriceAlert,
  deletePriceAlert,
  PriceAlert,
  PriceAlertStatus,
} from '../api/prices';

export const PRICE_ALERTS_KEY = ['price-alerts'] as const;

export function usePriceAlerts(status: PriceAlertStatus = 'all') {
  return useQuery({
    queryKey: [...PRICE_ALERTS_KEY, status],
    queryFn: () => getPriceAlerts({ status }),
    staleTime: 30_000,
  });
}

export function useProductPriceAlert(productId: string, enabled = true) {
  return useQuery({
    queryKey: [...PRICE_ALERTS_KEY, 'product', productId],
    queryFn: () => getPriceAlerts({ productId, status: 'all' }),
    enabled: !!productId && enabled,
    select: (alerts) => alerts.find((a) => a.isActive && !a.triggeredAt) ?? alerts[0] ?? null,
    staleTime: 20_000,
  });
}

export function usePriceAlertMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PRICE_ALERTS_KEY });
  };

  const create = useMutation({
    mutationFn: createPriceAlert,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string; targetAmount?: number; marketId?: string | null }) =>
      updatePriceAlert(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: deletePriceAlert,
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export function getAlertStatusLabel(alert: PriceAlert): string {
  if (alert.triggeredAt) return 'Tetiklendi';
  if (alert.isTargetReached) return 'Hedefe ulaşıldı';
  if (alert.isActive) return 'Takipte';
  return 'Pasif';
}

export function getAlertStatusColor(alert: PriceAlert): string {
  if (alert.triggeredAt) return '#059669';
  if (alert.isTargetReached) return '#d97706';
  if (alert.isActive) return '#2563eb';
  return '#94a3b8';
}
