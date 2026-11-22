import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@cliniccare/shared-types';
import { PrismaService } from '../infrastructure/prisma.service';
import { RedisService } from '../infrastructure/redis.service';
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([this.prisma.ping(), this.redis.ping()]);
    return { status: database && redis ? 'ok' : 'degraded', timestamp: new Date().toISOString(), services: { database, redis } };
  }
}
