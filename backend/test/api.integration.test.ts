import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { JwtService } from '../src/auth/jwt.service';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { RedisService } from '../src/infrastructure/redis.service';

const clinicId = 'c81b1b8c-31a0-4d7f-8ca1-6f74bc0b9a91';
const patientUserId = 'efc1a8b1-8680-4d59-8d55-1628fb0128bd';
const receptionistUserId = '7d114c5e-2b18-45e8-90d4-e377fbbe2d11';
const patientId = 'a135c1d9-605f-44d4-b0ba-94277003e047';
let app: INestApplication;
let baseUrl: string;
let jwt: JwtService;
let observedPatientWhere: Record<string, unknown> | undefined;
let observedPatientLookup: Record<string, unknown> | undefined;
let observedPrescriptionLookup: Record<string, unknown> | undefined;

const prismaMock = {
  ping: async () => true,
  authSession: {
    findUnique: async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      userId: where.id,
      clinicId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { status: 'ACTIVE', deletedAt: null },
    }),
  },
  auditLog: { create: async () => ({ id: 'audit-row' }) },
  patient: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      observedPatientWhere = where;
      return [
        {
          id: patientId,
          medicalRecordNumber: 'P-TEST-0001',
          firstName: 'Example',
          lastName: 'Patient',
          dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
          phone: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ];
    },
    count: async () => 1,
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      observedPatientLookup = where;
      return null;
    },
  },
  prescription: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      observedPrescriptionLookup = where;
      return null;
    },
  },
};

before(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaMock as unknown as PrismaService)
    .overrideProvider(RedisService)
    .useValue({ ping: async () => false })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  jwt = app.get(JwtService);
});

after(async () => {
  await app?.close();
});

function token(userId: string, roles: string[], permissions: string[] = []): string {
  return jwt.sign({ sub: userId, sid: userId, cid: clinicId, roles, permissions, mfa: true });
}

test('protected endpoints reject missing bearer tokens using the standard error shape', async () => {
  const response = await fetch(`${baseUrl}/patients`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('health endpoint reports unavailable dependencies without blocking startup', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 503);
});

test('patient collection is paginated and scoped to the authenticated patient', async () => {
  const response = await fetch(`${baseUrl}/patients?page=1&pageSize=10`, {
    headers: { authorization: `Bearer ${token(patientUserId, ['PATIENT'])}` },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data[0].id, patientId);
  assert.deepEqual(body.meta.pagination, { total: 1, page: 1, pageSize: 10 });
  assert.equal(observedPatientWhere?.userId, patientUserId);
  assert.equal(observedPatientWhere?.clinicId, undefined);
});

test('patient identifiers cannot be used to read another clinic or patient history', async () => {
  const response = await fetch(`${baseUrl}/patients/${patientId}/history`, {
    headers: { authorization: `Bearer ${token(patientUserId, ['PATIENT'])}` },
  });
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(observedPatientLookup?.userId, patientUserId);
});

test('a patient prescription lookup is scoped to that patient', async () => {
  const response = await fetch(`${baseUrl}/prescriptions/c81b1b8c-31a0-4d7f-8ca1-6f74bc0b9a92`, {
    headers: { authorization: `Bearer ${token(patientUserId, ['PATIENT'])}` },
  });
  assert.equal(response.status, 404);
  assert.deepEqual(observedPrescriptionLookup?.patient, { userId: patientUserId });
});

test('patients cannot enumerate duplicate-record candidates for their clinic', async () => {
  const response = await fetch(`${baseUrl}/patients/duplicates`, {
    headers: { authorization: `Bearer ${token(patientUserId, ['PATIENT'])}` },
  });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('a receptionist without patient-read permission is denied', async () => {
  const response = await fetch(`${baseUrl}/patients`, {
    headers: { authorization: `Bearer ${token(receptionistUserId, ['RECEPTIONIST'])}` },
  });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('a receptionist cannot access doctor-only clinical modules even with patient-read access', async () => {
  const headers = {
    authorization: `Bearer ${token(receptionistUserId, ['RECEPTIONIST'], ['patient:read'])}`,
  };
  for (const path of ['/consultations', '/medical-records', '/prescriptions']) {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    const body = await response.json();
    assert.equal(response.status, 403, `${path} must be restricted`);
    assert.equal(body.error.code, 'FORBIDDEN');
  }
});

test('DTO validation rejects malformed patient input', async () => {
  const response = await fetch(`${baseUrl}/patients`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token(receptionistUserId, ['RECEPTIONIST'], ['patient:register'])}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      firstName: '',
      lastName: 'Person',
      dateOfBirth: 'not-a-date',
      unexpected: true,
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'BAD_REQUEST');
});

test('Swagger JSON is reachable and includes the versioned API', async () => {
  const response = await fetch(`${baseUrl}/docs-json`);
  const document = await response.json();
  assert.equal(response.status, 200);
  const paths = Object.keys(document.paths);
  for (const resource of [
    'patients',
    'doctors',
    'clinics',
    'staff',
    'appointments',
    'consultations',
    'medical-records',
    'prescriptions',
    'payments',
    'income',
    'expenses',
    'finance',
    'notifications',
    'audit-logs',
  ]) {
    assert.ok(
      paths.some((path) => path.includes(`/${resource}`)),
      `missing Swagger path for ${resource}`,
    );
  }
});
