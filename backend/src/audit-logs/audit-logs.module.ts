import { BadRequestException, Injectable, Module } from '@nestjs/common';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { DateRangeQueryDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}
  async list(actor: AuthenticatedUser, query: DateRangeQueryDto) {
    const platformAdmin = actor.roles.includes('PLATFORM_ADMIN');
    if (platformAdmin) this.authorization.assertPermissions(actor, [Permissions.PLATFORM_ADMIN]);
    else this.authorization.assertPermissions(actor, [Permissions.AUDIT_READ]);
    const clinicId = platformAdmin ? undefined : requireClinicId(actor);
    if (!platformAdmin && query.clinicId && query.clinicId !== clinicId)
      this.authorization.assertClinicScope(actor, query.clinicId);
    if (query.from && query.to && new Date(query.from) >= new Date(query.to)) {
      throw new BadRequestException('from must be earlier than to');
    }
    const where: Prisma.AuditLogWhereInput = {
      ...(query.clinicId ? { clinicId: query.clinicId } : clinicId ? { clinicId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: sortDirection(query.sortOrder) },
          skip,
          take,
          select: {
            id: true,
            clinicId: true,
            actorId: true,
            action: true,
            entityType: true,
            entityId: true,
            createdAt: true,
          },
        }),
      () => this.prisma.auditLog.count({ where }),
    );
  }
}

@ApiTags('Audit logs')
@ApiBearerAuth()
@Controller('audit-logs')
class AuditLogsController {
  constructor(private readonly audits: AuditLogsService) {}
  @Get()
  @ApiOperation({ summary: 'List audit events visible to the authenticated user' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: DateRangeQueryDto) {
    return this.audits.list(actor, query);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
})
export class AuditLogsModule {}
