import {
  ForbiddenException,
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
import { NotificationCreateDto, NotificationListQueryDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: NotificationListQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(actor.clinicId ? { clinicId: actor.clinicId } : {}),
      ...(query.unreadOnly === 'true' ? { readAt: null } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: sortDirection(query.sortOrder) },
          skip,
          take,
          select: {
            id: true,
            channel: true,
            subject: true,
            body: true,
            sentAt: true,
            readAt: true,
            createdAt: true,
          },
        }),
      () => this.prisma.notification.count({ where }),
    );
  }

  async create(actor: AuthenticatedUser, input: NotificationCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.NOTIFICATION_MANAGE]);
    const clinicId = requireClinicId(actor);
    if (input.clinicId && input.clinicId !== clinicId)
      throw new ForbiddenException('Cross-clinic notifications are forbidden');
    const recipient = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null, roles: { some: { clinicId } } },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found in the current clinic');
    return this.prisma.notification.create({
      data: {
        userId: recipient.id,
        clinicId,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
      },
      select: { id: true, userId: true, channel: true, subject: true, createdAt: true },
    });
  }

  async markRead(actor: AuthenticatedUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: actor.id, ...(actor.clinicId ? { clinicId: actor.clinicId } : {}) },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get()
  @ApiOperation({ summary: 'List the authenticated user notifications' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: NotificationListQueryDto) {
    return this.notifications.list(actor, query);
  }
  @Post()
  @RequirePermissions(Permissions.NOTIFICATION_MANAGE)
  @ApiOperation({ summary: 'Send a clinic notification' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: NotificationCreateDto) {
    return this.notifications.create(actor, input);
  }
  @Put(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(actor, id);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
