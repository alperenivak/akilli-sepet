import api from './client';
import { Report, PaginatedResponse } from '../types/api';

export interface CreateReportData {
  barcodeCode?: string;
  productId?: string;
  marketId?: string;
  branchId?: string;
  description: string;
  expiryDate?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  district?: string;
  isAnonymous?: boolean;
  imageUrls?: string[];
}

// Ihbar olustur
export const createReport = (data: CreateReportData) =>
  api.post<{ data: Report }>('/reports', data).then((r) => r.data.data);

// Kendi ihbarlarim
export const getMyReports = (page = 1, limit = 20) =>
  api.get<{ data: PaginatedResponse<Report> }>('/reports/my', { params: { page, limit } })
     .then((r) => r.data.data);

// Ihbar detayi
export const getReport = (id: string) =>
  api.get<{ data: Report }>(`/reports/${id}`).then((r) => r.data.data);
