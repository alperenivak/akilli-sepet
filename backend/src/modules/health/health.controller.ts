import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../config/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Liveness — process ayakta mı */
  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness — DB + Redis bağlantısı */
  @Public()
  @Get('ready')
  async ready() {
    const checks: Record<string, boolean> = { database: false, redis: false };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    } finally {
      redis.disconnect();
    }

    const ok = checks.database && checks.redis;
    const body = { status: ok ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };

    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }

  /** Kısa özet (load balancer / uptime monitor) */
  @Public()
  @Get()
  async summary() {
    try {
      return await this.ready();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        return err.getResponse();
      }
      throw err;
    }
  }
}
