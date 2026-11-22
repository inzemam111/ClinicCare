# ClinicCare

ClinicCare is a pnpm monorepo for doctor and patient mobile apps, an admin web app, and a NestJS API.

## Prerequisites

Node.js 20+, pnpm 9+, and Docker Desktop. Copy `.env.example` to `.env`, set a private `JWT_ACCESS_SECRET`, then start the complete local backend stack:

```bash
pnpm docker:up
docker compose ps
docker compose exec backend pnpm --filter @cliniccare/backend db:seed
```

Compose starts PostgreSQL, Redis, and the NestJS API; the API container applies committed Prisma migrations before starting. Verify `http://localhost:3000/api/v1/health` and browse the API at `http://localhost:3000/api/v1/docs`. To stop containers while keeping database data, run `pnpm docker:down`; to also delete the local database volume, run `docker compose down --volumes`.

The admin web and Expo mobile apps run outside Docker. Start them with `pnpm dev:admin`, `pnpm dev:doctor`, or `pnpm dev:patient`.

On a physical device, set `EXPO_PUBLIC_API_URL` to your computer's LAN address (for example `http://192.168.1.10:3000/api/v1`).

## Quality checks

`pnpm typecheck`, `pnpm lint`, and `pnpm build` validate the workspace. The Doctor App supports doctor and receptionist role-aware workflows, appointment operations, queue management, clinical workflows, and payment collection. The Patient App supports authentication, records, consent and family-profile workflows, server-backed appointment booking, payments, receipts, and medicine catalogue search. The admin web remains a visual preview with sample data; it is not a production Super Admin workflow and must not be deployed for live operations. Pharmacy partner data-model preparation is present, but no live licensed partner ordering integration has been enabled. See `docs/` for architecture and implementation decisions.

Database development checks: `pnpm --filter @cliniccare/backend db:test`. See `docs/database/DEVELOPMENT_ACCOUNTS.md` for non-production seed accounts.
