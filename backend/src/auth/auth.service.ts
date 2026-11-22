import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../infrastructure/prisma.service';
import { Permissions } from '../authorization/authorization.service';
import { JwtService } from './jwt.service';

type Device = { deviceName?: string; userAgent?: string; ipAddress?: string };
export const receptionistPermissionCodes = [
  Permissions.PATIENT_REGISTER,
  Permissions.PATIENT_READ,
  Permissions.APPOINTMENT_BOOK,
  Permissions.APPOINTMENT_RESCHEDULE,
  Permissions.APPOINTMENT_CANCEL,
  Permissions.QUEUE_MANAGE,
  Permissions.APPOINTMENT_CHECK_IN,
  Permissions.PAYMENT_RECORD,
  Permissions.RECEIPT_GENERATE,
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}
  async registerPatient(input: {
    clinicId: string;
    email: string;
    password: string;
    displayName: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone?: string;
  }) {
    await this.assertActiveClinic(input.clinicId);
    await this.ensureRole('PATIENT', 'Patient', [
      Permissions.PATIENT_READ,
      Permissions.APPOINTMENT_BOOK,
      Permissions.APPOINTMENT_RESCHEDULE,
      Permissions.APPOINTMENT_CANCEL,
      Permissions.PAYMENT_RECORD,
      Permissions.CLINICAL_READ,
    ]);
    const passwordHash = await this.password(input.password);
    return this.prisma.$transaction(async (db) => {
      const user = await db.user.create({
        data: { email: this.email(input.email), passwordHash, displayName: input.displayName },
      });
      const patient = await db.patient.create({
        data: {
          clinicId: input.clinicId,
          userId: user.id,
          medicalRecordNumber: `P-${randomBytes(8).toString('hex').toUpperCase()}`,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: new Date(input.dateOfBirth),
          phone: input.phone,
        },
      });
      const role = await db.role.findUniqueOrThrow({ where: { code: 'PATIENT' } });
      await db.userRole.create({
        data: { userId: user.id, roleId: role.id, clinicId: input.clinicId },
      });
      return { id: user.id, patientId: patient.id };
    });
  }
  async registerDoctor(input: {
    clinicId: string;
    email: string;
    password: string;
    displayName: string;
    registrationNumber: string;
    specialty?: string;
  }) {
    await this.ensureRole('DOCTOR', 'Doctor', [Permissions.CLINIC_FULL_ACCESS]);
    const passwordHash = await this.password(input.password);
    return this.prisma.$transaction(
      async (db) => {
        // A public registration can only claim an unassigned clinic. This prevents an
        // unauthenticated caller from adding themselves to an operating clinic.
        const clinic = await db.clinic.findFirst({
          where: { id: input.clinicId, deletedAt: null, primaryDoctorId: null },
          select: { id: true },
        });
        if (!clinic) throw new BadRequestException('Clinic is unavailable for doctor registration');
        const user = await db.user.create({
          data: { email: this.email(input.email), passwordHash, displayName: input.displayName },
        });
        const doctor = await db.doctor.create({
          data: {
            clinicId: input.clinicId,
            userId: user.id,
            registrationNumber: input.registrationNumber,
            specialty: input.specialty,
          },
        });
        const claimedClinic = await db.clinic.updateMany({
          where: { id: clinic.id, deletedAt: null, primaryDoctorId: null },
          data: { primaryDoctorId: doctor.id },
        });
        if (claimedClinic.count !== 1)
          throw new BadRequestException('Clinic is unavailable for doctor registration');
        const role = await db.role.findUniqueOrThrow({ where: { code: 'DOCTOR' } });
        await db.userRole.create({
          data: { userId: user.id, roleId: role.id, clinicId: input.clinicId },
        });
        return { id: user.id, doctorId: doctor.id };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async createReceptionist(input: {
    clinicId: string;
    email: string;
    password: string;
    displayName: string;
  }) {
    await this.assertActiveClinic(input.clinicId);
    // Receptionist access is assigned to the individual staff record.  The role
    // identifies the UI and policy boundary; it does not grant blanket access.
    await Promise.all(
      receptionistPermissionCodes.map((code) =>
        this.prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        }),
      ),
    );
    await this.ensureRole('RECEPTIONIST', 'Receptionist', []);
    const passwordHash = await this.password(input.password);
    return this.prisma.$transaction(async (db) => {
      const user = await db.user.create({
        data: { email: this.email(input.email), passwordHash, displayName: input.displayName },
      });
      const staff = await db.staff.create({
        data: { clinicId: input.clinicId, userId: user.id, title: 'Receptionist' },
      });
      const role = await db.role.findUniqueOrThrow({ where: { code: 'RECEPTIONIST' } });
      await db.userRole.create({
        data: { userId: user.id, roleId: role.id, clinicId: input.clinicId },
      });
      const permissions = await db.permission.findMany({
        where: { code: { in: receptionistPermissionCodes } },
        select: { id: true },
      });
      await db.staffPermission.createMany({
        data: permissions.map((permission) => ({ staffId: staff.id, permissionId: permission.id })),
      });
      return { id: user.id, staffId: staff.id };
    });
  }
  async login(email: string, password: string, device: Device) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.email(email) },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
        staff: {
          select: {
            isActive: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE' || user.staff?.isActive === false)
      throw new UnauthorizedException('Invalid credentials');
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new UnauthorizedException('Account temporarily locked');
    if (!(await compare(password, user.passwordHash))) {
      const failedLoginCount = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const assignment = user.roles[0];
    const clinicId = assignment?.clinicId ?? undefined;
    const roles = user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set([
        ...user.roles.flatMap((r) => r.role.permissions.map((p) => p.code)),
        ...(user.staff?.permissions.map(({ permission }) => permission.code) ?? []),
      ]),
    ];
    if (roles.some((role) => role === 'DOCTOR' || role === 'PLATFORM_ADMIN') || user.mfaEnabled) {
      const challenge = await this.createOtp(user.id, 'LOGIN_MFA');
      return { mfaRequired: true, challengeId: challenge.id };
    }
    const created = await this.createSession(user.id, clinicId, device);
    return this.tokens(
      created.session.id,
      user.id,
      clinicId,
      roles,
      permissions,
      false,
      created.refreshToken,
    );
  }
  async verifyOtp(challengeId: string, code: string, device: Device) {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id: challengeId },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: true } } } },
            staff: {
              select: {
                isActive: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });
    if (
      !challenge ||
      challenge.user.deletedAt ||
      challenge.user.status !== 'ACTIVE' ||
      challenge.user.staff?.isActive === false ||
      challenge.consumedAt ||
      challenge.expiresAt < new Date() ||
      challenge.attempts >= 5 ||
      !(await compare(code, challenge.codeHash))
    ) {
      if (challenge)
        await this.prisma.otpChallenge.updateMany({
          where: {
            id: challenge.id,
            consumedAt: null,
            expiresAt: { gt: new Date() },
            attempts: { lt: 5 },
          },
          data: { attempts: { increment: 1 } },
        });
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const consumed = await this.prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('Invalid or expired OTP');
    const clinicId = challenge.user.roles[0]?.clinicId ?? undefined;
    const created = await this.createSession(challenge.userId, clinicId, device);
    const roles = challenge.user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set([
        ...challenge.user.roles.flatMap((r) => r.role.permissions.map((p) => p.code)),
        ...(challenge.user.staff?.permissions.map(({ permission }) => permission.code) ?? []),
      ]),
    ];
    return this.tokens(
      created.session.id,
      challenge.userId,
      clinicId,
      roles,
      permissions,
      true,
      created.refreshToken,
    );
  }
  async refresh(refreshToken: string, device: Device) {
    const sessionId = refreshToken.split('.')[0];
    if (!uuidPattern.test(sessionId)) throw new UnauthorizedException('Invalid refresh token');
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: true } } } },
            staff: {
              select: {
                isActive: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt ||
      session.user.staff?.isActive === false ||
      !(await compare(refreshToken, session.refreshTokenHash))
    )
      throw new UnauthorizedException('Invalid refresh token');
    const rotatedSessionId = randomUUID();
    const rotatedRefreshToken = `${rotatedSessionId}.${randomBytes(48).toString('base64url')}`;
    const rotatedRefreshHash = await hash(rotatedRefreshToken, 12);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date(), revokeReason: 'rotated' },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Invalid refresh token');
      const newSession = await transaction.authSession.create({
        data: {
          id: rotatedSessionId,
          userId: session.userId,
          clinicId: session.clinicId,
          refreshTokenHash: rotatedRefreshHash,
          ...device,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      });
      return { session: newSession, refreshToken: rotatedRefreshToken };
    });
    const roles = session.user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set([
        ...session.user.roles.flatMap((r) => r.role.permissions.map((p) => p.code)),
        ...(session.user.staff?.permissions.map(({ permission }) => permission.code) ?? []),
      ]),
    ];
    const mfaVerified =
      session.user.mfaEnabled ||
      session.user.roles.some(
        (assignment) =>
          assignment.role.code === 'DOCTOR' || assignment.role.code === 'PLATFORM_ADMIN',
      );
    return this.tokens(
      rotated.session.id,
      session.userId,
      rotated.session.clinicId ?? undefined,
      roles,
      permissions,
      mfaVerified,
      rotated.refreshToken,
    );
  }
  async logout(sessionId: string) {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokeReason: 'logout' },
    });
  }
  async revokeAll(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'user_revoked' },
    });
  }
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: this.email(email) } });
    if (!user) return;
    const resetId = randomUUID();
    const token = `${resetId}.${randomBytes(32).toString('base64url')}`;
    await this.prisma.passwordResetToken.create({
      data: {
        id: resetId,
        userId: user.id,
        tokenHash: await hash(token, 12),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    return process.env.NODE_ENV === 'development' ? token : undefined;
  }
  async resetPassword(token: string, password: string) {
    const resetId = token.split('.')[0];
    if (!uuidPattern.test(resetId)) throw new BadRequestException('Invalid reset token');
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { id: resetId },
    });
    if (
      !reset ||
      reset.consumedAt ||
      reset.expiresAt <= new Date() ||
      !(await compare(token, reset.tokenHash))
    )
      throw new BadRequestException('Invalid reset token');
    const passwordHash = await this.password(password);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new BadRequestException('Invalid reset token');
      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      });
      await transaction.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'password_reset' },
      });
    });
  }
  private async createSession(userId: string, clinicId: string | undefined, device: Device) {
    const sessionId = randomUUID();
    const refreshToken = `${sessionId}.${randomBytes(48).toString('base64url')}`;
    const session = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        clinicId,
        refreshTokenHash: await hash(refreshToken, 12),
        ...device,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });
    return { session, refreshToken };
  }
  private async tokens(
    sessionId: string,
    userId: string,
    clinicId: string | undefined,
    roles: string[],
    permissions: string[],
    mfa: boolean,
    refreshToken?: string,
  ) {
    const accessToken = this.jwt.sign({
      sub: userId,
      sid: sessionId,
      cid: clinicId,
      roles,
      permissions,
      mfa,
    });
    return { accessToken, refreshToken, sessionId, expiresIn: 900, mfaVerified: mfa };
  }
  private async createOtp(userId: string, purpose: string) {
    const code = String(randomInt(100000, 1_000_000));
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        userId,
        purpose,
        codeHash: await hash(code, 12),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    if (process.env.NODE_ENV === 'development')
      console.info(`Development OTP for ${challenge.id}: ${code}`);
    return challenge;
  }
  private async ensureRole(code: string, name: string, permissionCodes: string[]) {
    const permissions = await Promise.all(
      permissionCodes.map((permissionCode) =>
        this.prisma.permission.upsert({
          where: { code: permissionCode },
          update: {},
          create: { code: permissionCode, description: permissionCode },
        }),
      ),
    );
    await this.prisma.role.upsert({
      where: { code },
      update: { name, permissions: { set: permissions.map((p) => ({ id: p.id })) } },
      create: { code, name, permissions: { connect: permissions.map((p) => ({ id: p.id })) } },
    });
  }
  private async assertActiveClinic(clinicId: string) {
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');
  }
  private async password(value: string) {
    if (value.length < 12)
      throw new BadRequestException('Password must have at least 12 characters');
    return hash(value, 12);
  }
  private email(value: string) {
    return value.trim().toLowerCase();
  }
}
