import api from './client';
import { Market, MarketBranch, Catalog } from '../types/api';

// Tum marketler
export const getMarkets = () =>
  api.get<{ data: Market[] }>('/markets').then((r) => r.data.data);

// Market detayi
export const getMarket = (id: string) =>
  api.get<{ data: Market }>(`/markets/${id}`).then((r) => r.data.data);

// Yakin subeler
export const getNearbyBranches = (params: {
  lat: number;
  lng: number;
  radiusKm?: number;
}) =>
  api.get<{ data: MarketBranch[] }>('/markets/branches/nearby', { params })
     .then((r) => r.data.data);

// Aktif kataloglar
export const getActiveCatalogs = (marketId?: string) =>
  api.get<{ data: Catalog[] }>('/catalogs', {
    params: marketId ? { marketId } : undefined,
  }).then((r) => r.data.data);

// Katalog detayi
export const getCatalog = (id: string) =>
  api.get<{ data: Catalog }>(`/catalogs/${id}`).then((r) => r.data.data);
