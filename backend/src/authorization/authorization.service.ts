import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../infrastructure/prisma.service';

export const Permissions = {
  CLINIC_FULL_ACCESS: 'clinic:full_access',
  PATIENT_REGISTER: 'patient:register',
  PATIENT_READ: 'patient:read',
  USER_MANAGE: 'user:manage',
  DOCTOR_MANAGE: 'doctor:manage',
  CLINIC_MANAGE: 'clinic:manage',
  STAFF_MANAGE: 'staff:manage',
  APPOINTMENT_BOOK: 'appointment:book',
  APPOINTMENT_RESCHEDULE: 'appointment:reschedule',
  APPOINTMENT_CANCEL: 'appointment:cancel',
  QUEUE_MANAGE: 'queue:manage',
  APPOINTMENT_CHECK_IN: 'appointment:check_in',
  PAYMENT_RECORD: 'payment:record',
  RECEIPT_GENERATE: 'receipt:generate',
  CLINICAL_READ: 'clinical:read',
  CONSULTATION_CREATE: 'consultation:create',
  MEDICAL_RECORD_WRITE: 'medical_record:write',
  PRESCRIPTION_CREATE: 'prescription:create',
  DIAGNOSIS_EDIT: 'diagnosis:edit',
  FINANCE_ANALYTICS: 'finance:analytics',
  EXPENSE_READ: 'expense:read',
  FINANCE_WRITE: 'finance:write',
  NOTIFICATION_MANAGE: 'notification:manage',
  AUDIT_READ: 'audit:read',
  STAFF_PERMISSION_MANAGE: 'staff:permission_manage',
  DOCTOR_CREDENTIAL_MANAGE: 'doctor:credential_manage',
  PLATFORM_ADMIN: 'platform:admin',
} as const;

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}
  assertPermissions(actor: AuthenticatedUser, required: string[]) {
    if (actor.roles.includes('DOCTOR')) return;
    if (
      actor.roles.includes('PLATFORM_ADMIN') &&
      required.every((permission) => permission === Permissions.PLATFORM_ADMIN)
    )
      return;
    if (!required.every((permission) => actor.permissions.includes(permission)))
      throw new ForbiddenException('Insufficient permission');
  }
  assertClinicScope(actor: AuthenticatedUser, clinicId: string) {
    if (!actor.clinicId || actor.clinicId !== clinicId)
      throw new ForbiddenException('Cross-clinic access is forbidden');
  }
  assertPatientScope(actor: AuthenticatedUser, patientUserId?: string) {
    if (actor.roles.includes('DOCTOR') || actor.roles.includes('RECEPTIONIST')) return;
    if (actor.id !== patientUserId) throw new ForbiddenException('Patient data scope violation');
  }
  async assertPatientOrDependentScope(
    actor: AuthenticatedUser,
    patientId: string,
    patientUserId?: string,
  ) {
    if (actor.roles.includes('DOCTOR') || actor.roles.includes('RECEPTIONIST')) return;
    if (actor.id === patientUserId) return;
    const authorization = await this.prisma.familyMember.findFirst({
      where: { authorizedUserId: actor.id, dependentPatientId: patientId },
    });
    if (!authorization) throw new ForbiddenException('Dependent access has not been authorized');
  }
}
