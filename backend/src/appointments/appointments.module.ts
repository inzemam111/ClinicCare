import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  AppointmentCreateDto,
  AppointmentListQueryDto,
  AppointmentUpdateDto,
  AvailabilityQueryDto,
  HolidayCreateDto,
} from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

function localTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = localAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const interpretedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    candidate = localAsUtc - (interpretedUtc - candidate);
  }
  return new Date(candidate);
}

function localDateAndTime(
  value: Date,
  timeZone: string,
): { date: string; time: string; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const time = `${values.hour}:${values.minute}`;
  return { date, time, dayOfWeek: new Date(`${date}T12:00:00.000Z`).getUTCDay() };
}

function isWithinSchedule(
  startsAt: Date,
  endsAt: Date,
  timezone: string,
  schedules: Array<{ startTime: string; endTime: string; slotMinutes: number }>,
): boolean {
  const start = localDateAndTime(startsAt, timezone);
  const end = localDateAndTime(endsAt, timezone);
  if (
    start.date !== end.date ||
    startsAt.getTime() % 60_000 !== 0 ||
    endsAt.getTime() % 60_000 !== 0
  )
    return false;
  const startMinutes = Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3));
  const endMinutes = Number(end.time.slice(0, 2)) * 60 + Number(end.time.slice(3));
  const durationMinutes = endMinutes - startMinutes;
  return schedules.some((schedule) => {
    const [scheduleStartHour, scheduleStartMinute] = schedule.startTime.split(':').map(Number);
    const [scheduleEndHour, scheduleEndMinute] = schedule.endTime.split(':').map(Number);
    const scheduleStart = scheduleStartHour * 60 + scheduleStartMinute;
    const scheduleEnd = scheduleEndHour * 60 + scheduleEndMinute;
    return (
      startMinutes >= scheduleStart &&
      endMinutes <= scheduleEnd &&
      (startMinutes - scheduleStart) % schedule.slotMinutes === 0 &&
      durationMinutes > 0 &&
      durationMinutes % schedule.slotMinutes === 0
    );
  });
}

