import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function expectReject(action: Promise<unknown>, label: string) {
  try { await action; throw new Error(`${label}: expected constraint rejection`); } catch (error) { if ((error as Error).message.includes('expected constraint')) throw error; }
}
async function main() {
  const clinic = await prisma.clinic.findFirstOrThrow({ where: { slug: 'demo-clinic' }, include: { doctors: true, patients: true } });
  if (clinic.doctors.length !== 1 || clinic.patients.length < 2) throw new Error('Seed relationship assertion failed');
  const doctor = clinic.doctors[0];
  await expectReject(prisma.appointment.create({ data: { clinicId: clinic.id, doctorId: doctor.id, patientId: clinic.patients[0].id, startsAt: new Date('2030-01-01T09:00:00Z'), endsAt: new Date('2030-01-01T09:15:00Z') } }).then(() => prisma.appointment.create({ data: { clinicId: clinic.id, doctorId: doctor.id, patientId: clinic.patients[1].id, startsAt: new Date('2030-01-01T09:00:00Z'), endsAt: new Date('2030-01-01T09:15:00Z') } })), 'appointment concurrency');
  console.log('Database integrity tests passed.');
}
main().finally(() => prisma.$disconnect());
