import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, map, Observable, mergeMap } from 'rxjs';
import { PrismaService } from '../infrastructure/prisma.service';

interface AuditRequest {
  id?: string;
  method?: string;
  originalUrl?: string;
  route?: { path?: string };
  params?: Record<string, string>;
  user?: { id: string; clinicId?: string };
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = request.method?.toUpperCase();
    const actor = request.user;
    if (!actor || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method ?? '')) return next.handle();
    const route = request.route?.path ?? request.originalUrl ?? '/unknown';
    const entityType =
      route
        .split('?')[0]
        .split('/')
        .filter((segment) => segment && segment !== 'api' && segment !== 'v1')[0] ?? 'unknown';
    return next.handle().pipe(
      mergeMap((result) =>
        from(
          this.prisma.auditLog.create({
            data: {
              actorId: actor.id,
              clinicId: actor.clinicId,
              action: method!,
              entityType,
              entityId: request.params?.id,
              after: { requestId: request.id ?? null },
            },
            select: { id: true },
          }),
        ).pipe(map(() => result)),
      ),
    );
  }
}
