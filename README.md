# Akıllı Sepet — Akıllı Fiyat Karşılaştırma & SKT İhbar Platformu

> Gerçek zamanlı market fiyat karşılaştırması, son kullanma tarihi (SKT) ihbar sistemi ve AI destekli alışveriş asistanı.
> Alperen İVAK

---

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [Canlı Ortama Dağıtım](#canlı-ortama-dağıtım)
- [Operasyon & Yedekleme](#operasyon--yedekleme)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Demo Verileri & Giriş Bilgileri](#demo-verileri--giriş-bilgileri)
- [API Dökümantasyonu](#api-dökümantasyonu)
- [Kullanıcı Rolleri](#kullanıcı-rolleri)
- [Ekran Haritası](#ekran-haritası)
- [Mimari](#mimari)

---

## Genel Bakış

Akıllı Sepet; kullanıcıların marketlerdeki ürün fiyatlarını karşılaştırmasına, son kullanma tarihi geçmiş ürünleri ihbar etmesine ve AI destekli alışveriş tavsiyeleri almasına imkân tanır. Üç bağımsız uygulamadan oluşur:

| Uygulama | Açıklama | Port |
|----------|----------|------|
| **Backend API** | NestJS REST API | `3001` |
| **Admin Paneli** | Next.js yönetim arayüzü | `3000` |
| **Mobil Uygulama** | React Native / Expo | Expo Go |

---

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Mobil** | React Native, Expo SDK 55, Expo Router, Zustand, React Query |
| **Admin Paneli** | Next.js 15, Tailwind CSS |
| **Backend** | NestJS 11, TypeScript, Prisma ORM 5 |
| **Veritabanı** | PostgreSQL 16 |
| **Cache / Queue** | Redis, BullMQ |
| **Dosya Depolama** | MinIO (S3 uyumlu) |
| **AI** | OpenAI GPT-4o-mini · Google Gemini 1.5 Flash |
| **Bildirimler** | Firebase Cloud Messaging |
| **Auth** | JWT (Access + Refresh Token) |
| **Altyapı** | Docker Compose |

---

## Proje Yapısı

```
Akıllı Sepet/
├── backend/                    # NestJS REST API
│   ├── prisma/
│   │   ├── schema.prisma       # Veritabanı şeması
│   │   ├── seed.ts             # Demo verileri
│   │   ├── seed-branches.ts    # OSM şube seed (İstanbul + Ankara)
│   │   ├── seed-enrich-products.ts     # Ürün görsel/detay zenginleştirme
│   │   ├── seed-enrich-missing-images.ts # Görselsiz ürünler için 2. geçiş
│   │   ├── lib/osm-branches.ts # OpenStreetMap Overpass çekici
│   │   ├── lib/product-enrichment.ts # Migros + Open Food Facts zenginleştirme
│   │   ├── data/               # OSM şube + ürün önbelleği (JSON)
│   │   └── migrations/         # Prisma migration'ları
│   └── src/
│       ├── modules/
│       │   ├── admin/          # Admin istatistik ve log endpoint'leri
│       │   ├── ai/             # AI sohbet, öneri, trend analizi
│       │   ├── auth/           # JWT kimlik doğrulama
│       │   ├── carts/          # Sepet yönetimi & optimizasyon
│       │   ├── catalogs/       # Dijital katalog yönetimi
│       │   ├── markets/        # Market ve şube yönetimi
│       │   ├── notifications/  # FCM push bildirimleri
│       │   ├── prices/         # Fiyat CRUD ve geçmiş
│       │   ├── products/       # Ürün kataloğu ve barkod
│       │   ├── reports/        # SKT ihbar sistemi
│       │   ├── data-sync/      # Veri senkronizasyonu altyapisi (import, cron, log)
│       │   ├── scraper/        # Gece fiyat scraper (sitemap + cheerio + PriceHistory)
│       │   └── users/          # Kullanıcı profil yönetimi
│       ├── common/             # Guard, filter, interceptor, storage
│       └── config/             # Prisma, Redis bağlantıları
│
├── admin-panel/                # Next.js Yönetim Arayüzü
│   └── src/
│       ├── app/
│       │   ├── page.tsx                    # Giriş ekranı (portal seçimi)
│       │   ├── (admin)/                    # Sistem Yöneticisi paneli
│       │   │   ├── dashboard/              # Genel istatistikler
│       │   │   ├── products/               # Ürün yönetimi + filtreleme
│       │   │   ├── markets/                # Market & şube yönetimi
│       │   │   ├── users/                  # Kullanıcı yönetimi
│       │   │   ├── data-sync/              # Veri import & kalite yönetimi
│       │   │   └── reports/                # Tüm ihbarlar
│       │   ├── inspector-panel/            # Denetçi paneli
│       │   │   ├── dashboard/              # İhbar istatistikleri
│       │   │   ├── reports/                # Bekleyen ihbarlar
│       │   │   ├── in-review/              # İncelenen ihbarlar
│       │   │   └── resolved/               # Tamamlananlar
│       │   └── market-panel/               # Market yöneticisi paneli
│       │       ├── dashboard/              # Market istatistikleri
│       │       ├── reports/                # Markete gelen ihbarlar
│       │       ├── catalog/                # Katalog yönetimi
│       │       ├── prices/                 # Fiyat yönetimi
│       │       └── branches/               # Şube yönetimi
│       ├── components/         # Sidebar, AuthGuard, ortak bileşenler
│       ├── lib/api.ts          # Merkezi API istemcisi
│       └── types/              # TypeScript tip tanımları
│
├── mobile/                     # React Native / Expo
│   ├── app/
│   │   ├── (tabs)/             # Alt sekme navigasyonu
│   │   │   ├── index.tsx       # Ana sayfa (HeroBanner + ürünler)
│   │   │   ├── search.tsx      # Ürün arama
│   │   │   ├── markets.tsx     # Market listesi
│   │   │   ├── cart.tsx        # Sepet & optimizasyon
│   │   │   └── profile.tsx     # Kullanıcı profili
│   │   ├── (auth)/
│   │   │   ├── login.tsx       # Giriş ekranı
│   │   │   └── register.tsx    # Kayıt ekranı
│   │   ├── product/[id].tsx    # Ürün detay & fiyat karşılaştırma
│   │   ├── market/[id].tsx     # Market detay
│   │   ├── catalogs/[id].tsx   # Katalog okuyucu
│   │   ├── reports/
│   │   │   ├── create.tsx      # İhbar oluşturma formu
│   │   │   └── my.tsx          # Kendi ihbarlarım
│   │   ├── ai/chat.tsx         # AI asistan sohbeti
│   │   ├── scan/index.tsx      # Barkod tarayıcı
│   │   └── notifications.tsx   # Bildirimler & ihbar durumları
│   └── src/
│       ├── api/                # Axios tabanlı API katmanı
│       ├── components/         # Yeniden kullanılabilir UI bileşenleri
│       │   └── home/           # HeroBanner, SignupPromo, CategoryCarousel…
│       ├── hooks/              # React Query hook'ları
│       ├── store/              # Zustand store'ları (auth, cart)
│       ├── types/              # API tip tanımları
│       └── utils/constants.ts  # Renkler, sabitler, URL tespiti
│
├── shared/                     # Ortak TypeScript tipleri
│   └── src/
│       ├── constants/
│       ├── types/
│       └── validators/
│
├── docker-compose.yml
└── .env.example
```

---

## Özellikler

### Mobil Uygulama

| Özellik | Açıklama |
|---------|----------|
| **Anasayfa Billboard** | Otomatik kayan banner: fiyat karşılaştırma, itibar, kuponlar, fiyat bildir/doğrula, SKT, AI asistan |
| **Senin İçin Öneriler** | Baktığın ürünler + benzerleri; satın alma niyeti skoru (tekrar bakış, fiyat düşüşü, sepette değil) |
| **Ürün Kataloğu** | Ana kategori + alt kategori (Süt › Peynir vb.) ile filtreleme |
| **Fiyat Karşılaştırma** | Ürün detayında tüm marketlerdeki anlık fiyatlar |
| **Fiyat Geçmişi Grafiği** | En ucuz market için son fiyat değişimleri (bar chart) |
| **Fiyat Geri Bildirimi** | Ürün detayında fiyat doğruluk bildirimi (Doğru/Yanlış); oylar güven skorunu günceller |
| **Crowdsource Fiyat Bildirimi** | Kullanıcı fiyat bildirimi; otomatik pipeline (güvenilir kullanıcı / konsensus / geçici yansıtma) |
| **Topluluk İtibarı** | Profilde itibar takibi; doğrulama ve bildirimlerle puan; güvenilir kullanıcıların bildirimleri öncelikli |
| **Market Kuponları** | İtibar seviyesine göre partner indirim kuponları; `/coupons` ekranında talep, mağaza kullanım uyarısı; hibrit/otomatik kod üretimi |
| **Fiyat Uyarısı** | Hedef fiyat + market seçimi; profilde takip listesi; güncel/hedef fiyat karşılaştırması; saatlik cron bildirimi |
| **AI Asistan** | Ürün + konum + sepet + ihbar + uygulama rehberi (hibrit; opsiyonel OpenAI/Gemini) |
| **Offline Önbellek** | MMKV ile son ürün listesi (bağlantı yokken gösterim) |
| **Barkod Tarama** | expo-camera ile barkod okuma ve anlık ürün sorgulama |
| **Sepet & Optimizasyon** | Sepete eklemeden önce market seçimi; sepet marketlere göre gruplanır; tek market alternatifi ve tasarruf analizi |
| **SKT İhbar** | Market seçimi (liste veya yazılı) + fotoğraf + konum ile bildirim |
| **Katalog Okuyucu** | Market aktüel kataloglarını sayfa sayfa görüntüleme |
| **AI Chatbot** | Ürün önerisi, fiyat analizi ve alışveriş tavsiyeleri |
| **Bildirimler** | İhbar durum güncellemeleri |
| **Kayıt Ol / Giriş** | JWT tabanlı kimlik doğrulama |
| **E-posta OTP** | Kayıt ve şifre sıfırlamada 6 haneli e-posta doğrulama kodu |
| **Şifremi Unuttum** | E-posta OTP ile şifre sıfırlama (mobil + admin panel) |
| **Ban Ekranı** | Geçici/kalıcı ban durumunda tam ekran mesaj, admin sebebi ve geri sayım |
| **Responsive Tasarım** | `useWindowDimensions` ile tüm ekran boyutlarına uyum |
| **Progressive Loading** | Skeleton animasyonlu bölüm bölüm yükleme |

### Admin Paneli — Sistem Yöneticisi

| Özellik | Açıklama |
|---------|----------|
| **Dashboard** | Anlık kullanıcı, ürün, ihbar ve market istatistikleri |
| **Ürün Yönetimi** | Hiyerarşik kategori filtresi; alt kategori ile ürün ekleme/düzenleme; kamera ile barkod tarama (EAN/UPC) |
| **Market Yönetimi** | Market ekleme/düzenleme + şube CRUD (modal & drawer arayüzü) |
| **Kullanıcı Yönetimi** | Rol atama, hesap aktif/pasif, geçici/kalıcı ban (zorunlu sebep) |
| **İhbar Yönetimi** | Tüm ihbarları listeleme, durum takibi, markete iletme; kullanıcı ve market notları ayrı kanallarda |
| **Fiyat Bildirimleri** | Crowdsource kuyruğu; otomatik işlenenler ayrı; yalnızca anormal fiyatlar manuel inceleme |
| **Topluluk Ödülleri** | Kupon kampanyası CRUD; manuel/otomatik/hibrit kod modu; talep geçmişi |

### Admin Paneli — Denetçi

| Özellik | Açıklama |
|---------|----------|
| **İhbar Kutusu** | Bekleyen ve incelenen ihbarlar |
| **Markete İletme** | İnceleme sırasında ihbarı market yöneticisine push + markete özel not (kullanıcı görmez) |
| **Durum Güncelleme** | `PENDING → UNDER_REVIEW → APPROVED/REJECTED → RESOLVED` |
| **SKT Acil Liste** | SKT tarihi belirtilmiş acil ihbarlar ayrıca gösterilir |

### Admin Paneli — Market Yöneticisi

| Özellik | Açıklama |
|---------|----------|
| **Market Dashboardu** | Bekleyen ihbar, katalog ve şube sayısı |
| **İletilen İhbarlar** | Denetçinin markete push ettiği ihbarları görüntüleme ve yanıtlama |
| **Katalog Yönetimi** | Aktüel katalog ekleme/silme |
| **Fiyat Yönetimi** | Ürün fiyatlarını güncelleme |
| **Şube Yönetimi** | Şube ekleme, düzenleme, aktif/pasif |
| **Topluluk Ödülleri** | Kendi marketine özel itibar kuponları; manuel kod ekleme; otomatik üretim modu |

### Backend API

| Özellik | Açıklama |
|---------|----------|
| **Modüler Mimari** | 12 bağımsız NestJS modülü |
| **Rol Tabanlı Erişim** | 5 farklı kullanıcı rolü, Guard'larla korunan endpoint'ler |
| **JWT Auth** | Access (15 dk) + Refresh (7 gün) token çifti |
| **Şifre Güvenliği** | bcrypt (12 round) hash — düz metin asla saklanmaz; OTP kodları de hash'lenir |
| **E-posta OTP** | Kayıt doğrulama + şifre sıfırlama (6 hane, 10 dk geçerli) |
| **Fiyat Scraper** | Migros REST API + A101/Macrocenter sitemap/cheerio — gece 03:00 cron, PriceHistory |
| **Rate Limiting** | `@nestjs/throttler` ile istek sınırlaması |
| **Sepet Optimizasyonu** | Market bazlı sepet kalemleri; seçilen market toplamı + tek market alternatifi + ürün bazlı tasarruf önerileri |
| **Veri Senkronizasyonu** | BullMQ kuyruk + cron bakım; barkod CSV import; fiyat tazelik; harici API iskeleti (varsayılan kapalı) |
| **Asenkron İşler** | BullMQ ile fiyat güncelleme ve bakım kuyruğu |
| **Dosya Yükleme** | MinIO (S3) entegrasyonu — ürün ve ihbar görselleri |
| **Push Bildirim** | Firebase Cloud Messaging |
| **AI Entegrasyonu** | OpenAI + Gemini dual-provider, otomatik fallback |
| **Swagger** | Otomatik API dökümantasyonu |
| **Health Check** | `/api/health/live`, `/api/health/ready` (DB + Redis) |
| **Full-Text Search** | PostgreSQL tsvector + ts_rank (Türkçe) |
| **Audit Log** | Admin/market manager CRUD işlemleri |
| **Production Docker** | `Dockerfile` + `docker-compose.prod.yml` |

---

## Kurulum

### Önkoşullar

- **Node.js** 20+
- **Docker Desktop** (PostgreSQL, Redis, MinIO için)
- **Expo Go** uygulaması (iOS/Android — mobil test için)

---

### 1. Repo'yu Klonla

```bash
git clone https://github.com/kullanici/Akıllı Sepet.git
cd Akıllı Sepet
```

### 2. Altyapıyı Başlat

```bash
docker-compose up -d
```

| Servis | Adres |
|--------|-------|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO API | `localhost:9000` |
| MinIO Web UI | `localhost:9001` |
| **pgAdmin** (DB yönetimi) | `http://localhost:5050` |

**pgAdmin giriş:** `admin@marketapp.com` / `admin123` (geliştirme). Sunucu: `marketapp` → Host `postgres`, DB `marketapp`, kullanıcı `postgres`, şifre `123456`.

**Opsiyonel nginx reverse proxy** (admin + API tek port):

```bash
docker-compose --profile proxy up -d
```

| Servis | Adres |
|--------|-------|
| Nginx (admin + `/api`) | `http://localhost:8080` |

**Hızlı API demo** (PowerShell): `.\scripts\demo-flow.ps1`  
**Postman koleksiyonu:** `postman/Akilli_Sepet_API.postman_collection.json`  
**Güvenlik özeti:** `docs/SECURITY.md`

### 3. Backend

```bash
cd backend
cp ../.env.example .env
# .env dosyasını düzenle — en azından JWT_SECRET ve DATABASE_URL doldurulmalı

npm install
npx prisma migrate dev --name init   # Tabloları oluşturur
npx prisma generate                  # Prisma client üretir
npx prisma db seed                   # Demo verileri yükler
npm run seed:branches                # OSM'den gerçek şubeler (İstanbul + Ankara)
npm run seed:enrich-products         # Ürün görselleri + detay zenginleştirme
npm run seed:reclassify              # Ürün kategorilerini düzelt (keyword+marka analizi)
npm run seed:image-pipeline          # Görselsiz ürünler için Migros+Trendyol+Gemini AI pipeline
npm run start:dev
```

> **Swagger:** http://localhost:3001/api/docs

### 4. Admin Paneli

```bash
cd admin-panel
npm install
npm run dev
```

> **Admin Panel:** http://localhost:3000

### 5. Mobil Uygulama

```bash
cd mobile
npm install
npx expo start          # LAN mod (aynı Wi-Fi gerekli)
# veya
npx expo start --tunnel  # Tünel mod (farklı ağ / firewall varsa)
```

Terminaldeki QR kodu Expo Go uygulamasıyla okuyun.

> **Web tarayıcı ile test:** http://localhost:8081

**Production build (EAS):**

```bash
cd mobile
eas build --platform android --profile production
```

`eas.json` ve `EXPO_PUBLIC_API_URL` değerlerini canlı API URL'niz ile güncelleyin.

---

## Canlı Ortama Dağıtım

| Bileşen | Platform | Dosya |
|---------|----------|-------|
| Backend API | Docker (VPS/Railway) | `backend/Dockerfile`, `docker-compose.prod.yml` |
| Admin Panel | **Vercel** | `admin-panel/vercel.json` |
| Mobil | **Expo EAS** | `mobile/eas.json` |
| Altyapı | Docker Compose prod | `.env.docker.example` |

```bash
# Production altyapı + backend
cp .env.docker.example .env.docker
# CHANGE_ME değerlerini güçlü şifrelerle değiştirin
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

**Health:** `GET /api/health/live` · `GET /api/health/ready`

**GitHub Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `BACKEND_URL`, `EXPO_TOKEN`, `EXPO_PUBLIC_API_URL`

Detaylı rehber: [`docs/deployment.md`](docs/deployment.md) · ADR: [`docs/adr/`](docs/adr/)

---

## Operasyon & Yedekleme

| İşlem | Komut |
|-------|-------|
| PostgreSQL yedek (Windows) | `.\scripts\backup-postgres.ps1` |
| PostgreSQL yedek (Linux) | `./scripts/backup-postgres.sh` |
| PostgreSQL geri yükle | `./scripts/restore-postgres.sh backups/postgres_*.sql.gz` |
| MinIO yedek | `.\scripts\backup-minio.ps1` (mc client gerekir) |

**Olay müdahale:** [`docs/incident-playbook.md`](docs/incident-playbook.md) (scraper çöktü, DB doldu, Redis koptu)

**Veri kalitesi API:** `GET /api/admin/data-quality` (görsel/fiyat/kategori özeti)

**Audit log:** Admin/market manager mutasyonları otomatik kaydedilir → `GET /api/admin/audit-logs`

---

## Ortam Değişkenleri

`backend/.env` dosyası. Şablon: `backend/.env.example`

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `NODE_ENV` | `development` / `production` | ✅ |
| `PORT` | Backend port (varsayılan: `3001`) | — |
| `DATABASE_URL` | PostgreSQL bağlantı URL'i | ✅ |
| `REDIS_HOST` | Redis sunucu adresi | ✅ |
| `REDIS_PORT` | Redis portu (varsayılan: `6379`) | — |
| `REDIS_PASSWORD` | Redis şifresi | — |
| `JWT_SECRET` | Access token imzalama anahtarı | ✅ |
| `JWT_EXPIRES_IN` | Access token süresi (örn. `15m`) | — |
| `JWT_REFRESH_SECRET` | Refresh token imzalama anahtarı | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token süresi (örn. `7d`) | — |
| `OPENAI_API_KEY` | OpenAI API anahtarı | AI için |
| `GEMINI_API_KEY` | Google Gemini API (ücretsiz — ChatGPT tarzı AI) | AI için |
| `AI_PREFERRED_PROVIDER` | `gemini` veya `openai` (varsayılan: `gemini`) | — |
| `GEMINI_MODEL` | Gemini model ID (varsayılan: `gemini-2.5-flash`) | — |
| `S3_ENDPOINT` | MinIO/S3 endpoint | Görsel yükleme için |
| `S3_ACCESS_KEY` | MinIO erişim anahtarı | Görsel yükleme için |
| `S3_SECRET_KEY` | MinIO gizli anahtarı | Görsel yükleme için |
| `S3_BUCKET_NAME` | S3 bucket adı | Görsel yükleme için |
| `FIREBASE_PROJECT_ID` | Firebase proje ID | Push bildirim için |
| `FIREBASE_PRIVATE_KEY` | Firebase özel anahtar | Push bildirim için |
| `FIREBASE_CLIENT_EMAIL` | Firebase servis hesabı e-postası | Push bildirim için |
| `FRONTEND_URL` | Mobil/web frontend URL (CORS) | Production |
| `ADMIN_PANEL_URL` | Admin panel tam URL (CORS) | Production |
| `CORS_ORIGINS` | Virgülle ayrılmış izinli origin listesi | Production ✅ |
| `API_URL` | Backend public URL | Production |
| `DATA_SYNC_CRON_ENABLED` | Otomatik fiyat/katalog bakım cron'ları | — |
| `DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED` | Harici API/acik veri (varsayılan `false`) | — |
| `DATA_SYNC_PRICE_STALE_DAYS` | Kac gunden eski fiyat dogrulama bekler | — |
| `DATA_SYNC_PRICE_FRESH_DAYS` | "Guncel" etiketi esigi (gun) | — |
| `ALLOW_DEMO_SEED` | Demo seed API (`false` production'da) | — |
| `EMAIL_PROVIDER` | `resend` / `brevo` (OTP e-posta gönderimi) | OTP için |
| `EMAIL_FROM` | Gönderen e-posta adresi | OTP için |
| `BREVO_API_KEY` | Brevo SMTP API anahtarı | Canlı e-posta |
| `RESEND_API_KEY` | Resend API anahtarı | Canlı e-posta |
| `EMAIL_OTP_EXPIRES_MINUTES` | OTP geçerlilik süresi (dk) | — |
| `PRICE_SCRAPER_ENABLED` | Canlı fiyat çekimi + gece 03:00 cron | — |
| `PRICE_SCRAPER_SYNC_ON_STARTUP` | Backend açılışında bir kez Migros sync | — |
| `PRICE_SCRAPER_DEACTIVATE_DEMO` | Demo seed ürünlerini SCRAPER sonrası gizle | — |
| `PRICE_SCRAPER_MAX_PRODUCTS` | Market başına max ürün (varsayılan 300) | — |
| `PRICE_SCRAPER_MIGROS_MAX_PAGES` | Migros arama terimi başına sayfa | — |
| `PRICE_SCRAPER_API_MIN_DELAY_MS` | API istekleri arası min bekleme | — |
| `PRICE_SCRAPER_MIN_DELAY_MS` | HTML scrape min bekleme (ms) | — |
| `PRICE_SCRAPER_NAME_SELECTOR` | Cheerio ürün adı seçicisi (sitemap) | — |
| `PRICE_SCRAPER_PRICE_SELECTOR` | Cheerio fiyat seçicisi (sitemap) | — |

> **OTP e-posta:** `RESEND_API_KEY` veya `BREVO_API_KEY` tanımlayın. Kod yalnızca e-posta ile gönderilir; uygulama içinde gösterilmez.

> **ChatGPT tarzı AI (ücretsiz):** `.\scripts\setup-gemini-key.ps1` çalıştırın → [Google AI Studio](https://aistudio.google.com/app/apikey) key'i yapıştırın → backend'i yeniden başlatın. Kontrol: `GET /api/ai/status` → `"llm": true`. Key yoksa kural tabanlı temel mod çalışır.

### Gerçek Veri Altyapısı

Harici veri çekimi **varsayılan olarak kapalıdır** (`DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED=false`). Canlı veri yüklemek için:

1. **Admin → Veri Yönetimi** — CSV ile `barkod,market_slug,fiyat` toplu import
2. **Market Paneli → Fiyatlar** — market yöneticisi manuel giriş (`MARKET_PANEL` kaynağı)
3. **API** — `POST /api/prices/bulk` veya `POST /api/data-sync/import/prices-by-barcode`
4. **Fiyat Scraper Servisi** — `PRICE_SCRAPER_ENABLED=true`
   - **Migros:** `rest.migros.com.tr` REST API (`scraperType=MIGROS_API`) → ~300 ürün ✅
   - **A101:** `sitemap.xml` → `products-kapida-*.xml` + JSON-LD fiyat parse → ~267 ürün ✅
   - **Macrocenter:** `hermes/api/sitemaps/sitemap.xml` → `sitemap-products-*.xml` + cheerio → ~248 ürün ✅
   - **CarrefourSA:** Cloudflare WAF engeli — otomatik çekim kapalı (scraper:disabled)
   - **ŞOK:** Tüm endpoint'ler 403 — otomatik çekim kapalı (scraper:disabled)
   - Gece **03:00** cron, açılışta sync, `GET /api/scraper/status`, `POST /api/scraper/run`
   - Fiyat değişince `PriceHistory` otomatik; demo ürünler `PRICE_SCRAPER_DEACTIVATE_DEMO=true` ile gizlenir
4. **Cron** — eski fiyatları `needsVerification` olarak işaretler; süresi dolan katalogları kapatır

Gelecekte harici API bağlamak için env'i açın ve `IDataProvider` connector implementasyonu ekleyin.

---

## Demo Verileri & Giriş Bilgileri

`npx prisma db seed` çalıştırıldığında aşağıdaki veriler yüklenir:

### Kullanıcılar

| Rol | E-posta | Şifre | Giriş Yeri |
|-----|---------|-------|-----------|
| Sistem Yöneticisi | `admin@marketapp.com` | `Admin123!` | Admin Paneli → Sistem Yönetim |
| Denetçi | `denetci@marketapp.com` | `Admin123!` | Admin Paneli → Denetçi |
| Normal Kullanıcı | `kullanici@marketapp.com` | `User123!` | Mobil Uygulama |
| Migros Yöneticisi | `yonetici@migros.com` | `yonetici123` | Admin Paneli → Market |
| A101 Yöneticisi | `yonetici@a101.com` | `yonetici123` | Admin Paneli → Market |
| BİM Yöneticisi | `yonetici@bim.com` | `yonetici123` | Admin Paneli → Market |
| ŞOK Yöneticisi | `yonetici@sokmarket.com` | `yonetici123` | Admin Paneli → Market |
| CarrefourSA Yöneticisi | `yonetici@carrefoursa.com` | `yonetici123` | Admin Paneli → Market |

### Yüklenen Demo Verisi

| Veri | Adet |
|------|------|
| Kategoriler | 9 ana + 24 alt kategori |
| Marketler | 6 (Migros, BİM, A101, ŞOK, CarrefourSA, Macrocenter) |
| Şubeler | ~450 (OSM kaynaklı, İstanbul + Ankara; `npm run seed:branches`) |
| Aktif Ürünler | ~1538 (görseli olan ~1405 = %91.4; görselsizler aktif, placeholder gösterilir) |
| Ürünler | 31 (EAN-13 barkodlu) |
| Fiyat Kaydı | 155 (her ürün × her market) |
| Katalog | 2 |
| Örnek İhbar | 3 |

### Market Şubeleri (OSM)

Ana seed şube eklemez. Gerçek konumlar **OpenStreetMap Overpass API** üzerinden çekilir (İstanbul + Ankara, market başına şehirde en fazla 45 şube):

```bash
cd backend
npm run seed:branches              # önbellek varsa onu kullanır (30 gün)
npm run seed:branches -- --refresh # OSM'den yeniden çeker (~7 dk)
```

Önbellek: `backend/prisma/data/osm-branches-cache.json`

### Ürün Zenginleştirme (Görsel + Detay)

Scraper ürünleri fiyat odaklı ekler. Görseller ve açıklamalar için:

```bash
cd backend
npm run seed:enrich-products              # eksik alanlı ürünler
npm run seed:enrich-products -- --refresh # yeniden çek
npm run seed:enrich-products -- --limit 100
npm run seed:enrich-missing               # görseli hâlâ olmayan ürünler (2. geçiş)
npm run seed:reclassify                   # tüm ürün kategorilerini yeniden belirle
npm run seed:image-pipeline               # Migros+OFF+Trendyol+Gemini AI görsel arama
npm run seed:reactivate                   # yanlış pasife alınmış ürünleri geri aç
```

Kaynaklar (öncelik sırasıyla):
1. **Migros Sanal Market API** — birincil, HD görsel
2. **Open Food Facts** — yedek, barkod tabanlı
3. **DuckDuckGo Görsel** — son çare, marka adı + ürün adıyla

Önbellek: `backend/prisma/data/product-enrichment-cache.json`

---

## API Dökümantasyonu

Tam Swagger dökümantasyonu: **http://localhost:3001/api/docs**

### Temel Endpoint Grupları

```
/api/auth          → Kayıt (OTP), giriş, OTP gönder, token yenileme, şifre değiştirme/sıfırlama (OTP)
/api/products      → Ürün listeleme (kategori/market filtresi), detay, kategoriler, kategori tarama (`GET /category-suggestions`, `POST /apply-categories` — Admin + Market Yöneticisi)
/api/markets       → Market ve şube listeleme/yönetimi (`GET /:id/branches`)
/api/prices        → Fiyat CRUD, geçmiş, geri bildirim, crowdsource bildirim (`POST /submit`), admin kuyruk (`GET /submissions`)
/api/carts         → Sepet işlemleri ve optimizasyon
/api/reports       → SKT ihbarı oluşturma, markete iletme (`PATCH :id/push-to-market`) ve yönetimi
/api/catalogs      → Katalog listeleme/yönetimi
/api/ai            → Sohbet, ürün önerisi, trend analizi
/api/notifications → Kullanıcı bildirimleri
/api/users         → Profil yönetimi ve admin kullanıcı yönetimi
/api/rewards       → İtibar ödülleri (`GET /me`, `POST /me/:id/claim`, admin/market CRUD, manuel kod, talep geçmişi)
/api/admin         → Dashboard istatistikleri ve audit logları
/api/data-sync     → Veri altyapisi durumu, CSV/barkod import, bakim isleri
/api/scraper       → Fiyat scraper durumu + manuel tetikleme (admin)
```

---

## Kullanıcı Rolleri

```
SUPER_ADMIN    → Tam erişim — tüm modüller
ADMIN          → Geniş erişim — kullanıcı yönetimi hariç
INSPECTOR      → İhbar inceleme ve durum güncelleme
MARKET_MANAGER → Sadece kendi marketinin verileri
USER           → Mobil uygulama kullanıcısı
```

### İhbar Durum Makinesi

```
PENDING ──→ UNDER_REVIEW ──→ APPROVED ──→ RESOLVED
                         └──→ REJECTED
```

---

## Ekran Haritası

### Mobil Uygulama (Expo Router)

```
/                       → Ana sayfa (billboard, kategoriler, senin için öneriler, ürünler)
/(tabs)/search          → Ürün arama
/(tabs)/markets         → Market listesi
/(tabs)/cart            → Sepet ve optimizasyon
/(tabs)/profile         → Profil, itibar, kupon özeti, tasarruf, ihbarlar
/coupons                → Kuponlarım (itibar ödülleri, mağaza kullanım uyarısı, dokunarak talep)
/(auth)/login           → Giriş
/(auth)/register        → Kayıt
/(auth)/forgot-password → Şifremi unuttum (e-posta + telefon)
/product/[id]           → Ürün detay, fiyat grafiği, geri bildirim, fiyat takibi
/market/[id]            → Market detay
/catalogs/[id]          → Katalog okuyucu
/reports/create         → İhbar oluşturma (fotoğraf + konum)
/reports/my             → Kendi ihbarlarım
/alerts/my              → Takip edilen ürünler (fiyat uyarıları)
/ai/chat                → AI asistan sohbeti
/scan                   → Barkod tarayıcı (kamera)
/notifications          → Bildirimler ve ihbar durumları
```

### Admin Paneli (Next.js App Router)

```
/                               → Portal seçim ve giriş ekranı
/(admin)/dashboard              → Sistem genel bakış
/(admin)/statistics             → Sistem istatistikleri (tüm ekosistem)
/(admin)/products               → Ürün yönetimi (filtre, sıralama, SKT badge)
/(admin)/products/new           → Yeni ürün ekleme
/(admin)/markets                → Market yönetimi + şube drawer
/(admin)/users                  → Kullanıcı yönetimi
/(admin)/reports                → Tüm ihbarlar
/(admin)/submissions            → Crowdsource fiyat bildirim kuyruğu
/(admin)/rewards                → Topluluk ödülleri (kupon kampanyaları)
/inspector-panel/dashboard      → Denetçi genel bakış
/inspector-panel/statistics     → İhbar inceleme istatistikleri
/inspector-panel/reports        → Bekleyen ihbarlar
/inspector-panel/in-review      → İnceleme altındakiler
/inspector-panel/resolved       → Tamamlananlar
/market-panel/dashboard         → Market yöneticisi genel bakış
/market-panel/statistics        → Market ürün/fiyat/ihbar istatistikleri
/market-panel/reports           → Markete gelen ihbarlar
/market-panel/catalog           → Katalog yönetimi
/market-panel/prices            → Fiyat yönetimi
/market-panel/categories        → Ürün kategorileme (tarama + manuel düzeltme)
/market-panel/branches          → Şube yönetimi
/market-panel/rewards           → Topluluk ödülleri (market kuponları)
```

---

## Mimari

```
┌─────────────────────────────────────────────────────┐
│                   İstemci Katmanı                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Mobil App   │  │ Admin Paneli │  │  Swagger  │  │
│  │ React Native │  │   Next.js    │  │   UI      │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
└─────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ HTTP/REST
          ┌─────────────────▼─────────────────┐
          │         NestJS API (:3001)         │
          │  ┌────────┐  ┌──────────────────┐  │
          │  │  Auth  │  │  Business Modules │  │
          │  │  Guard │  │  (12 modül)      │  │
          │  └────────┘  └──────────────────┘  │
          └──────┬────────────────┬─────────────┘
                 │                │
    ┌────────────▼───┐    ┌───────▼───────┐
    │  PostgreSQL 16 │    │     Redis     │
    │  (Prisma ORM)  │    │  (Cache/Queue)│
    └────────────────┘    └───────────────┘
                 │
    ┌────────────▼───┐    ┌───────────────┐
    │  MinIO (S3)    │    │   Firebase    │
    │  Görsel Depo   │    │  (Push Bildi.)│
    └────────────────┘    └───────────────┘
```

### Önemli Tasarım Kararları

- **Monorepo yapısı:** Backend, admin panel ve mobil aynı repoda. Ortak tipler `shared/` altında.
- **Progressive rendering (Mobil):** Tüm veriler gelene kadar boş ekran yerine, her bölüm kendi skeleton'ını gösterir — kullanıcı sayfa yüklenirken içeriği görür.
- **Responsive tasarım:** `useWindowDimensions()` hook'u ile tüm bileşenler ekran boyutuna göre dinamik ölçeklenir.
- **AI Dual-provider:** OpenAI ve Gemini aynı anda desteklenir. Birinin anahtarı yoksa diğerine geçer.
- **Durum makinesi:** İhbar durum geçişleri backend'de merkezi olarak kontrol edilir — doğrudan `PENDING → RESOLVED` gibi atlama yapılamaz.
- **Etik scraping:** Open Food Facts API (CC BY-SA lisansı) kullanılır. İstekler arasında 3-7 saniye bekleme, User-Agent belirtimi zorunludur.
