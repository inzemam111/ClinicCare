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
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { ClinicCreateDto, ClinicListQueryDto, ClinicUpdateDto } from '../common/domain.dto';
import { paginate, sortDirection } from '../common/pagination.dto';
import { requireClinicId } from '../common/clinic-scope';
import { PrismaService } from '../infrastructure/prisma.service';

function validateTimezone(timezone: string | undefined): void {
  if (!timezone) return;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new BadRequestException('timezone must be a valid IANA timezone');
  }
}

@Injectable()
class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: ClinicListQueryDto) {
    const platformAdmin = actor.roles.includes('PLATFORM_ADMIN');
    if (platformAdmin) this.authorization.assertPermissions(actor, [Permissions.PLATFORM_ADMIN]);
    const where: Prisma.ClinicWhereInput = {
      deletedAt: null,
      ...(platformAdmin ? {} : { id: requireClinicId(actor) }),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const orderBy: Prisma.ClinicOrderByWithRelationInput =
      query.sortBy === 'name'
        ? { name: sortDirection(query.sortOrder) }
        : { createdAt: sortDirection(query.sortOrder) };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.clinic.findMany({
          where,
          orderBy,
          skip,
          take,
          select: { id: true, name: true, slug: true, timezone: true, createdAt: true },
        }),
      () => this.prisma.clinic.count({ where }),
    );
  }

  async get(actor: AuthenticatedUser, id: string) {
    const platformAdmin = actor.roles.includes('PLATFORM_ADMIN');
    if (platformAdmin) this.authorization.assertPermissions(actor, [Permissions.PLATFORM_ADMIN]);
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: platformAdmin || actor.clinicId === id ? id : '', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async create(actor: AuthenticatedUser, input: ClinicCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.PLATFORM_ADMIN]);
    validateTimezone(input.timezone);
    return this.prisma.clinic.create({
      data: input,
      select: { id: true, name: true, slug: true, timezone: true, createdAt: true },
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: ClinicUpdateDto) {
    if (actor.roles.includes('PLATFORM_ADMIN')) {
      this.authorization.assertPermissions(actor, [Permissions.PLATFORM_ADMIN]);
    } else {
      this.authorization.assertPermissions(actor, [Permissions.CLINIC_MANAGE]);
      this.authorization.assertClinicScope(actor, id);
    }
    validateTimezone(input.timezone);
    const existing = await this.prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Clinic not found');
    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      },
      select: { id: true, name: true, slug: true, timezone: true, updatedAt: true },
    });
  }
}

@ApiTags('Clinics')
@ApiBearerAuth()
@Controller('clinics')
class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}
  @Post()
  @RequirePermissions(Permissions.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Create a clinic' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: ClinicCreateDto) {
    return this.clinics.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List clinics visible to the authenticated user' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ClinicListQueryDto) {
    return this.clinics.list(actor, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a clinic' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.clinics.get(actor, id);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update a clinic' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ClinicUpdateDto,
  ) {
    return this.clinics.update(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [ClinicsController],
  providers: [ClinicsService],
})
export class ClinicsModule {}
