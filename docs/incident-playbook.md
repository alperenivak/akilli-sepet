# Olay Müdahale Playbook

## Genel

1. Durumu doğrula: `GET /api/health/ready`
2. Logları kontrol et: `docker logs marketapp_backend_prod --tail 200`
3. Gerekirse yedekten geri yükle (bkz. `scripts/restore-postgres.sh`)

---

## Scraper çöktü / fiyatlar güncellenmiyor

**Belirtiler:** Fiyatlar eski, admin → data-sync loglarında `failed`

**Adımlar:**
1. Admin panel → Veri Sync loglarını kontrol et
2. `docker logs marketapp_backend_prod | grep -i scraper`
3. Geçici: `PRICE_SCRAPER_ENABLED=false` ile scraper'ı durdur
4. Manuel tetikleme: admin data-sync endpoint veya `npm run seed:prices` (sadece dev)
5. Market sitesi yapısı değiştiyse scraper provider güncellemesi gerekir

**Önleme:** Günlük scraper failure alert (admin `data-quality` → `scraper.failuresLast24h`)

---

## PostgreSQL dolu / yavaş

**Belirtiler:** 500 hataları, `database: false` health check

**Adımlar:**
1. Disk: `docker system df` / sunucu `df -h`
2. Yedek al: `.\scripts\backup-postgres.ps1`
3. Eski logları temizle: `audit_logs`, `scraper_logs`, `data_sync_logs` (90 gün+)
4. Connection pool: backend restart `docker compose restart backend`
5. Kritik: managed DB'ye geçiş veya disk genişletme

---

## Redis koptu

**Belirtiler:** `redis: false` health, kuyruk işleri birikiyor

**Adımlar:**
1. `docker compose -f docker-compose.prod.yml restart redis`
2. `REDIS_HOST` / `REDIS_PASSWORD` env doğrula
3. Backend restart
4. BullMQ kuyrukları otomatik yeniden bağlanır

---

## MinIO / görseller açılmıyor

**Adımlar:**
1. MinIO console: `http://sunucu:9001` (prod'da firewall ile kısıtla)
2. Bucket `marketapp` var mı kontrol et
3. `S3_ENDPOINT` backend'de internal URL (`http://minio:9000`) olmalı
4. Public URL CDN veya reverse proxy ile ayrı yapılandırılmalı

---

## API 502 / CORS hatası

**CORS:**
- Production'da `CORS_ORIGINS` env'e admin ve mobil web origin ekleyin
- Vercel admin: `https://admin.yourdomain.com`

**502:**
- Backend container ayakta mı: `docker ps`
- Nginx/reverse proxy upstream doğru mu

---

## Acil geri alma (rollback)

```bash
# Önceki backend image
docker pull ghcr.io/OWNER/REPO/backend:PREVIOUS_SHA
docker compose -f docker-compose.prod.yml up -d backend

# DB geri yükleme (son yedek)
./scripts/restore-postgres.sh backups/postgres_YYYYMMDD.sql.gz
```
