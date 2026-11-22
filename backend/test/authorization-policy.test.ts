import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthorizationService, Permissions } from '../src/authorization/authorization.service';
const service = new AuthorizationService({
  familyMember: { findFirst: async () => null },
} as never);
const receptionist = {
  id: 'r',
  sessionId: 's',
  clinicId: 'clinic-a',
  roles: ['RECEPTIONIST'],
  permissions: [
    Permissions.PATIENT_REGISTER,
    Permissions.PATIENT_READ,
    Permissions.APPOINTMENT_BOOK,
    Permissions.APPOINTMENT_RESCHEDULE,
    Permissions.APPOINTMENT_CANCEL,
    Permissions.QUEUE_MANAGE,
    Permissions.APPOINTMENT_CHECK_IN,
    Permissions.PAYMENT_RECORD,
    Permissions.RECEIPT_GENERATE,
  ],
  mfaVerified: true,
};
test('doctor has complete access only within their clinic', () => {
  const doctor = { ...receptionist, roles: ['DOCTOR'], permissions: [] };
  assert.doesNotThrow(() => service.assertPermissions(doctor, [Permissions.EXPENSE_READ]));
  assert.throws(() => service.assertClinicScope(doctor, 'clinic-b'));
});
test('receptionist has operational permissions but no clinical or analytics access', () => {
  assert.doesNotThrow(() =>
    service.assertPermissions(receptionist, [
      Permissions.APPOINTMENT_BOOK,
      Permissions.PAYMENT_RECORD,
    ]),
  );
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.CLINICAL_READ]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.CONSULTATION_CREATE]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.MEDICAL_RECORD_WRITE]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.PRESCRIPTION_CREATE]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.DIAGNOSIS_EDIT]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.FINANCE_ANALYTICS]));
  assert.throws(() => service.assertPermissions(receptionist, [Permissions.EXPENSE_READ]));
  assert.throws(() =>
    service.assertPermissions(receptionist, [Permissions.DOCTOR_CREDENTIAL_MANAGE]),
  );
  assert.throws(() =>
    service.assertPermissions(receptionist, [Permissions.STAFF_PERMISSION_MANAGE]),
  );
});
test('patient can only access their own profile', () => {
  const patient = { ...receptionist, id: 'patient-user', roles: ['PATIENT'], permissions: [] };
  assert.doesNotThrow(() => service.assertPatientScope(patient, 'patient-user'));
  assert.throws(() => service.assertPatientScope(patient, 'someone-else'));
});
test('platform admin cannot cross clinic into clinical operations', () => {
  const admin = {
    ...receptionist,
    clinicId: undefined,
    roles: ['PLATFORM_ADMIN'],
    permissions: [Permissions.PLATFORM_ADMIN],
  };
  assert.doesNotThrow(() => service.assertPermissions(admin, [Permissions.PLATFORM_ADMIN]));
  assert.throws(() => service.assertPermissions(admin, [Permissions.CLINICAL_READ]));
  assert.throws(() => service.assertClinicScope(admin, 'clinic-a'));
});
