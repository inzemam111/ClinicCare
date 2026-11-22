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
import { AppointmentStatus, PaymentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { DoctorListQueryDto, DoctorScheduleCreateDto, DoctorUpdateDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: DoctorListQueryDto) {
    if (!actor.roles.includes('PATIENT'))
      this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_BOOK]);
    const clinicId = requireClinicId(actor);
    const where: Prisma.DoctorWhereInput = {
      clinicId,
      isActive: true,
      ...(query.search
        ? {
            OR: [
              { specialty: { contains: query.search, mode: 'insensitive' } },
              { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const direction = sortDirection(query.sortOrder);
    const orderBy: Prisma.DoctorOrderByWithRelationInput =
      query.sortBy === 'specialty' ? { specialty: direction } : { createdAt: direction };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.doctor.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true,
            clinicId: true,
            registrationNumber: true,
            specialty: true,
            isActive: true,
            clinicHoursStart: true,
            clinicHoursEnd: true,
            breakStart: true,
            breakEnd: true,
            consultationDuration: true,
            followUpDuration: true,
            dailyMaxAppointments: true,
            appointmentFee: true,
            user: { select: { displayName: true } },
            clinic: { select: { name: true, timezone: true } },
          },
        }),
      () => this.prisma.doctor.count({ where }),
    );
  }

  async get(actor: AuthenticatedUser, id: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, clinicId: requireClinicId(actor) },
      select: {
        id: true,
        clinicId: true,
        registrationNumber: true,
        specialty: true,
        isActive: true,
        clinicHoursStart: true,
        clinicHoursEnd: true,
        breakStart: true,
        breakEnd: true,
        consultationDuration: true,
        followUpDuration: true,
        dailyMaxAppointments: true,
        appointmentFee: true,
        user: { select: { displayName: true } },
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async listSchedules(actor: AuthenticatedUser, doctorId: string) {
    await this.get(actor, doctorId);
    return this.prisma.doctorSchedule.findMany({
      where: { doctorId, clinicId: requireClinicId(actor) },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createSchedule(actor: AuthenticatedUser, doctorId: string, input: DoctorScheduleCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.DOCTOR_CREDENTIAL_MANAGE]);
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (input.startTime >= input.endTime)
      throw new BadRequestException('endTime must be later than startTime');
    if (input.effectiveTo && new Date(input.effectiveFrom) > new Date(input.effectiveTo)) {
      throw new BadRequestException('effectiveTo must be on or after effectiveFrom');
    }
    const existingSchedules = await this.prisma.doctorSchedule.findMany({
      where: { doctorId, clinicId, dayOfWeek: input.dayOfWeek },
      select: { startTime: true, endTime: true, effectiveFrom: true, effectiveTo: true },
    });
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo
      ? new Date(input.effectiveTo)
      : new Date('9999-12-31T00:00:00.000Z');
    const startMinutes =
      Number(input.startTime.slice(0, 2)) * 60 + Number(input.startTime.slice(3));
    const endMinutes = Number(input.endTime.slice(0, 2)) * 60 + Number(input.endTime.slice(3));
    const overlaps = existingSchedules.some((schedule) => {
      const currentStart =
        Number(schedule.startTime.slice(0, 2)) * 60 + Number(schedule.startTime.slice(3));
      const currentEnd =
        Number(schedule.endTime.slice(0, 2)) * 60 + Number(schedule.endTime.slice(3));
      const dateOverlap =
        schedule.effectiveFrom <= effectiveTo &&
        (!schedule.effectiveTo || schedule.effectiveTo >= effectiveFrom);
      return dateOverlap && startMinutes < currentEnd && endMinutes > currentStart;
    });
    if (overlaps)
      throw new BadRequestException('The schedule overlaps an existing doctor schedule');
    return this.prisma.doctorSchedule.create({
      data: {
        clinicId,
        doctorId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotMinutes: input.slotMinutes,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      },
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: DoctorUpdateDto) {
    this.authorization.assertPermissions(actor, [Permissions.DOCTOR_CREDENTIAL_MANAGE]);
    const existing = await this.prisma.doctor.findFirst({
      where: { id, clinicId: requireClinicId(actor) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Doctor not found');
    return this.prisma.doctor.update({
      where: { id },
      data: {
        ...(input.specialty === undefined ? {} : { specialty: input.specialty }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(input.clinicHoursStart === undefined
          ? {}
          : { clinicHoursStart: input.clinicHoursStart }),
        ...(input.clinicHoursEnd === undefined ? {} : { clinicHoursEnd: input.clinicHoursEnd }),
        ...(input.breakStart === undefined ? {} : { breakStart: input.breakStart }),
        ...(input.breakEnd === undefined ? {} : { breakEnd: input.breakEnd }),
        ...(input.consultationDuration === undefined
          ? {}
          : { consultationDuration: input.consultationDuration }),
        ...(input.followUpDuration === undefined
          ? {}
          : { followUpDuration: input.followUpDuration }),
        ...(input.dailyMaxAppointments === undefined
          ? {}
          : { dailyMaxAppointments: input.dailyMaxAppointments }),
        ...(input.appointmentFee === undefined
          ? {}
          : { appointmentFee: new Prisma.Decimal(input.appointmentFee) }),
      },
      select: {
        id: true,
        clinicId: true,
        registrationNumber: true,
        specialty: true,
        isActive: true,
        clinicHoursStart: true,
        clinicHoursEnd: true,
        breakStart: true,
        breakEnd: true,
        consultationDuration: true,
        followUpDuration: true,
        dailyMaxAppointments: true,
        appointmentFee: true,
        updatedAt: true,
      },
    });
  }

  async dashboard(actor: AuthenticatedUser) {
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { clinicId, userId: actor.id, isActive: true },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalPatients,
      newPatients,
      todaysAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      todayIncome,
      monthlyIncome,
      pendingPayments,
      monthlyExpenses,
      incomeEntries,
      expenseEntries,
      appointmentEntries,
      patientEntries,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { clinicId, deletedAt: null } }),
      this.prisma.patient.count({
        where: { clinicId, deletedAt: null, createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.appointment.count({
        where: { clinicId, doctorId: doctor.id, startsAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.appointment.count({
        where: {
          clinicId,
          doctorId: doctor.id,
          startsAt: { gte: now },
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN] },
        },
      }),
      this.prisma.appointment.count({
        where: { clinicId, doctorId: doctor.id, status: AppointmentStatus.COMPLETED },
      }),
      this.prisma.appointment.count({
        where: { clinicId, doctorId: doctor.id, status: AppointmentStatus.CANCELLED },
      }),
      this.prisma.incomeEntry.aggregate({
        where: { clinicId, occurredAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.incomeEntry.aggregate({
        where: { clinicId, occurredAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { clinicId, status: PaymentStatus.PENDING },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.aggregate({
        where: { clinicId, occurredAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      this.prisma.incomeEntry.findMany({
        where: { clinicId, occurredAt: { gte: chartStart } },
        select: { amount: true, occurredAt: true },
      }),
      this.prisma.expense.findMany({
        where: { clinicId, occurredAt: { gte: chartStart } },
        select: { amount: true, occurredAt: true },
      }),
      this.prisma.appointment.findMany({
        where: { clinicId, doctorId: doctor.id, startsAt: { gte: chartStart } },
        select: { startsAt: true, status: true },
      }),
      this.prisma.patient.findMany({
        where: { clinicId, deletedAt: null, createdAt: { gte: chartStart } },
        select: { createdAt: true },
      }),
    ]);

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString('en-US', { month: 'short' }),
      };
    });
    const chart = months.map(({ key, label }) => {
      const [year, month] = key.split('-').map(Number);
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 1);
      const income = incomeEntries
        .filter((entry) => entry.occurredAt >= from && entry.occurredAt < to)
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const expenses = expenseEntries
        .filter((entry) => entry.occurredAt >= from && entry.occurredAt < to)
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const appointments = appointmentEntries.filter(
        (entry) => entry.startsAt >= from && entry.startsAt < to,
      ).length;
      const patientGrowth = patientEntries.filter(
        (entry) => entry.createdAt >= from && entry.createdAt < to,
      ).length;
      return { label, income, expenses, appointments, patientGrowth };
    });

    const todayCollections = todayIncome._sum.amount?.toFixed(2) ?? '0.00';
    const monthlyCollections = monthlyIncome._sum.amount?.toFixed(2) ?? '0.00';
    const monthlyExpense = monthlyExpenses._sum.amount?.toFixed(2) ?? '0.00';
    const pending = pendingPayments._sum.amount?.toFixed(2) ?? '0.00';
    const net = (Number(monthlyCollections) - Number(monthlyExpense)).toFixed(2);

    return {
      doctorId: doctor.id,
      metrics: {
        totalPatients,
        newPatients,
        todaysAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments,
        todayCollections,
        monthlyCollections,
        pendingPayments: pending,
        pendingPaymentCount: pendingPayments._count._all,
        monthlyExpenses: monthlyExpense,
        netOperatingSurplus: net,
      },
      charts: {
        monthlyIncome: chart,
        appointmentTrends: chart,
        patientGrowth: chart,
        incomeVsExpenses: chart,
      },
    };
  }
}

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}
  @Get('dashboard')
  @ApiOperation({ summary: 'Get authenticated doctor dashboard metrics and charts' })
  dashboard(@CurrentUser() actor: AuthenticatedUser) {
    return this.doctors.dashboard(actor);
  }
  @Get()
  @ApiOperation({ summary: 'List active doctors in the current clinic' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: DoctorListQueryDto) {
    return this.doctors.list(actor, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a doctor in the current clinic' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.doctors.get(actor, id);
  }
  @Get(':id/schedules')
  @ApiOperation({ summary: 'List clinic schedule windows for a doctor' })
  listSchedules(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.doctors.listSchedules(actor, id);
  }
  @Post(':id/schedules')
  @RequirePermissions(Permissions.DOCTOR_CREDENTIAL_MANAGE)
  @ApiOperation({ summary: 'Add a clinic schedule window for a doctor' })
  createSchedule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DoctorScheduleCreateDto,
  ) {
    return this.doctors.createSchedule(actor, id, input);
  }
  @Put(':id')
  @RequirePermissions(Permissions.DOCTOR_CREDENTIAL_MANAGE)
  @ApiOperation({ summary: 'Update doctor clinic profile' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DoctorUpdateDto,
  ) {
    return this.doctors.update(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
})
export class DoctorsModule {}
