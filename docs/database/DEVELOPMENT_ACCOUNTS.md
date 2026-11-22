# Development Accounts

`pnpm --filter @cliniccare/backend db:seed` creates only development data and aborts if `NODE_ENV=production`.

| Account | Email | Password | Role |
|---|---|---|---|
| Platform admin | admin@cliniccare.test | `ClinicCareDev!2026` | Platform administrator |
| Doctor | doctor@demo.clinic.test | `ClinicCareDev!2026` | Doctor / primary doctor |
| Receptionist | reception@demo.clinic.test | `ClinicCareDev!2026` | Receptionist |
| Patient 1 | patient1@demo.clinic.test | `ClinicCareDev!2026` | Patient |
| Patient 2 | patient2@demo.clinic.test | `ClinicCareDev!2026` | Patient |

These are public, disposable credentials. Passwords are hashed with bcrypt before insertion and must never be enabled or copied to production.
