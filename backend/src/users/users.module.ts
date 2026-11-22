import { Injectable, Module, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { Controller, Get, Param, Put, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { UserUpdateDto, UsersListQueryDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: UsersListQueryDto) {
    this.authorization.assertPermissions(actor, [Permissions.USER_MANAGE]);
    const clinicId = requireClinicId(actor);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: { some: { clinicId } },
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sortBy === 'displayName'
        ? { displayName: sortDirection(query.sortOrder) }
        : query.sortBy === 'email'
          ? { email: sortDirection(query.sortOrder) }
          : { createdAt: sortDirection(query.sortOrder) };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.user.findMany({
          where,
          orderBy,
          skip,
          take,
          select: { id: true, email: true, displayName: true, status: true, createdAt: true },
        }),
      () => this.prisma.user.count({ where }),
    );
  }

  async get(actor: AuthenticatedUser, id: string) {
    if (actor.id !== id) {
      this.authorization.assertPermissions(actor, [Permissions.USER_MANAGE]);
    }
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(actor.id === id ? {} : { roles: { some: { clinicId: requireClinicId(actor) } } }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true, name: true } }, clinicId: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(actor: AuthenticatedUser, id: string, input: UserUpdateDto) {
    if (actor.id !== id) this.authorization.assertPermissions(actor, [Permissions.USER_MANAGE]);
    if (actor.id !== id) {
      const clinicId = requireClinicId(actor);
      const existing = await this.prisma.user.findFirst({
        where: { id, roles: { some: { clinicId } }, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('User not found');
    }
    const user = await this.prisma.user
      .update({
        where: { id },
        data: {
          ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
          ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() }),
        },
        select: { id: true, email: true, displayName: true, status: true, updatedAt: true },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')
          throw new NotFoundException('User not found');
        throw error;
      });
    return user;
  }
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.get(actor, actor.id);
  }
  @Get()
  @RequirePermissions(Permissions.USER_MANAGE)
  @ApiOperation({ summary: 'List clinic users' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: UsersListQueryDto) {
    return this.users.list(actor, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a user in the current clinic or the authenticated profile' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(actor, id);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update a user profile' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UserUpdateDto,
  ) {
    return this.users.update(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
