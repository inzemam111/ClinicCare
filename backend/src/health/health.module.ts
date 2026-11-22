import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
@Module({
  imports: [InfrastructureModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
