import api from './client';

export interface PriceAlert {
  id: string;
  productId: string;
  marketId?: string | null;
  targetAmount: number;
  isActive: boolean;
  triggeredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  currentAmount?: number | null;
  currentMarketName?: string | null;
  gapAmount?: number | null;
  isTargetReached?: boolean;
  product?: {
    id: string;
    name: string;
    brand?: string | null;
    imageUrl?: string | null;
  };
  market?: { id: string; name: string; brandColor?: string | null } | null;
}

export type PriceAlertStatus = 'active' | 'triggered' | 'all';

export const submitPriceFeedback = (data: {
  productId: string;
  marketId: string;
  isCorrect: boolean;
  note?: string;
}) =>
  api.post('/prices/feedback', data).then((r) => r.data.data);

// Crowdsource fiyat bildirimi
export const submitCrowdsourcePrice = (data: {
  productId: string;
  marketId: string;
  amount: number;
  note?: string;
}) =>
  api.post('/prices/submit', data).then((r) => r.data.data);

export const createPriceAlert = (data: {
  productId: string;
  targetAmount: number;
  marketId?: string | null;
}) =>
  api.post<{ data: PriceAlert }>('/prices/alerts', data).then((r) => r.data.data);

export const getPriceAlerts = (params?: { status?: PriceAlertStatus; productId?: string }) =>
  api.get<{ data: PriceAlert[] }>('/prices/alerts', { params }).then((r) => r.data.data);

export const updatePriceAlert = (
  id: string,
  data: { targetAmount?: number; marketId?: string | null },
) =>
  api.patch<{ data: PriceAlert }>(`/prices/alerts/${id}`, data).then((r) => r.data.data);

export const deletePriceAlert = (id: string) =>
  api.delete(`/prices/alerts/${id}`).then((r) => r.data.data);
