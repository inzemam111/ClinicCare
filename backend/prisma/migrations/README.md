# Prisma migrations

The initial schema migration is committed in this directory. After PostgreSQL is running, apply it locally with:

```powershell
pnpm --filter @cliniccare/backend db:migrate
```

The migration creates PostgreSQL's `citext` extension before the `User.email` column is created. For subsequent schema changes, generate and commit a new timestamped migration. In deployment environments, run `pnpm --filter @cliniccare/backend db:deploy`; never run `migrate dev`.