@Injectable()
class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: AppointmentListQueryDto) {
    const isPatient = actor.roles.includes('PATIENT');
    if (!isPatient) this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_BOOK]);
    const clinicId = requireClinicId(actor);
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException('from must be earlier than to');
    if (isPatient && query.patientId) {
      const own = await this.prisma.patient.findFirst({
        where: { id: query.patientId, userId: actor.id, clinicId },
        select: { id: true },
      });
      if (!own) throw new NotFoundException('Patient not found');
    }
    const where: Prisma.AppointmentWhereInput = {
      clinicId,
      ...(isPatient ? { patient: { userId: actor.id } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const orderBy: Prisma.AppointmentOrderByWithRelationInput = {
      startsAt: sortDirection(query.sortOrder),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.appointment.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            patient: {
              select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true },
            },
            doctor: {
              select: { id: true, specialty: true, user: { select: { displayName: true } } },
            },
          },
        }),
      () => this.prisma.appointment.count({ where }),
    );
  }

  async availability(actor: AuthenticatedUser, query: AvailabilityQueryDto) {
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: query.doctorId, clinicId, isActive: true },
      select: { id: true, clinic: { select: { timezone: true } } },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    const date = new Date(`${query.date}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== query.date)
      throw new BadRequestException('Invalid date');
    const dayOfWeek = date.getUTCDay();
    const [year, month, day] = query.date.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    const startOfDay = localTimeToUtc(query.date, '00:00', doctor.clinic.timezone);
    const endOfDay = localTimeToUtc(nextDate, '00:00', doctor.clinic.timezone);
    const holiday = await this.prisma.clinicHoliday.findUnique({
      where: { clinicId_date: { clinicId, date: new Date(`${query.date}T00:00:00.000Z`) } },
      select: { id: true },
    });
    if (holiday) return { date: query.date, timezone: doctor.clinic.timezone, slots: [] };
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId: doctor.id,
        clinicId,
        dayOfWeek,
        effectiveFrom: { lte: startOfDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startOfDay } }],
      },
      orderBy: { startTime: 'asc' },
    });
    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        clinicId,
        status: { not: AppointmentStatus.CANCELLED },
        startsAt: { lt: endOfDay },
        endsAt: { gt: startOfDay },
      },
      select: { startsAt: true, endsAt: true },
    });
    const slots: Array<{ startsAt: string; endsAt: string }> = [];
    for (const schedule of schedules) {
      const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
      const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
      let slot = localTimeToUtc(
        query.date,
        `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
        doctor.clinic.timezone,
      );
      const end = localTimeToUtc(
        query.date,
        `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        doctor.clinic.timezone,
      );
      while (slot.getTime() + schedule.slotMinutes * 60_000 <= end.getTime()) {
        const slotEnd = new Date(slot.getTime() + schedule.slotMinutes * 60_000);
        if (!booked.some((booking) => booking.startsAt < slotEnd && booking.endsAt > slot)) {
          slots.push({ startsAt: slot.toISOString(), endsAt: slotEnd.toISOString() });
        }
        slot = slotEnd;
      }
    }
    return { date: query.date, timezone: doctor.clinic.timezone, slots };
  }

  async get(actor: AuthenticatedUser, id: string) {
    const isPatient = actor.roles.includes('PATIENT');
    if (!isPatient) this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_BOOK]);
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id,
        clinicId: requireClinicId(actor),
        ...(isPatient ? { patient: { userId: actor.id } } : {}),
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, medicalRecordNumber: true },
        },
        doctor: { select: { id: true, specialty: true, user: { select: { displayName: true } } } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async create(actor: AuthenticatedUser, input: AppointmentCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_BOOK]);
    const clinicId = requireClinicId(actor);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt >= endsAt) throw new BadRequestException('endsAt must be later than startsAt');
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: input.patientId,
        clinicId,
        deletedAt: null,
        ...(actor.roles.includes('PATIENT') ? { userId: actor.id } : {}),
      },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: input.doctorId, clinicId, isActive: true },
      select: {
        id: true,
        userId: true,
        breakStart: true,
        breakEnd: true,
        dailyMaxAppointments: true,
        appointmentFee: true,
        clinic: { select: { timezone: true } },
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (actor.roles.includes('DOCTOR') && doctor.userId !== actor.id)
      throw new ForbiddenException('Doctors may only book appointments on their own schedule');
    const start = localDateAndTime(startsAt, doctor.clinic.timezone);
    const localDay = new Date(`${start.date}T00:00:00.000Z`);
    const holiday = await this.prisma.clinicHoliday.findUnique({
      where: { clinicId_date: { clinicId, date: localDay } },
      select: { id: true, name: true },
    });
    if (holiday) throw new BadRequestException(`Clinic is closed for ${holiday.name}`);
    if (doctor.breakStart && doctor.breakEnd) {
      const appointmentStart = Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3));
      const appointmentEnd = appointmentStart + Math.max(1, (endsAt.getTime() - startsAt.getTime()) / 60_000);
      const breakStart = Number(doctor.breakStart.slice(0, 2)) * 60 + Number(doctor.breakStart.slice(3));
      const breakEnd = Number(doctor.breakEnd.slice(0, 2)) * 60 + Number(doctor.breakEnd.slice(3));
      if (appointmentStart < breakEnd && appointmentEnd > breakStart)
        throw new BadRequestException('The requested appointment overlaps the clinic break');
    }
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctorId: doctor.id,
        clinicId,
        dayOfWeek: start.dayOfWeek,
        effectiveFrom: { lte: localDay },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: localDay } }],
      },
      select: { startTime: true, endTime: true, slotMinutes: true },
    });
    if (!isWithinSchedule(startsAt, endsAt, doctor.clinic.timezone, schedules)) {
      throw new BadRequestException('The requested appointment is outside the doctor schedule');
    }
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${doctor.id}))`;
        const overlap = await transaction.appointment.findFirst({
          where: {
            doctorId: doctor.id,
            clinicId,
            status: { not: AppointmentStatus.CANCELLED },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (overlap) throw new BadRequestException('The requested appointment time is unavailable');
        const dayCount = await transaction.appointment.count({
          where: {
            doctorId: doctor.id,
            clinicId,
            status: { not: AppointmentStatus.CANCELLED },
            startsAt: { gte: localTimeToUtc(start.date, '00:00', doctor.clinic.timezone), lt: localTimeToUtc(
              new Date(localDay.getTime() + 86_400_000).toISOString().slice(0, 10),
              '00:00',
              doctor.clinic.timezone,
            ) },
          },
        });
        if (dayCount >= doctor.dailyMaxAppointments)
          throw new BadRequestException('Daily appointment limit has been reached');
        const tokenNumber =
          input.tokenNumber ??
          ((await transaction.appointment.count({
            where: {
              doctorId: doctor.id,
              startsAt: {
                gte: localTimeToUtc(start.date, '00:00', doctor.clinic.timezone),
              },
            },
          })) + 1);
        return transaction.appointment.create({
          data: {
            clinicId,
            patientId: patient.id,
            doctorId: doctor.id,
            startsAt,
            endsAt,
            isWalkIn: input.isWalkIn ?? false,
            tokenNumber,
            fee: new Prisma.Decimal(input.fee ?? doctor.appointmentFee),
          },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            doctor: { select: { id: true, user: { select: { displayName: true } } } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(actor: AuthenticatedUser, id: string, input: AppointmentUpdateDto) {
    if (Object.keys(input).length === 0)
      throw new BadRequestException('At least one appointment field must be provided');
    const clinicId = requireClinicId(actor);
    const existing = await this.prisma.appointment.findFirst({
      where: {
        id,
        clinicId,
        ...(actor.roles.includes('PATIENT') ? { patient: { userId: actor.id } } : {}),
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        tokenNumber: true,
        arrivedAt: true,
        waitingAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (
      (input.startsAt !== undefined || input.endsAt !== undefined) &&
      existing.status !== AppointmentStatus.BOOKED
    )
      throw new BadRequestException('Only booked appointments can be rescheduled');
    if (actor.roles.includes('PATIENT')) {
      if (input.status && input.status !== AppointmentStatus.CANCELLED)
        throw new ForbiddenException('Patients may only cancel their appointments');
      if (!input.status)
        this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_RESCHEDULE]);
      if (existing.status !== AppointmentStatus.BOOKED)
        throw new BadRequestException('Only booked appointments can be changed');
    }
    if (input.status === AppointmentStatus.CANCELLED) {
      this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_CANCEL]);
    } else if (input.startsAt !== undefined || input.endsAt !== undefined) {
      this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_RESCHEDULE]);
    } else if (input.status === AppointmentStatus.CHECKED_IN) {
      this.authorization.assertPermissions(actor, [Permissions.APPOINTMENT_CHECK_IN]);
    } else if (input.status !== undefined) {
      this.authorization.assertPermissions(actor, [Permissions.CLINIC_FULL_ACCESS]);
    }
    if (input.tokenNumber !== undefined)
      this.authorization.assertPermissions(actor, [Permissions.QUEUE_MANAGE]);
    const allowedTransitions: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
      [AppointmentStatus.BOOKED]: [
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CHECKED_IN]: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.COMPLETED],
    };
    if (input.status && !allowedTransitions[existing.status]?.includes(input.status)) {
      throw new BadRequestException(
        `Appointment cannot transition from ${existing.status} to ${input.status}`,
      );
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (startsAt >= endsAt) throw new BadRequestException('endsAt must be later than startsAt');
    if (input.startsAt !== undefined || input.endsAt !== undefined) {
      const doctor = await this.prisma.doctor.findFirst({
        where: { id: existing.doctorId, clinicId },
        select: {
          breakStart: true,
          breakEnd: true,
          clinic: { select: { timezone: true } },
        },
      });
      if (!doctor) throw new NotFoundException('Doctor not found');
      const localStart = localDateAndTime(startsAt, doctor.clinic.timezone);
      const localDay = new Date(`${localStart.date}T00:00:00.000Z`);
      const holiday = await this.prisma.clinicHoliday.findUnique({
        where: { clinicId_date: { clinicId, date: localDay } },
        select: { id: true, name: true },
      });
      if (holiday) throw new BadRequestException(`Clinic is closed for ${holiday.name}`);
      if (doctor.breakStart && doctor.breakEnd) {
        const appointmentStart = Number(localStart.time.slice(0, 2)) * 60 + Number(localStart.time.slice(3));
        const appointmentEnd = appointmentStart + Math.max(1, (endsAt.getTime() - startsAt.getTime()) / 60_000);
        const breakStart = Number(doctor.breakStart.slice(0, 2)) * 60 + Number(doctor.breakStart.slice(3));
        const breakEnd = Number(doctor.breakEnd.slice(0, 2)) * 60 + Number(doctor.breakEnd.slice(3));
        if (appointmentStart < breakEnd && appointmentEnd > breakStart)
          throw new BadRequestException('The requested appointment overlaps the clinic break');
      }
      const schedules = await this.prisma.doctorSchedule.findMany({
        where: {
          doctorId: existing.doctorId,
          clinicId,
          dayOfWeek: localStart.dayOfWeek,
          effectiveFrom: { lte: localDay },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: localDay } }],
        },
        select: { startTime: true, endTime: true, slotMinutes: true },
      });
      if (!isWithinSchedule(startsAt, endsAt, doctor.clinic.timezone, schedules)) {
        throw new BadRequestException('The requested appointment is outside the doctor schedule');
      }
      return this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.doctorId}))`;
          const overlap = await transaction.appointment.findFirst({
            where: {
              id: { not: id },
              doctorId: existing.doctorId,
              clinicId,
              status: { not: AppointmentStatus.CANCELLED },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });
          if (overlap)
            throw new BadRequestException('The requested appointment time is unavailable');
          return transaction.appointment.update({
            where: { id },
            data: {
              ...(input.startsAt ? { startsAt } : {}),
              ...(input.endsAt ? { endsAt } : {}),
              ...(input.status ? { status: input.status } : {}),
              ...(input.tokenNumber !== undefined ? { tokenNumber: input.tokenNumber } : {}),
              ...(input.status === AppointmentStatus.CHECKED_IN ? { arrivedAt: existing.arrivedAt ?? new Date(), waitingAt: existing.waitingAt ?? new Date() } : {}),
              ...(input.status === AppointmentStatus.IN_PROGRESS ? { startedAt: existing.startedAt ?? new Date() } : {}),
              ...(input.status === AppointmentStatus.COMPLETED ? { completedAt: existing.completedAt ?? new Date() } : {}),
              version: { increment: 1 },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(input.startsAt ? { startsAt } : {}),
        ...(input.endsAt ? { endsAt } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.tokenNumber !== undefined ? { tokenNumber: input.tokenNumber } : {}),
        ...(input.status === AppointmentStatus.CHECKED_IN
          ? { arrivedAt: existing.arrivedAt ?? new Date(), waitingAt: existing.waitingAt ?? new Date() }
          : {}),
        ...(input.status === AppointmentStatus.IN_PROGRESS
          ? { startedAt: existing.startedAt ?? new Date() }
          : {}),
        ...(input.status === AppointmentStatus.COMPLETED
          ? { completedAt: existing.completedAt ?? new Date() }
          : {}),
        version: { increment: 1 },
      },
    });
  }

  async listHolidays(actor: AuthenticatedUser) {
    return this.prisma.clinicHoliday.findMany({
      where: { clinicId: requireClinicId(actor) },
      orderBy: { date: 'asc' },
    });
  }

  async createHoliday(actor: AuthenticatedUser, input: HolidayCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.CLINIC_FULL_ACCESS]);
    const clinicId = requireClinicId(actor);
    const date = new Date(`${input.date}T00:00:00.000Z`);
    return this.prisma.clinicHoliday.upsert({
      where: { clinicId_date: { clinicId, date } },
      update: { name: input.name },
      create: { clinicId, date, name: input.name },
    });
  }

  async deleteHoliday(actor: AuthenticatedUser, id: string) {
    this.authorization.assertPermissions(actor, [Permissions.CLINIC_FULL_ACCESS]);
    const clinicId = requireClinicId(actor);
    const holiday = await this.prisma.clinicHoliday.findFirst({
      where: { id, clinicId },
      select: { id: true },
    });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.prisma.clinicHoliday.delete({ where: { id } });
  }
}

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}
  @Get('holidays')
  listHolidays(@CurrentUser() actor: AuthenticatedUser) {
    return this.appointments.listHolidays(actor);
  }
  @Post('holidays')
  createHoliday(@CurrentUser() actor: AuthenticatedUser, @Body() input: HolidayCreateDto) {
    return this.appointments.createHoliday(actor, input);
  }
  @Delete('holidays/:id')
  deleteHoliday(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointments.deleteHoliday(actor, id);
  }
  @Get('availability')
  @ApiOperation({ summary: 'List available appointment slots for a doctor' })
  availability(@CurrentUser() actor: AuthenticatedUser, @Query() query: AvailabilityQueryDto) {
    return this.appointments.availability(actor, query);
  }
  @Post()
  @RequirePermissions(Permissions.APPOINTMENT_BOOK)
  @ApiOperation({ summary: 'Book an appointment' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: AppointmentCreateDto) {
    return this.appointments.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List appointments in the current clinic' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: AppointmentListQueryDto) {
    return this.appointments.list(actor, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment in the current clinic' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointments.get(actor, id);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Reschedule or update appointment status' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AppointmentUpdateDto,
  ) {
    return this.appointments.update(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
