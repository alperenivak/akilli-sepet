# ADR 003: Canlı Dağıtım Topolojisi

**Durum:** Kabul edildi  
**Tarih:** 2026-06-12

## Karar

| Katman | Platform | Gerekçe |
|--------|----------|---------|
| API + DB + Redis + MinIO | Docker (VPS) | Cron, BullMQ, uzun süreli process |
| Admin | Vercel | Next.js native, CDN, kolay SSL |
| Mobil | Expo EAS | Store build/signing |

Admin `/api` isteklerini Vercel rewrite ile backend'e proxy eder; tarayıcıda CORS sorunu olmaz.

## Güvenlik

- Production şifreleri `.env.docker` / GitHub Secrets
- CORS whitelist (`CORS_ORIGINS`)
- JWT ayrı secret'lar
- Audit log admin/market manager mutasyonları
