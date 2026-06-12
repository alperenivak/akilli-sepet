# ADR 001: Monorepo ve Teknoloji Yığını

**Durum:** Kabul edildi  
**Tarih:** 2026-06-12

## Bağlam

Akıllı Sepet; mobil, admin ve API katmanlarını tek repoda tutar.

## Karar

- Backend: NestJS 11 + Prisma 5 + PostgreSQL 16
- Admin: Next.js 15 App Router + Tailwind
- Mobil: Expo SDK 55 + Zustand + React Query
- Altyapı: Docker Compose (dev), docker-compose.prod.yml (canlı)

## Sonuçlar

- Ortak tip paylaşımı `shared/` paketi ile
- CI ayrı job'lar (backend, admin)
- Deploy: backend Docker, admin Vercel, mobil EAS
