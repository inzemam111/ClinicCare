# System Architecture

ClinicCare is a workspace monorepo. Expo powers independent Doctor and Patient React Native apps; Next.js powers the Admin web application; NestJS exposes a versioned REST API. PostgreSQL is the system of record and Redis supports transient data such as caching, rate-limit state, and queues in later phases.

All clients call `/api/v1`. Shared contracts live in `packages/shared-types`; reusable validation and API client boundaries are separate packages. The initial `/api/v1/health` endpoint proves API, PostgreSQL, and Redis connectivity.
