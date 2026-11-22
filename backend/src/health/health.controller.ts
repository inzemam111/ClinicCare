import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/public.decorator';
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Public() @Get() async check() { const result = await this.health.check(); if (result.status !== 'ok') throw new ServiceUnavailableException({ data: result }); return { data: result }; }
}
