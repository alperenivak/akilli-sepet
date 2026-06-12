# Canlı Ortam Dağıtım Rehberi

## Mimari Özet

| Bileşen | Önerilen platform | URL örneği |
|---------|-------------------|------------|
| **Backend API** | VPS + Docker veya Railway/Render | `https://api.yourdomain.com` |
| **Admin Panel** | Vercel | `https://admin.yourdomain.com` |
| **Mobil Uygulama** | Expo EAS Build | App Store / Play Store |
| **PostgreSQL** | Docker (prod compose) veya managed DB | — |
| **Redis** | Docker veya Upstash | — |
| **MinIO / S3** | Docker veya AWS S3 / Cloudflare R2 | — |

## 1. Backend (Docker)

```bash
cp .env.docker.example .env.docker
# .env.docker içindeki TÜM CHANGE_ME değerlerini güçlü şifrelerle değiştirin

docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

Health kontrolü:
- `GET https://api.yourdomain.com/api/health/live`
- `GET https://api.yourdomain.com/api/health/ready`

## 2. Admin Panel (Vercel)

1. [vercel.com](https://vercel.com) → New Project → `admin-panel` klasörü
2. **Environment Variables:**

| Değişken | Değer |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `BACKEND_URL` | `https://api.yourdomain.com` |

3. GitHub Secrets (otomatik deploy için):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `BACKEND_URL`

Vercel rewrite'ları `/api/*` isteklerini backend'e proxy eder (`next.config.ts`).

## 3. Mobil (Expo EAS)

```bash
cd mobile
npm install -g eas-cli
eas login
eas init   # projectId alın, app.json extra.eas.projectId güncelleyin
```

`eas.json` içinde `EXPO_PUBLIC_API_URL` değerini production API URL'niz ile güncelleyin.

```bash
# Android APK (test)
eas build --platform android --profile preview

# Production (store)
eas build --platform all --profile production
eas submit --platform all --profile production
```

GitHub Secret: `EXPO_TOKEN` (expo.dev → Access Tokens)

## 4. GitHub Secrets Özeti

| Secret | Açıklama |
|--------|----------|
| `JWT_SECRET` | Backend JWT (min 32 karakter) |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `DATABASE_URL` | Production PostgreSQL connection string |
| `REDIS_PASSWORD` | Redis şifresi |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO veya S3 |
| `CORS_ORIGINS` | `https://admin.yourdomain.com` |
| `VERCEL_TOKEN` | Vercel deploy |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | Vercel proje |
| `BACKEND_URL` | Admin proxy hedefi |
| `EXPO_TOKEN` | EAS build |
| `EXPO_PUBLIC_API_URL` | Mobil production API |

## 5. DNS

```
api.yourdomain.com     → Backend sunucu IP / load balancer
admin.yourdomain.com   → Vercel (CNAME cname.vercel-dns.com)
```

## 6. İlk Kurulum Sonrası

```bash
docker exec marketapp_backend_prod npx prisma migrate deploy
# veya container CMD zaten migrate deploy çalıştırır
```
