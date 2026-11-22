import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConsentCreateDto, FamilyMemberCreateDto } from '../common/domain.dto';
import { requireClinicId } from '../common/clinic-scope';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
class PatientSharingService {
  constructor(private readonly prisma: PrismaService) {}
  private async ownPatient(actor: AuthenticatedUser) {
    if (!actor.roles.includes('PATIENT')) throw new ForbiddenException('Patient access required');
    const patient = await this.prisma.patient.findFirst({
      where: { clinicId: requireClinicId(actor), userId: actor.id, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Patient profile not found');
    return patient;
  }
  async listFamily(actor: AuthenticatedUser) {
    const patient = await this.ownPatient(actor);
    return this.prisma.familyMember.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });
  }
  async addFamily(actor: AuthenticatedUser, input: FamilyMemberCreateDto) {
    const patient = await this.ownPatient(actor);
    return this.prisma.familyMember.create({ data: { patientId: patient.id, ...input } });
  }
  async removeFamily(actor: AuthenticatedUser, id: string) {
    const patient = await this.ownPatient(actor);
    const removed = await this.prisma.familyMember.deleteMany({
      where: { id, patientId: patient.id },
    });
    if (removed.count !== 1) throw new NotFoundException('Family member not found');
  }
  async listConsents(actor: AuthenticatedUser) {
    const patient = await this.ownPatient(actor);
    return this.prisma.consentRecord.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });
  }
  async grantConsent(actor: AuthenticatedUser, input: ConsentCreateDto) {
    const patient = await this.ownPatient(actor);
    return this.prisma.$transaction(async (db) => {
      await db.consentRecord.updateMany({
        where: { patientId: patient.id, consentType: input.consentType, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return db.consentRecord.create({
        data: {
          clinicId: requireClinicId(actor),
          patientId: patient.id,
          userId: actor.id,
          ...input,
        },
      });
    });
  }
  async revokeConsent(actor: AuthenticatedUser, id: string) {
    const patient = await this.ownPatient(actor);
    const revoked = await this.prisma.consentRecord.updateMany({
      where: { id, patientId: patient.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) throw new NotFoundException('Active consent not found');
  }
}

@ApiTags('Patient sharing')
@ApiBearerAuth()
@Controller('patient-sharing')
class PatientSharingController {
  constructor(private readonly sharing: PatientSharingService) {}
  @Get('family')
  @ApiOperation({ summary: 'List the authenticated patient family profiles' })
  family(@CurrentUser() actor: AuthenticatedUser) {
    return this.sharing.listFamily(actor);
  }
  @Post('family') addFamily(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: FamilyMemberCreateDto,
  ) {
    return this.sharing.addFamily(actor, input);
  }
  @Delete('family/:id') removeFamily(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sharing.removeFamily(actor, id);
  }
  @Get('consents') consents(@CurrentUser() actor: AuthenticatedUser) {
    return this.sharing.listConsents(actor);
  }
  @Post('consents') grant(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: ConsentCreateDto,
  ) {
    return this.sharing.grantConsent(actor, input);
  }
  @Post('consents/:id/revoke') revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sharing.revokeConsent(actor, id);
  }
}

@Module({ controllers: [PatientSharingController], providers: [PatientSharingService] })
export class PatientSharingModule {}
