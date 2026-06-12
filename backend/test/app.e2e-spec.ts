import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Akıllı Sepet API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api — health (hello)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200);
  });

  it('GET /api/products — ürün listesi', () => {
    return request(app.getHttpServer())
      .get('/api/products?limit=5&isActive=true')
      .expect(200)
      .expect((res) => {
        const body = res.body.data ?? res.body;
        expect(body).toHaveProperty('items');
        expect(Array.isArray(body.items)).toBe(true);
      });
  });

  it('POST /api/auth/login — geçersiz kimlik bilgisi 401', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'invalid@test.com', password: 'wrong' })
      .expect(401);
  });
});
