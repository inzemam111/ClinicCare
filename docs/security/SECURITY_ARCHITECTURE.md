# Security Architecture

Secrets live in untracked `.env` files and are never committed. The backend centralizes data access; clients do not connect to PostgreSQL or Redis. Planned controls include role-based authorization, short-lived access tokens, refresh-token rotation, TLS, encrypted backups, audit trails, rate limiting, input validation, and least-privilege database credentials.

Do not include protected health information in logs, analytics, error messages, or local development fixtures. HTTP logs contain request IDs, route templates, method, status, and duration only.

## Authentication and authorization

The NestJS backend enforces authentication globally. Only routes explicitly marked `@Public()` can bypass it. Access tokens are short-lived HS256 signed tokens; every protected request additionally checks that its `AuthSession` is active and unexpired, so logout and session revocation take effect immediately. Refresh tokens are random, bcrypt-hashed at rest, rotated on use, and tied to a tracked device/session.

Login attempts are rate limited in Redis and accounts lock after five consecutive failed password attempts for 15 minutes. Privileged doctor and platform-admin logins require a one-time MFA challenge. OTPs are bcrypt-hashed, expire after five minutes, are single-use, and permit at most five verification attempts. Development OTPs are written only to the local backend console; a production notification provider must deliver them.

`PermissionsGuard`, `AuthorizationService`, and `@RequirePermissions()` enforce RBAC on the backend. Clinic scope is checked separately and never inferred from request input. Patient account access is limited to the patient's own clinic records. Receptionists receive operational permissions only; platform administrators cannot read clinic clinical data by default. Authenticated write requests create metadata-only `AuditLog` events; request and response bodies are not recorded.

The REST API validates request DTOs with `class-validator`, rejects unknown body fields, uses allow-listed sort fields, and returns a consistent response/error envelope. Swagger documentation is available at `/api/v1/docs`.
