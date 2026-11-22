import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  Module,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { PatientCreateDto, PatientListQueryDto, PatientMergeDto, PatientUpdateDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, PaginationQueryDto, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: PatientListQueryDto) {
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.PATIENT_READ]);
    const clinicId = requireClinicId(actor);
    const now = new Date();
    const followUpCutoff = new Date(now);
    followUpCutoff.setDate(now.getDate() - 30);
    const filter = query.filter ?? 'all';
    const filterWhere: Prisma.PatientWhereInput =
      filter === 'new'
        ? { appointments: { none: {} } }
        : filter === 'returning'
          ? { appointments: { some: {} } }
          : filter === 'follow-up-due'
            ? {
                appointments: {
                  some: {
                    status: 'COMPLETED',
                    endsAt: { lte: followUpCutoff },
                  },
                },
              }
            : filter === 'payment-pending'
              ? { payments: { some: { status: 'PENDING' } } }
              : {};
    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      ...(patientSelf ? { userId: actor.id } : { clinicId }),
      ...filterWhere,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { medicalRecordNumber: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { emergencyContactPhone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const direction = sortDirection(query.sortOrder);
    const orderBy: Prisma.PatientOrderByWithRelationInput =
      query.sortBy === 'firstName'
        ? { firstName: direction }
        : query.sortBy === 'lastName'
          ? { lastName: direction }
          : { createdAt: direction };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.patient.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true,
            medicalRecordNumber: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            phone: true,
            gender: true,
            address: true,
            bloodGroup: true,
            allergies: true,
            medicalConditions: true,
            currentMedication: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            createdAt: true,
          },
        }),
      () => this.prisma.patient.count({ where }),
    );
  }

  async get(actor: AuthenticatedUser, id: string) {
    const clinicId = actor.roles.includes('PATIENT') ? undefined : requireClinicId(actor);
    if (!actor.roles.includes('PATIENT'))
      this.authorization.assertPermissions(actor, [Permissions.PATIENT_READ]);
    const patient = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null, ...(clinicId ? { clinicId } : { userId: actor.id }) },
      select: {
        id: true,
        clinicId: true,
        userId: true,
        medicalRecordNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
        gender: true,
        address: true,
        bloodGroup: true,
        allergies: true,
        medicalConditions: true,
        currentMedication: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async create(actor: AuthenticatedUser, input: PatientCreateDto) {
    this.authorization.assertPermissions(actor, [Permissions.PATIENT_REGISTER]);
    return this.prisma.patient.create({
      data: {
        clinicId: requireClinicId(actor),
        medicalRecordNumber: `P-${randomBytes(8).toString('hex').toUpperCase()}`,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: new Date(input.dateOfBirth),
        phone: input.phone,
        gender: input.gender,
        address: input.address,
        bloodGroup: input.bloodGroup,
        allergies: input.allergies,
        medicalConditions: input.medicalConditions,
        currentMedication: input.currentMedication,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
      },
      select: {
        id: true,
        medicalRecordNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: PatientUpdateDto) {
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.PATIENT_REGISTER]);
    const existing = await this.prisma.patient.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(patientSelf ? { userId: actor.id } : { clinicId: requireClinicId(actor) }),
      },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Patient not found');
    if (
      patientSelf &&
      (input.firstName !== undefined ||
        input.lastName !== undefined ||
        input.dateOfBirth !== undefined)
    ) {
      throw new ForbiddenException('Patients may update only their contact phone');
    }
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
        ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
        ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: new Date(input.dateOfBirth) }),
        ...(input.phone === undefined ? {} : { phone: input.phone }),
        ...(input.gender === undefined ? {} : { gender: input.gender }),
        ...(input.address === undefined ? {} : { address: input.address }),
        ...(input.bloodGroup === undefined ? {} : { bloodGroup: input.bloodGroup }),
        ...(input.allergies === undefined ? {} : { allergies: input.allergies }),
        ...(input.medicalConditions === undefined ? {} : { medicalConditions: input.medicalConditions }),
        ...(input.currentMedication === undefined ? {} : { currentMedication: input.currentMedication }),
        ...(input.emergencyContactName === undefined ? {} : { emergencyContactName: input.emergencyContactName }),
        ...(input.emergencyContactPhone === undefined ? {} : { emergencyContactPhone: input.emergencyContactPhone }),
      },
      select: {
        id: true,
        medicalRecordNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
        updatedAt: true,
      },
    });
  }

  async duplicates(actor: AuthenticatedUser) {
    if (actor.roles.includes('PATIENT'))
      throw new ForbiddenException('Duplicate patient detection is only available to clinic staff');
    this.authorization.assertPermissions(actor, [Permissions.PATIENT_READ]);
    const clinicId = requireClinicId(actor);
    const patients = await this.prisma.patient.findMany({
      where: { clinicId, deletedAt: null },
      select: {
        id: true,
        medicalRecordNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const groups = new Map<string, typeof patients>();
    for (const patient of patients) {
      const name = `${patient.firstName} ${patient.lastName}`.trim().toLowerCase().replace(/\s+/g, ' ');
      const dob = patient.dateOfBirth.toISOString().slice(0, 10);
      const phone = patient.phone?.replace(/\D/g, '') ?? '';
      const keys = [`n:${name}|d:${dob}`, ...(phone ? [`p:${phone}`] : [])];
      for (const key of keys) {
        const group = groups.get(key) ?? [];
        if (!group.some((item) => item.id === patient.id)) group.push(patient);
        groups.set(key, group);
      }
    }
    const uniqueGroups = new Map<string, typeof patients>();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const key = [...group].sort((a, b) => a.id.localeCompare(b.id)).map((item) => item.id).join('|');
      uniqueGroups.set(key, group);
    }
    return [...uniqueGroups.values()].map((group) => ({
      reason: 'Matching name/date of birth or mobile number',
      patients: group,
    }));
  }

  async merge(actor: AuthenticatedUser, targetId: string, input: PatientMergeDto) {
    this.authorization.assertPermissions(actor, [Permissions.PATIENT_REGISTER]);
    if (!input.confirmed) throw new BadRequestException('Confirmation is required to merge patients');
    if (targetId === input.sourcePatientId)
      throw new BadRequestException('Source and target patient must be different');
    const clinicId = requireClinicId(actor);
    const [target, source] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: targetId, clinicId, deletedAt: null } }),
      this.prisma.patient.findFirst({ where: { id: input.sourcePatientId, clinicId, deletedAt: null } }),
    ]);
    if (!target || !source) throw new NotFoundException('Patient record not found');

    await this.prisma.$transaction(async (transaction) => {
      await transaction.appointment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.consultation.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.prescription.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.medicalDocument.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.payment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.vitalRecord.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.diagnosis.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.familyMember.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } });
      await transaction.patient.update({
        where: { id: source.id },
        data: { deletedAt: new Date(), userId: null },
      });
    });
    return { targetPatientId: targetId, mergedPatientId: source.id, merged: true };
  }

  async timeline(actor: AuthenticatedUser, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(actor.roles.includes('PATIENT') ? { userId: actor.id } : { clinicId: requireClinicId(actor) }),
      },
      select: { id: true, clinicId: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (!actor.roles.includes('PATIENT')) {
      this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    }
    const [appointments, consultations, prescriptions, documents, payments] = await Promise.all([
      this.prisma.appointment.findMany({ where: { patientId: id, clinicId: patient.clinicId }, orderBy: { startsAt: 'desc' } }),
      this.prisma.consultation.findMany({ where: { patientId: id, clinicId: patient.clinicId }, orderBy: { startedAt: 'desc' } }),
      this.prisma.prescription.findMany({ where: { patientId: id, clinicId: patient.clinicId }, include: { items: true }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.medicalDocument.findMany({ where: { patientId: id, clinicId: patient.clinicId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.findMany({ where: { patientId: id, clinicId: patient.clinicId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const timeline = [
      ...appointments.map((item) => ({ type: 'appointment', id: item.id, occurredAt: item.startsAt, data: item })),
      ...consultations.map((item) => ({ type: 'consultation', id: item.id, occurredAt: item.startedAt, data: item })),
      ...prescriptions.map((item) => ({ type: 'prescription', id: item.id, occurredAt: item.issuedAt, data: item })),
      ...documents.map((item) => ({ type: 'document', id: item.id, occurredAt: item.createdAt, data: item })),
      ...payments.map((item) => ({ type: 'payment', id: item.id, occurredAt: item.createdAt, data: item })),
    ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return { patientId: id, timeline };
  }

  async history(actor: AuthenticatedUser, id: string, query: PaginationQueryDto) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(actor.roles.includes('PATIENT')
          ? { userId: actor.id }
          : { clinicId: requireClinicId(actor) }),
      },
      select: { id: true, clinicId: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (!actor.roles.includes('PATIENT'))
      this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const appointmentWhere = { patientId: id, clinicId: patient.clinicId };
    const consultationWhere = { patientId: id, clinicId: patient.clinicId };
    const recordWhere = {
      patientId: id,
      clinicId: patient.clinicId,
      isCurrent: true,
      deletedAt: null,
    };
    const prescriptionWhere = { patientId: id, clinicId: patient.clinicId };
    const [
      appointments,
      appointmentCount,
      consultations,
      consultationCount,
      records,
      recordCount,
      prescriptions,
      prescriptionCount,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        orderBy: { startsAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where: appointmentWhere }),
      this.prisma.consultation.findMany({
        where: consultationWhere,
        orderBy: { startedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.consultation.count({ where: consultationWhere }),
      this.prisma.medicalDocument.findMany({
        where: recordWhere,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.medicalDocument.count({ where: recordWhere }),
      this.prisma.prescription.findMany({
        where: prescriptionWhere,
        include: { items: true },
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.prescription.count({ where: prescriptionWhere }),
    ]);
    return {
      data: { appointments, consultations, records, prescriptions },
      meta: {
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totals: {
            appointments: appointmentCount,
            consultations: consultationCount,
            records: recordCount,
            prescriptions: prescriptionCount,
          },
        },
      },
    };
  }
}

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
class PatientsController {
  constructor(private readonly patients: PatientsService) {}
  @Get('duplicates')
  @ApiOperation({ summary: 'Detect possible duplicate patient records' })
  duplicates(@CurrentUser() actor: AuthenticatedUser) {
    return this.patients.duplicates(actor);
  }
  @Post(':id/merge')
  @RequirePermissions(Permissions.PATIENT_REGISTER)
  @ApiOperation({ summary: 'Merge a source patient record into this target record' })
  merge(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PatientMergeDto,
  ) {
    return this.patients.merge(actor, id, input);
  }
  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get chronological patient activity' })
  timeline(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patients.timeline(actor, id);
  }
  @Post()
  @RequirePermissions(Permissions.PATIENT_REGISTER)
  @ApiOperation({ summary: 'Create a patient record in the current clinic' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: PatientCreateDto) {
    return this.patients.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List patients visible to the authenticated user' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: PatientListQueryDto) {
    return this.patients.list(actor, query);
  }
  @Get(':id/history')
  @ApiOperation({ summary: 'Get a patient history' })
  history(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.patients.history(actor, id, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a patient profile' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.patients.get(actor, id);
  }
  @Put(':id')
  @ApiOperation({ summary: 'Update a patient profile' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PatientUpdateDto,
  ) {
    return this.patients.update(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
