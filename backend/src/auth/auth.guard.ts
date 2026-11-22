import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../infrastructure/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtService } from './jwt.service';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context
      .switchToHttp()
      .getRequest<{
        headers: Record<string, string | undefined>;
        originalUrl?: string;
        user?: unknown;
      }>();
    if (request.originalUrl?.startsWith('/api/v1/docs')) return true;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Bearer token required');
    const claims = this.jwt.verify(token);
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: { select: { status: true, deletedAt: true, staff: { select: { isActive: true } } } } },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.clinicId !== (claims.cid ?? null) ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt ||
      session.user.staff?.isActive === false
    )
      throw new UnauthorizedException('Session is not valid');
    request.user = {
      id: claims.sub,
      sessionId: claims.sid,
      clinicId: claims.cid,
      roles: claims.roles,
      permissions: claims.permissions,
      mfaVerified: claims.mfa,
    };
    return true;
  }
}
