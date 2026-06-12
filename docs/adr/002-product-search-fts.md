# ADR 002: Ürün Aramasında PostgreSQL Full-Text Search

**Durum:** Kabul edildi  
**Tarih:** 2026-06-12

## Bağlam

`ILIKE %term%` araması yavaş, alakasız sonuçlar ("elma" + "elma suyu") ve ölçeklenemiyor.

## Karar

- `products.search_vector` tsvector kolonu + GIN indeks
- Türkçe `plainto_tsquery` (çok kelimede AND mantığı)
- `ts_rank` ile relevance sıralaması
- Market adı ve barkod için ek OR koşulları
- FTS hata verirse mevcut ILIKE fallback

## Reddedilen alternatifler

- Elasticsearch / Meilisearch: ek operasyon yükü, mezuniyet projesi için fazla
- Sadece ILIKE: performans ve kalite yetersiz
