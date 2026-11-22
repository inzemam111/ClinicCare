import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

if (process.env.NODE_ENV === 'production')
  throw new Error('Development seed is disabled in production.');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('ClinicCareDev!2026', 12);
  const adminRole = await prisma.role.upsert({
    where: { code: 'PLATFORM_ADMIN' },
    update: {},
    create: { code: 'PLATFORM_ADMIN', name: 'Platform administrator', isPlatformRole: true },
  });
  const doctorRole = await prisma.role.upsert({
    where: { code: 'DOCTOR' },
    update: {},
    create: { code: 'DOCTOR', name: 'Doctor' },
  });
  const receptionistPermissions = await Promise.all(
    [
      'patient:register',
      'patient:read',
      'appointment:book',
      'appointment:reschedule',
      'appointment:cancel',
      'queue:manage',
      'appointment:check_in',
      'payment:record',
      'receipt:generate',
    ].map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );
  const receptionistRole = await prisma.role.upsert({
    where: { code: 'RECEPTIONIST' },
    update: { permissions: { set: [] } },
    create: {
      code: 'RECEPTIONIST',
      name: 'Receptionist',
      permissions: { connect: [] },
    },
  });
  const patientPermissions = await Promise.all(
    [
      'patient:read',
      'appointment:book',
      'appointment:reschedule',
      'appointment:cancel',
      'payment:record',
      'clinical:read',
    ].map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );
  const patientRole = await prisma.role.upsert({
    where: { code: 'PATIENT' },
    update: { permissions: { set: patientPermissions.map(({ id }) => ({ id })) } },
    create: {
      code: 'PATIENT',
      name: 'Patient',
      permissions: { connect: patientPermissions.map(({ id }) => ({ id })) },
    },
  });
  const clinic = await prisma.clinic.upsert({
    where: { slug: 'demo-clinic' },
    update: {},
    create: { name: 'Demo Clinic', slug: 'demo-clinic' },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cliniccare.test' },
    update: { passwordHash },
    create: { email: 'admin@cliniccare.test', displayName: 'Platform Admin', passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId_clinicId: { userId: admin.id, roleId: adminRole.id, clinicId: null } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@demo.clinic.test' },
    update: { passwordHash },
    create: { email: 'doctor@demo.clinic.test', displayName: 'Dr. Maya Rao', passwordHash },
  });
  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: {
      clinicId: clinic.id,
      userId: doctorUser.id,
      registrationNumber: 'DEV-REG-001',
      specialty: 'General Medicine',
    },
  });
  await prisma.clinic.update({ where: { id: clinic.id }, data: { primaryDoctorId: doctor.id } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_clinicId: { userId: doctorUser.id, roleId: doctorRole.id, clinicId: clinic.id },
    },
    update: {},
    create: { userId: doctorUser.id, roleId: doctorRole.id, clinicId: clinic.id },
  });
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@demo.clinic.test' },
    update: { passwordHash },
    create: { email: 'reception@demo.clinic.test', displayName: 'Asha Reception', passwordHash },
  });
  const receptionistStaff = await prisma.staff.upsert({
    where: { userId: receptionist.id },
    update: {},
    create: { clinicId: clinic.id, userId: receptionist.id, title: 'Receptionist' },
  });
  await prisma.staffPermission.deleteMany({ where: { staffId: receptionistStaff.id } });
  await prisma.staffPermission.createMany({
    data: receptionistPermissions.map(({ id: permissionId }) => ({
      staffId: receptionistStaff.id,
      permissionId,
    })),
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_clinicId: {
        userId: receptionist.id,
        roleId: receptionistRole.id,
        clinicId: clinic.id,
      },
    },
    update: {},
    create: { userId: receptionist.id, roleId: receptionistRole.id, clinicId: clinic.id },
  });
  for (const [email, firstName, lastName, mrn] of [
    ['patient1@demo.clinic.test', 'Arjun', 'Shah', 'DEV-0001'],
    ['patient2@demo.clinic.test', 'Nisha', 'Patel', 'DEV-0002'],
  ] as const) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, displayName: `${firstName} ${lastName}`, passwordHash },
    });
    await prisma.patient.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        clinicId: clinic.id,
        userId: user.id,
        medicalRecordNumber: mrn,
        firstName,
        lastName,
        dateOfBirth: new Date('1990-01-01'),
      },
    });
    await prisma.userRole.upsert({
      where: {
        userId_roleId_clinicId: { userId: user.id, roleId: patientRole.id, clinicId: clinic.id },
      },
      update: {},
      create: { userId: user.id, roleId: patientRole.id, clinicId: clinic.id },
    });
  }
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
