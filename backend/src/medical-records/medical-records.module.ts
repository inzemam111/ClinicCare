import { ForbiddenException, Injectable, Module, NotFoundException } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { MedicalRecordCreateDto, MedicalRecordListQueryDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class MedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: MedicalRecordListQueryDto) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical documents are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const clinicId = requireClinicId(actor);
    const where: Prisma.MedicalDocumentWhereInput = {
      clinicId,
      isCurrent: true,
      deletedAt: null,
      ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.medicalDocument.findMany({
          where,
          orderBy: { createdAt: sortDirection(query.sortOrder) },
          skip,
          take,
          select: {
            id: true,
            patientId: true,
            consultationId: true,
            type: true,
            title: true,
            version: true,
            isCurrent: true,
            storageKey: true,
            previousVersionId: true,
            createdAt: true,
          },
        }),
      () => this.prisma.medicalDocument.count({ where }),
    );
  }

  async get(actor: AuthenticatedUser, id: string) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical documents are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const document = await this.prisma.medicalDocument.findFirst({
      where: {
        id,
        clinicId: requireClinicId(actor),
        deletedAt: null,
        ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      },
      select: {
        id: true,
        patientId: true,
        consultationId: true,
        type: true,
        title: true,
        version: true,
        isCurrent: true,
        storageKey: true,
        previousVersionId: true,
        createdAt: true,
      },
    });
    if (!document) throw new NotFoundException('Medical record not found');
    return document;
  }

  async create(actor: AuthenticatedUser, input: MedicalRecordCreateDto) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Receptionists cannot access or create clinical documents');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf)
      this.authorization.assertPermissions(actor, [Permissions.MEDICAL_RECORD_WRITE]);
    const clinicId = requireClinicId(actor);
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, clinicId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (patientSelf) {
      const ownPatient = await this.prisma.patient.findFirst({
        where: { id: input.patientId, clinicId, userId: actor.id, deletedAt: null },
        select: { id: true },
      });
      if (!ownPatient) throw new ForbiddenException('Patients may only upload their own reports');
      const patientUploadTypes: DocumentType[] = [
        DocumentType.LAB_REPORT,
        DocumentType.IMAGING,
        DocumentType.OTHER,
      ];
      if (!patientUploadTypes.includes(input.type))
        throw new ForbiddenException('Patients may only upload reports or supporting documents');
      if (input.consultationId)
        throw new ForbiddenException(
          'Patients cannot attach a document to a clinical consultation',
        );
    }
    if (input.consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: input.consultationId, clinicId, patientId: patient.id },
        select: { id: true },
      });
      if (!consultation) throw new NotFoundException('Consultation not found');
    }
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.medicalDocument.findFirst({
        where: {
          clinicId,
          patientId: patient.id,
          type: input.type,
          title: input.title,
          isCurrent: true,
          deletedAt: null,
        },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      if (previous) {
        await transaction.medicalDocument.update({
          where: { id: previous.id },
          data: { isCurrent: false },
        });
      }
      return transaction.medicalDocument.create({
        data: {
          clinicId,
          patientId: patient.id,
          consultationId: input.consultationId,
          type: input.type,
          title: input.title,
          storageKey: input.storageKey,
          version: previous ? previous.version + 1 : 1,
          previousVersionId: previous?.id,
          isCurrent: true,
        },
        select: {
          id: true,
          patientId: true,
          consultationId: true,
          type: true,
          title: true,
          storageKey: true,
          version: true,
          previousVersionId: true,
          isCurrent: true,
          createdAt: true,
        },
      });
    });
  }
}

@ApiTags('Medical records')
@ApiBearerAuth()
@Controller('medical-records')
class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}
  @Post()
  @ApiOperation({ summary: 'Add a medical record to a patient' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: MedicalRecordCreateDto) {
    return this.records.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List visible medical records' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: MedicalRecordListQueryDto) {
    return this.records.list(actor, query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get medical record metadata' })
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.records.get(actor, id);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
