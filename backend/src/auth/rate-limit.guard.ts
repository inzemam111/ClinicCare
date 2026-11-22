import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RedisService } from '../infrastructure/redis.service';
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ ip?: string; body?: { email?: string } }>();
    const discriminator = `${request.ip ?? 'unknown'}:${request.body?.email?.toLowerCase() ?? 'anonymous'}`;
    const count = await this.redis.incrementWithExpiry(`auth:attempt:${discriminator}`, 60);
    if (count > 10)
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
