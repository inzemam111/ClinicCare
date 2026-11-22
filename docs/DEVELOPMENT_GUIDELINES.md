# Development Guidelines

Use pnpm workspace commands, TypeScript strict mode, ESLint, and Prettier. Keep feature modules in the backend and make schema updates through Prisma migrations. Add validation at API boundaries, tests with every domain feature, and update the relevant architecture/API/security document when a cross-cutting decision changes.

Environment keys are documented in `.env.example`; copy it to `.env` for local development. Never commit real credentials.
