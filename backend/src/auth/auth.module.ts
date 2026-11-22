import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { AuthGuard } from './auth.guard';
import { AuthRateLimitGuard } from './rate-limit.guard';
import { AuthorizationModule } from '../authorization/authorization.module';
@Module({ imports: [AuthorizationModule], controllers: [AuthController], providers: [AuthService, JwtService, AuthGuard, AuthRateLimitGuard], exports: [AuthService, AuthGuard, JwtService] })
export class AuthModule {}
