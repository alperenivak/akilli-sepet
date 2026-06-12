/**
 * Migros canli veri cekimini manuel calistirir.
 * Kullanim: npx ts-node -r tsconfig-paths/register scripts/run-migros-sync.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PriceScraperService } from '../src/modules/scraper/price-scraper.service';
import { PrismaService } from '../src/config/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const scraper = app.get(PriceScraperService);

  await prisma.market.updateMany({
    where: { slug: 'migros' },
    data: { scraperEnabled: true },
  });

  const migros = await prisma.market.findFirst({ where: { slug: 'migros' } });
  if (!migros) {
    console.error('Migros market kaydi bulunamadi — once seed calistirin.');
    process.exit(1);
  }

  console.log('Migros canli veri cekimi basliyor...');
  const result = await scraper.runForMarket(migros.id);
  console.log(JSON.stringify(result, null, 2));

  const activeCount = await prisma.product.count({ where: { isActive: true } });
  console.log(`Aktif urun sayisi: ${activeCount}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
