import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';

export function requireClinicId(actor: AuthenticatedUser): string {
  if (!actor.clinicId) throw new ForbiddenException('A clinic-scoped account is required');
  return actor.clinicId;
}

export function assertClinic(actor: AuthenticatedUser, clinicId: string): void {
  if (!actor.clinicId || actor.clinicId !== clinicId) {
    throw new ForbiddenException('Cross-clinic access is forbidden');
  }
}
