# Backend tests

Run `pnpm --filter @cliniccare/backend test:authz` for authorization policy tests and `pnpm --filter @cliniccare/backend test:integration` for HTTP integration coverage. The integration suite boots the Nest application with a mocked persistence provider, so it does not require PostgreSQL or Redis. `pnpm --filter @cliniccare/backend db:test` verifies database constraints against a running PostgreSQL instance.
