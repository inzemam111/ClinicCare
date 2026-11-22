import { BadRequestException, ForbiddenException, Injectable, Module, NotFoundException } from '@nestjs/common';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthorizationService, Permissions } from '../authorization/authorization.service';
import { PrescriptionCorrectionDto, PrescriptionCreateDto, PrescriptionListQueryDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { paginate, sortDirection } from '../common/pagination.dto';
import { PrismaService } from '../infrastructure/prisma.service';
import { createHmac, randomUUID } from 'crypto';
import { Public } from '../auth/public.decorator';

@Injectable()
class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(actor: AuthenticatedUser, query: PrescriptionListQueryDto) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical prescriptions are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const clinicId = requireClinicId(actor);
    const where: Prisma.PrescriptionWhereInput = {
      clinicId,
      ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
    };
    return paginate(
      query,
      (skip, take) =>
        this.prisma.prescription.findMany({
          where,
          orderBy: { issuedAt: sortDirection(query.sortOrder) },
          skip,
          take,
          include: { items: true, doctor: { select: { user: { select: { displayName: true } } } } },
        }),
      () => this.prisma.prescription.count({ where }),
    );
  }

  async create(actor: AuthenticatedUser, input: PrescriptionCreateDto) {
    if (!actor.roles.includes('DOCTOR')) throw new NotFoundException('Doctor profile not found');
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Receptionists cannot access or issue clinical prescriptions');
    this.authorization.assertPermissions(actor, [Permissions.PRESCRIPTION_CREATE]);
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { userId: actor.id, clinicId, isActive: true },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const consultation = await this.prisma.consultation.findFirst({
      where: {
        id: input.consultationId,
        clinicId,
        patientId: input.patientId,
        doctorId: doctor.id,
      },
      select: { id: true, patientId: true },
    });
    if (!consultation) throw new NotFoundException('Consultation not found');
    const number = `RX-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const verificationCode = randomUUID().replace(/-/g, '');
    const payload = `${number}|${consultation.patientId}|${verificationCode}`;
    const signingSecret = process.env.PRESCRIPTION_SIGNING_SECRET;
    const signedHash = signingSecret
      ? createHmac('sha256', signingSecret).update(payload).digest('hex')
      : null;
    return this.prisma.prescription.create({
      data: {
        clinicId,
        patientId: consultation.patientId,
        consultationId: consultation.id,
        doctorId: doctor.id,
        prescriptionNumber: number,
        verificationCode,
        signedHash,
        diagnosis: input.diagnosis,
        investigationRecommendations: input.investigationRecommendations,
        followUpInstructions: input.followUpInstructions,
        items: {
          create: input.items.map((item) => ({
            medicineName: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            quantity: item.quantity,
            genericName: item.genericName,
            brandName: item.brandName,
            strength: item.strength,
            foodInstructions: item.foodInstructions,
            specialInstructions: item.specialInstructions,
          })),
        },
      },
      include: { items: true },
    });
  }

  async searchMedicines(actor: AuthenticatedUser, search: string) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Medicines are part of clinical prescribing');
    return this.prisma.medicine.findMany({
      where: {
        clinicId: requireClinicId(actor),
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { genericName: { contains: search, mode: 'insensitive' } },
                { brandName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: 30,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, genericName: true, brandName: true, strength: true },
    });
  }

  async get(actor: AuthenticatedUser, id: string) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical prescriptions are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const clinicId = requireClinicId(actor);
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id,
        clinicId,
        isCurrent: true,
        ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      },
      include: {
        items: true,
        patient: true,
        doctor: {
          include: {
            user: { select: { displayName: true } },
            clinic: { select: { name: true, timezone: true } },
          },
        },
        versions: { include: { items: true }, orderBy: { version: 'desc' } },
      },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    return prescription;
  }

  async preview(actor: AuthenticatedUser, id: string) {
    const prescription = await this.get(actor, id);
    return {
      id: prescription.id,
      documentTitle: 'Digital prescription',
      prescriptionNumber: prescription.prescriptionNumber,
      verificationCode: prescription.verificationCode,
      verificationUrl:
        process.env.CLINICCARE_PUBLIC_URL
          ? `${process.env.CLINICCARE_PUBLIC_URL}/verify/prescription/${prescription.verificationCode}`
          : null,
      issuedAt: prescription.issuedAt,
      clinic: prescription.doctor.clinic,
      doctor: {
        name: prescription.doctor.user.displayName,
        registrationNumber: prescription.doctor.registrationNumber,
        specialty: prescription.doctor.specialty,
      },
      patient: {
        id: prescription.patient.medicalRecordNumber,
        name: `${prescription.patient.firstName} ${prescription.patient.lastName}`,
        dateOfBirth: prescription.patient.dateOfBirth,
        phone: prescription.patient.phone,
      },
      diagnosis: prescription.diagnosis,
      investigationRecommendations: prescription.investigationRecommendations,
      followUpInstructions: prescription.followUpInstructions,
      items: prescription.items,
      signed: Boolean(prescription.signedHash),
      version: prescription.version,
    };
  }

  async correct(actor: AuthenticatedUser, id: string, input: PrescriptionCorrectionDto) {
    if (!actor.roles.includes('DOCTOR'))
      throw new ForbiddenException('Only a doctor can correct prescriptions');
    if (!input.correctionReason?.trim())
      throw new BadRequestException('A correction reason is required');
    const clinicId = requireClinicId(actor);
    const doctor = await this.prisma.doctor.findFirst({
      where: { userId: actor.id, clinicId, isActive: true },
      select: { id: true },
    });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const current = await this.prisma.prescription.findFirst({
      where: { id, clinicId, doctorId: doctor.id, isCurrent: true },
      include: { items: true },
    });
    if (!current) throw new NotFoundException('Current prescription not found');

    const verificationCode = randomUUID().replace(/-/g, '');
    const number = `${current.prescriptionNumber}-C${current.version + 1}`;
    const signingSecret = process.env.PRESCRIPTION_SIGNING_SECRET;
    const signedHash = signingSecret
      ? createHmac('sha256', signingSecret)
          .update(`${number}|${current.patientId}|${verificationCode}`)
          .digest('hex')
      : null;
    return this.prisma.$transaction(async (transaction) => {
      await transaction.prescription.update({
        where: { id: current.id },
        data: { isCurrent: false, status: 'CORRECTED' },
      });
      const corrected = await transaction.prescription.create({
        data: {
          clinicId,
          patientId: current.patientId,
          consultationId: current.consultationId,
          doctorId: doctor.id,
          prescriptionNumber: number,
          verificationCode,
          signedHash,
          diagnosis: input.diagnosis,
          investigationRecommendations: input.investigationRecommendations,
          followUpInstructions: input.followUpInstructions,
          version: current.version + 1,
          previousVersionId: current.id,
          isCurrent: true,
          correctionReason: input.correctionReason,
          status: 'ISSUED',
          items: {
            create: input.items.map((item) => ({
              medicineName: item.medicineName,
              dosage: item.dosage,
              frequency: item.frequency,
              durationDays: item.durationDays,
              quantity: item.quantity,
              genericName: item.genericName,
              brandName: item.brandName,
              strength: item.strength,
              foodInstructions: item.foodInstructions,
              specialInstructions: item.specialInstructions,
            })),
          },
        },
        include: { items: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          clinicId,
          action: 'PRESCRIPTION_CORRECTED',
          entityType: 'prescriptions',
          entityId: corrected.id,
          before: { prescriptionId: current.id, version: current.version },
          after: { prescriptionId: corrected.id, version: corrected.version },
        },
      });
      return corrected;
    });
  }

  async verify(code: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { verificationCode: code, isCurrent: true },
      include: {
        patient: { select: { firstName: true, lastName: true, medicalRecordNumber: true } },
        doctor: { select: { registrationNumber: true, specialty: true, user: { select: { displayName: true } } } },
      },
    });
    if (!prescription) throw new NotFoundException('Prescription verification code not found');
    if (!prescription.signedHash) {
      return { verified: false, reason: 'No server signing secret is configured', prescriptionNumber: prescription.prescriptionNumber };
    }
    return {
      verified: true,
      prescriptionNumber: prescription.prescriptionNumber,
      issuedAt: prescription.issuedAt,
      doctorName: prescription.doctor.user.displayName,
      registrationNumber: prescription.doctor.registrationNumber,
      patientId: prescription.patient.medicalRecordNumber,
    };
  }

  async versionHistory(actor: AuthenticatedUser, id: string) {
    if (actor.roles.includes('RECEPTIONIST'))
      throw new ForbiddenException('Clinical prescriptions are not accessible to receptionists');
    const patientSelf = actor.roles.includes('PATIENT');
    if (!patientSelf) this.authorization.assertPermissions(actor, [Permissions.CLINICAL_READ]);
    const clinicId = requireClinicId(actor);
    const root = await this.prisma.prescription.findFirst({
      where: {
        id,
        clinicId,
        ...(patientSelf ? { patient: { userId: actor.id } } : {}),
      },
      select: { id: true },
    });
    if (!root) throw new NotFoundException('Prescription not found');
    const versions: Array<{ id: string; prescriptionNumber: string; version: number; status: string; isCurrent: boolean; issuedAt: Date; correctionReason: string | null }> = [];
    let cursorId: string | null = root.id;
    const visited = new Set<string>();
    while (cursorId && !visited.has(cursorId)) {
      visited.add(cursorId);
      const record: {
        id: string;
        prescriptionNumber: string;
        version: number;
        status: string;
        isCurrent: boolean;
        issuedAt: Date;
        correctionReason: string | null;
        previousVersionId: string | null;
      } | null = await this.prisma.prescription.findFirst({
        where: { id: cursorId, clinicId },
        select: {
          id: true,
          prescriptionNumber: true,
          version: true,
          status: true,
          isCurrent: true,
          issuedAt: true,
          correctionReason: true,
          previousVersionId: true,
        },
      });
      if (!record) break;
      versions.push(record);
      cursorId = record.previousVersionId;
    }
    return { prescriptionId: root.id, versions: versions.sort((a, b) => a.version - b.version) };
  }
}

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Controller('prescriptions')
class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}
  @Get('search-medicines')
  searchMedicines(@CurrentUser() actor: AuthenticatedUser, @Query('search') search = '') {
    return this.prescriptions.searchMedicines(actor, search);
  }
  @Public()
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.prescriptions.verify(code);
  }
  @Post()
  @RequirePermissions(Permissions.PRESCRIPTION_CREATE)
  @ApiOperation({ summary: 'Issue a prescription for a consultation' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: PrescriptionCreateDto) {
    return this.prescriptions.create(actor, input);
  }
  @Get()
  @ApiOperation({ summary: 'List prescriptions visible to the authenticated user' })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: PrescriptionListQueryDto) {
    return this.prescriptions.list(actor, query);
  }
  @Get(':id')
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptions.get(actor, id);
  }
  @Get(':id/preview')
  preview(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptions.preview(actor, id);
  }
  @Get(':id/versions')
  versions(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptions.versionHistory(actor, id);
  }
  @Post(':id/correct')
  correct(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PrescriptionCorrectionDto,
  ) {
    return this.prescriptions.correct(actor, id, input);
  }
}

@Module({
  imports: [AuthorizationModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
