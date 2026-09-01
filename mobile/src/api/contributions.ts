import api from './client';

export interface ContributionItem {
  id: string;
  type: 'BARCODE' | 'MARKET_LISTING';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  barcode?: string | null;
  amount?: number | null;
  note?: string | null;
  createdAt: string;
  product: { id: string; name: string; imageUrl?: string | null };
  market?: { id: string; name: string } | null;
}

export const submitBarcodeContribution = async (data: {
  productId: string;
  code: string;
  note?: string;
}) => {
  const { data: res } = await api.post('/contributions/barcode', data);
  return res.data ?? res;
};

export const submitMarketListing = async (data: {
  productId: string;
  marketId: string;
  amount: number;
  note?: string;
}) => {
  const { data: res } = await api.post('/contributions/market-listing', data);
  return res.data ?? res;
};

export const getMyContributions = async (page = 1, limit = 20) => {
  const { data: res } = await api.get('/contributions/mine', { params: { page, limit } });
  return res.data ?? res;
};
