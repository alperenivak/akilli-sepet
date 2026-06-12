// =====================================================
// Veri saglayici arayuzu — gelecekteki dis entegrasyonlar icin
// Simdi yalnizca iskelet; hicbir saglayici veri CEKMEZ
// =====================================================

export interface DataProviderStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  message: string;
}

export interface DataSyncJobPayload {
  jobType: string;
  provider: string;
  metadata?: Record<string, unknown>;
}

/** Gelecekte implement edilecek saglayicilar bu arayuzu kullanir */
export interface IDataProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getStatus(): DataProviderStatus;
}
