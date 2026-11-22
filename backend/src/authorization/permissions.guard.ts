import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AuthorizationService } from './authorization.service';
import type { AuthenticatedUser } from '../auth/auth.types';
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authorization: AuthorizationService) {}
  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!permissions.length) return true;
    this.authorization.assertPermissions(context.switchToHttp().getRequest().user as AuthenticatedUser, permissions);
    return true;
  }
}
