// =====================================================
// Veri saglayici kaydi — dis kaynaklar KAPALI (iskelet)
// =====================================================

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATA_SYNC_PROVIDERS } from '../../../constants/data-sync.constants';
import { DataProviderStatus, IDataProvider } from '../interfaces/data-provider.interface';

class StubProvider implements IDataProvider {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly description: string,
    private readonly external: boolean,
    private readonly externalEnabled: boolean,
  ) {}

  isConfigured(): boolean {
    if (this.external) return this.externalEnabled;
    return true;
  }

  getStatus(): DataProviderStatus {
    const enabled = this.isConfigured();
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      enabled,
      configured: enabled,
      ready: enabled && !this.external,
      message: this.external
        ? (this.externalEnabled
          ? 'Saglayici etkin — connector implementasyonu bekleniyor'
          : 'Harici saglayicilar kapali (DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED=false)')
        : 'Ic kaynak — manuel import ve panel girisi ile kullanima hazir',
    };
  }
}

@Injectable()
export class DataProviderRegistry {
  private readonly providers: IDataProvider[];

  constructor(private readonly config: ConfigService) {
    const externalOn = this.config.get<boolean>('dataSync.externalProvidersEnabled', false);

    this.providers = [
      new StubProvider(
        DATA_SYNC_PROVIDERS.MANUAL_IMPORT,
        'Manuel Import',
        'Admin panel ve API uzerinden fiyat/urun yukleme',
        false,
        externalOn,
      ),
      new StubProvider(
        DATA_SYNC_PROVIDERS.MARKET_PANEL,
        'Market Paneli',
        'Market yoneticilerinin fiyat girisi',
        false,
        externalOn,
      ),
      new StubProvider(
        DATA_SYNC_PROVIDERS.BULK_CSV,
        'Toplu CSV/JSON',
        'Barkod + market slug ile toplu fiyat import',
        false,
        externalOn,
      ),
      new StubProvider(
        DATA_SYNC_PROVIDERS.EXTERNAL_API,
        'Harici API',
        'Market veya veri saglayici API entegrasyonu (henuz bagli degil)',
        true,
        externalOn,
      ),
      new StubProvider(
        DATA_SYNC_PROVIDERS.OPEN_DATA,
        'Acik Veri',
        'Acik veri setleri (henuz bagli degil)',
        true,
        externalOn,
      ),
    ];
  }

  getAllStatuses(): DataProviderStatus[] {
    return this.providers.map((p) => p.getStatus());
  }

  getProvider(id: string): IDataProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }
}
