import {
  BadRequestException,
  Injectable,
  Module,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthModule } from '../auth/auth.module';
import { AuthService, receptionistPermissionCodes } from '../auth/auth.service';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import {
  StaffCreateDto,
  StaffListQueryDto,
  StaffPermissionsUpdateDto,
  StaffUpdateDto,
} from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly auth: AuthService,
  ) {}
  create(actor: AuthenticatedUser, input: StaffCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.STAFF_PERMISSION_MANAGE]);
    return this.auth.createReceptionist({ ...input, clinicId: requireClinicId(actor) });
  }
  async list(actor: AuthenticatedUser, query: StaffListQueryDto) {
    this.authorization.assertPermissions(actor, [Permissions.STAFF_PERMISSION_MANAGE]);
    const where: Prisma.StaffWhereInput = {
      clinicId: requireClinicId(actor),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.StaffOrderByWithRelationInput =
      query.sortBy === 'title'
        ? { title: sortDirection(query.sortOrder) }
        : { createdAt: sortDirection(query.sortOrder) };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.staff.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true,
            title: true,
            isActive: true,
            createdAt: true,
            user: { select: { id: true, email: true, displayName: true, status: true } },
            permissions: { select: { permission: { select: { code: true } } } },
          },
        }),
      () => this.prisma.staff.count({ where }),
    );
  }
  async update(actor: AuthenticatedUser, id: string, input: StaffUpdateDto) {
    this.authorization.assertPermissions(actor, [Permissions.STAFF_PERMISSION_MANAGE]);
    const existing = await this.prisma.staff.findFirst({
      where: { id, clinicId: requireClinicId(actor) },
      select: { id: true, userId: true },
    });
    if (!existing) throw new NotFoundException('Staff member not found');
    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
      select: { id: true, title: true, isActive: true, updatedAt: true },
    });
    if (input.isActive === false) await this.auth.revokeAll(existing.userId);
    return updated;
  }
  async setPermissions(actor: AuthenticatedUser, id: string, input: StaffPermissionsUpdateDto) {
    this.authorization.assertPermissions(actor, [Permissions.STAFF_PERMISSION_MANAGE]);
    const requested = [...new Set(input.permissions)];
    if (requested.some((code) => !receptionistPermissionCodes.includes(code as never)))
      throw new BadRequestException('Only receptionist operational permissions can be assigned');
    const existing = await this.prisma.staff.findFirst({
      where: { id, clinicId: requireClinicId(actor) },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    if (!existing) throw new NotFoundException('Staff member not found');
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: requested } },
      select: { id: true, code: true },
    });
    if (permissions.length !== requested.length)
      throw new BadRequestException('Unknown permission code');
    await this.prisma.$transaction(async (db) => {
      await db.staffPermission.deleteMany({ where: { staffId: existing.id } });
      await db.staffPermission.createMany({
        data: permissions.map((permission) => ({
          staffId: existing.id,
          permissionId: permission.id,
        })),
      });
      await db.auditLog.create({
        data: {
          clinicId: requireClinicId(actor),
          actorId: actor.id,
          action: 'STAFF_PERMISSIONS_UPDATED',
          entityType: 'Staff',
          entityId: existing.id,
          before: { permissions: existing.permissions.map(({ permission }) => permission.code) },
          after: { permissions: requested },
        },
      });
    });
    await this.auth.revokeAll(existing.userId);
    return { id: existing.id, permissions: requested };
  }
}

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
@RequirePermissions(Permissions.STAFF_PERMISSION_MANAGE)
class StaffController {
  constructor(private readonly staff: StaffService) {}
  @Post('receptionist')
  @ApiOperation({ summary: 'Create a receptionist account in the current clinic' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: StaffCreateDto) {
    return this.staff.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List clinic staff' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: StaffListQueryDto) {
    return this.staff.list(actor, query);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update a staff member profile' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: StaffUpdateDto,
  ) {
    return this.staff.update(actor, id, input);
  }
  @Put(':id/permissions')
  @ApiOperation({ summary: "Configure an individual receptionist's operational permissions" })
  setPermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: StaffPermissionsUpdateDto,
  ) {
    return this.staff.setPermissions(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
