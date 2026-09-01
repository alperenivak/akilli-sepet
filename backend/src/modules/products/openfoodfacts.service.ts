// =====================================================
// Open Food Facts Entegrasyonu
// Ücretsiz, API key gerektirmez, 3M+ ürün
// Türkiye ürünleri dahil küresel barkod veritabanı
//
// Akış: Barkod DB'de yoksa → OFF API → ürün oluştur → kaydet → döndür
// Rate limit: 100 istek/dk (barkod lookup)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

// İstediğimiz alanlar — yanıt boyutunu küçültür
const OFF_FIELDS = [
  'product_name',
  'product_name_tr',   // Türkçe isim (varsa)
  'brands',
  'image_front_url',   // Ana ürün görseli
  'quantity',          // "1 L", "500 ml" gibi
  'categories_tags',   // 'en:milks', 'tr:sütler' gibi
].join(',');

export interface OFFProduct {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  quantity: string | null;         // "1 L", "350 g" vb.
  categoriesRaw: string[];         // OFF kategori tag'leri
}

@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);

  /**
   * Barkod ile Open Food Facts'ten ürün bilgisi çeker.
   * Bulunamazsa null döner, hata fırlatmaz.
   */
  async lookup(barcode: string): Promise<OFFProduct | null> {
    const url = `${OFF_BASE}/${barcode}?fields=${OFF_FIELDS}`;

    try {
      const { data } = await axios.get(url, {
        timeout: 8000,
        headers: {
          // OFF etik kullanım için User-Agent zorunlu kılar
          'User-Agent': 'AkilliSepet/1.0 (https://akillisepet.com; contact@akillisepet.com)',
        },
      });

      if (data.status !== 1 || !data.product) {
        this.logger.debug(`OFF: barkod bulunamadı → ${barcode}`);
        return null;
      }

      const p = data.product;

      // Türkçe isim öncelikli, yoksa genel isim
      const name: string | null =
        (p.product_name_tr?.trim() || p.product_name?.trim()) ?? null;

      if (!name) {
        this.logger.debug(`OFF: ürün adı boş → ${barcode}`);
        return null;
      }

      const brand: string | null = p.brands
        ? p.brands.split(',')[0].trim() || null
        : null;

      return {
        name,
        brand,
        imageUrl: p.image_front_url?.trim() || null,
        quantity: p.quantity?.trim() || null,
        categoriesRaw: (p.categories_tags as string[]) ?? [],
      };
    } catch (err) {
      // Ağ hatası veya timeout — sessizce null dön
      const msg = (err as Error).message;
      this.logger.warn(`OFF API erişim hatası (${barcode}): ${msg}`);
      return null;
    }
  }

  /**
   * OFF kategori tag'lerini okunabilir isime çevirir.
   * Örnek: "en:milks" → "Süt Ürünleri"
   */
  static mapCategoryHint(tags: string[]): string {
    const MAP: Record<string, string> = {
      'en:milks':           'Süt & Süt Ürünleri',
      'en:dairies':         'Süt & Süt Ürünleri',
      'en:cheeses':         'Peynir',
      'en:yogurts':         'Yoğurt',
      'en:eggs':            'Yumurta',
      'en:breads':          'Ekmek & Unlu Mamüller',
      'en:pasta':           'Makarna',
      'en:waters':          'Su & İçecekler',
      'en:beverages':       'Su & İçecekler',
      'en:soft-drinks':     'Su & İçecekler',
      'en:juices':          'Meyve Suyu',
      'en:cereals':         'Tahıl & Kahvaltılık',
      'en:oils':            'Yağ',
      'en:olive-oils':      'Yağ',
      'en:snacks':          'Atıştırmalık',
      'en:chocolates':      'Çikolata & Şekerleme',
      'en:biscuits':        'Bisküvi & Kraker',
      'en:frozen-foods':    'Dondurulmuş Gıda',
      'en:meats':           'Et Ürünleri',
      'en:fish':            'Balık & Deniz Ürünleri',
      'en:sauces':          'Sos & Baharat',
      'en:cleaning-agents': 'Temizlik',
      'en:shampoos':        'Kişisel Bakım',
      'en:cosmetics':       'Kişisel Bakım',
    };

    for (const tag of tags) {
      if (MAP[tag]) return MAP[tag];
    }
    return 'Diğer';
  }
}
