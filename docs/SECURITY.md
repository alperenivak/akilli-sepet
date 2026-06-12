# Akıllı Sepet — Güvenlik Özeti

Bu belge projede uygulanan temel güvenlik kontrollerini özetler.

## Kimlik Doğrulama ve Yetkilendirme

- **JWT** access + refresh token akışı (`@nestjs/jwt`, `passport-jwt`)
- Rol tabanlı erişim: `JwtAuthGuard` + `RolesGuard` + `@Roles()` dekoratörü
- Yasaklı kullanıcılar (`bannedUntil`) JWT doğrulamasında `403 USER_BANNED` ile engellenir
- Public endpoint'ler `@Public()` ile işaretlenir; diğerleri varsayılan olarak korumalıdır

## HTTP Güvenliği

- **Helmet** — güvenlik başlıkları (`backend/src/main.ts`)
- **CORS** — yalnızca tanımlı origin listesi (admin, Expo, env URL'leri)
- **Throttler** — istek hız sınırlama (`@nestjs/throttler`)
- **Compression** — yanıt sıkıştırma
- Global **ValidationPipe**: `whitelist`, `forbidNonWhitelisted`, DTO doğrulama

## Veri Katmanı

- **Prisma ORM** — parametreli sorgular; ham SQL enjeksiyon riski azaltılır
- Şifreler **bcrypt** ile hash'lenir
- Dosya yükleme MinIO/S3 üzerinden; doğrudan disk erişimi yok

## API Tasarımı

- Global prefix: `/api`
- Standart hata yanıtları: `HttpExceptionFilter`
- Swagger yalnızca `NODE_ENV !== production` iken açık

## Mobil ve Admin

- Token'lar mobilde `expo-secure-store` ile saklanır
- Admin paneli Axios interceptor ile 401'de oturumu sonlandırır

## Önerilen Üretim Kontrolleri

- `JWT_SECRET` ve veritabanı şifrelerini güçlü, benzersiz değerlerle değiştirin
- HTTPS (nginx / reverse proxy TLS termination)
- Firebase ve MinIO anahtarlarını secret manager'da tutun
- Rate limit ve log izleme (mevcut `LoggingInterceptor` + harici SIEM)

## Bilinen Sınırlamalar

- FCM yapılandırması yoksa push bildirimler yalnızca veritabanına yazılır
- Yerel geliştirmede MinIO varsayılan kimlik bilgileri kullanılır — üretimde değiştirin
