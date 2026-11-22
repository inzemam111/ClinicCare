import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import {
  ClinicalTemplateDto,
  ConsultationCreateDto,
  ConsultationListQueryDto,
  ConsultationUpdateDto,
  DiagnosisDto,
  VitalRecordDto,
} from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: ConsultationListQueryDto) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical notes are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const clinicId = requireClinicId(actor);
    if (query.from && query.to && new Date(query.from) >= new Date(query.to))
      throw new BadRequestException('from must be earlier than to');
    const where: Prisma.ConsultationWhereInput = {
      clinicId,
      ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.consultation.findMany({
          where,
          orderBy: { startedAt: sortDirection(query.sortOrder) },
          skip,
          take,
          include: { diagnoses: true, vitals: true, prescriptions: { include: { items: true } } },
        }),
      () => this.prisma.consultation.count({ where }),
    );
  }

  async create(actor: AuthenticatedUser, input: ConsultationCreateDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can start a consultation');
    this.authorization.assertPermissions(actor, [Permissions.CONSULTATION_CREATE]);
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { userId: actor.id, clinicId, isActive: true },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, clinicId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    let template = null;
    if (input.templateId) {
      template = await this.prisma.clinicalTemplate.findFirst({
        where: { id: input.templateId, clinicId, deletedAt: null },
      });
      if (!template) throw new NotFoundException('Clinical template not found');
    }
    if (input.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          id: input.appointmentId,
          clinicId,
          patientId: patient.id,
          doctorId: doctor.id,
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN] },
        },
        select: { id: true },
      });
      if (!appointment)
        throw new BadRequestException('Appointment is not available for consultation');
      return this.prisma.$transaction(async (transaction) => {
        const consultation = await transaction.consultation.create({
          data: {
            clinicId,
            patientId: patient.id,
            doctorId: doctor.id,
            appointmentId: appointment.id,
            clinicalNotes: input.clinicalNotes,
            symptoms: input.symptoms ?? template?.symptoms,
            examination: input.examination ?? template?.examination,
            treatmentPlan: input.treatmentPlan ?? template?.treatmentPlan,
            followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
            templateId: input.templateId,
          },
        });
        await transaction.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.IN_PROGRESS, version: { increment: 1 } },
        });
        return consultation;
      });
    }
    return this.prisma.consultation.create({
      data: {
        clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        clinicalNotes: input.clinicalNotes,
        symptoms: input.symptoms ?? template?.symptoms,
        examination: input.examination ?? template?.examination,
        treatmentPlan: input.treatmentPlan ?? template?.treatmentPlan,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
        templateId: input.templateId,
      },
    });
  }

  async get(actor: AuthenticatedUser, id: string) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical notes are not accessible to receptionists');
    const isPatient = actor.roles.includes('PATIENT');
    if (!isPatient) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const consultation = await this.prisma.consultation.findFirst({
      where: {
        id,
        clinicId: requireClinicId(actor),
        ...(isPatient ? { patient: { userId: actor.id } } : {}),
      },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' } },
        diagnoses: { orderBy: { createdAt: 'asc' } },
        prescriptions: { include: { items: true } },
        documents: { where: { isCurrent: true, deletedAt: null } },
      },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    return consultation;
  }

  async update(actor: AuthenticatedUser, id: string, input: ConsultationUpdateDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can edit consultation records');
    const clinicId = requireClinicId(actor);
    const existing = await this.prisma.consultation.findFirst({
      where: { id, clinicId, doctor: { userId: actor.id } },
    });
    if (!existing) throw new NotFoundException('Consultation not found');
    if (existing.status === 'FINALIZED')
      throw new ForbiddenException('A finalized consultation record cannot be edited');
    const before = {
      clinicalNotes: existing.clinicalNotes,
      symptoms: existing.symptoms,
      examination: existing.examination,
      treatmentPlan: existing.treatmentPlan,
      followUpAt: existing.followUpAt,
    };
    const updated = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.consultation.update({
        where: { id },
        data: {
          ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes } : {}),
          ...(input.symptoms !== undefined ? { symptoms: input.symptoms } : {}),
          ...(input.examination !== undefined ? { examination: input.examination } : {}),
          ...(input.treatmentPlan !== undefined ? { treatmentPlan: input.treatmentPlan } : {}),
          ...(input.followUpAt !== undefined ? { followUpAt: new Date(input.followUpAt) } : {}),
          version: { increment: 1 },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          clinicId,
          action: 'CONSULTATION_DRAFT_UPDATED',
          entityType: 'consultations',
          entityId: id,
          before,
          after: record,
        },
      });
      return record;
    });
    return updated;
  }

  async finalize(actor: AuthenticatedUser, id: string) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can finalize consultation records');
    const clinicId = requireClinicId(actor);
    const existing = await this.prisma.consultation.findFirst({
      where: { id, clinicId, doctor: { userId: actor.id } },
    });
    if (!existing) throw new NotFoundException('Consultation not found');
    if (existing.status === 'FINALIZED') return existing;
    const finalized = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.consultation.update({
        where: { id },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          finalizedById: actor.id,
          version: { increment: 1 },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          clinicId,
          action: 'CONSULTATION_FINALIZED',
          entityType: 'consultations',
          entityId: id,
          before: { status: existing.status, version: existing.version },
          after: { status: 'FINALIZED', version: record.version },
        },
      });
      if (existing.appointmentId) {
        await transaction.appointment.update({
          where: { id: existing.appointmentId },
          data: { status: AppointmentStatus.COMPLETED, completedAt: new Date(), version: { increment: 1 } },
        });
      }
      return record;
    });
    return finalized;
  }

  async saveVitals(actor: AuthenticatedUser, id: string, input: VitalRecordDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can record clinical vitals');
    const clinicId = requireClinicId(actor);
    const consultation = await this.prisma.consultation.findFirst({
      where: { id, clinicId, doctor: { userId: actor.id } },
      select: { id: true, patientId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    if (consultation.status === 'FINALIZED')
      throw new ForbiddenException('A finalized consultation record cannot be edited');
    const height = input.heightCm;
    const weight = input.weightKg;
    const bmi = height && weight ? weight / ((height / 100) ** 2) : undefined;
    return this.prisma.vitalRecord.create({
      data: {
        clinicId,
        patientId: consultation.patientId,
        consultationId: consultation.id,
        systolic: input.systolic,
        diastolic: input.diastolic,
        pulse: input.pulse,
        temperature: input.temperature ? new Prisma.Decimal(input.temperature) : undefined,
        oxygenSaturation: input.oxygenSaturation,
        heightCm: input.heightCm ? new Prisma.Decimal(input.heightCm) : undefined,
        weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : undefined,
        bmi: bmi ? new Prisma.Decimal(bmi.toFixed(2)) : undefined,
      },
    });
  }

  async addDiagnosis(actor: AuthenticatedUser, id: string, input: DiagnosisDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can add diagnoses');
    const clinicId = requireClinicId(actor);
    const consultation = await this.prisma.consultation.findFirst({
      where: { id, clinicId, doctor: { userId: actor.id } },
      select: { id: true, patientId: true, status: true },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    if (consultation.status === 'FINALIZED')
      throw new ForbiddenException('A finalized consultation record cannot be edited');
    return this.prisma.diagnosis.create({
      data: {
        clinicId,
        patientId: consultation.patientId,
        consultationId: consultation.id,
        code: input.code,
        description: input.description,
        isPrimary: input.isPrimary ?? false,
      },
    });
  }

  async listTemplates(actor: AuthenticatedUser) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical templates are not accessible to receptionists');
    return this.prisma.clinicalTemplate.findMany({
      where: { clinicId: requireClinicId(actor), deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createTemplate(actor: AuthenticatedUser, input: ClinicalTemplateDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can manage clinical templates');
    const clinicId = requireClinicId(actor);
    return this.prisma.clinicalTemplate.upsert({
      where: { clinicId_name: { clinicId, name: input.name } },
      update: {
        specialty: input.specialty,
        symptoms: input.symptoms,
        examination: input.examination,
        treatmentPlan: input.treatmentPlan,
      },
      create: {
        clinicId,
        name: input.name,
        specialty: input.specialty,
        symptoms: input.symptoms,
        examination: input.examination,
        treatmentPlan: input.treatmentPlan,
        createdById: actor.id,
      },
    });
  }
}

@ApiTags('Consultations')
@ApiBearerAuth()
@Controller('consultations')
class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}
  @Get('templates')
  templates(@CurrentUser() actor: AuthenticatedUser) {
    return this.consultations.listTemplates(actor);
  }
  @Post('templates')
  createTemplate(@CurrentUser() actor: AuthenticatedUser, @Body() input: ClinicalTemplateDto) {
    return this.consultations.createTemplate(actor, input);
  }
  @Post()
  @RequirePermissions(Permissions.CONSULTATION_CREATE)
  @ApiOperation({ summary: 'Start a doctor consultation' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: ConsultationCreateDto) {
    return this.consultations.create(actor, input);
  }
  @Get()
  @ApiOperation({
    summary: 'List consultations in the current clinic or the authenticated patient history',
  })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ConsultationListQueryDto) {
    return this.consultations.list(actor, query);
  }
  @Get(':id')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consultations.get(actor, id);
  }
  @Put(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConsultationUpdateDto,
  ) {
    return this.consultations.update(actor, id, input);
  }
  @Post(':id/finalize')
  finalize(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consultations.finalize(actor, id);
  }
  @Post(':id/vitals')
  saveVitals(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: VitalRecordDto,
  ) {
    return this.consultations.saveVitals(actor, id, input);
  }
  @Post(':id/diagnoses')
  addDiagnosis(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DiagnosisDto,
  ) {
    return this.consultations.addDiagnosis(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
