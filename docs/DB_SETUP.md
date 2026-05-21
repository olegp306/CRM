# Database Setup

Last updated: 2026-05-21

Canonical workspace: `C:\repos\ai_crm`

## Local Development

Local development is DB-backed by default.

1. Start Postgres: `pnpm db:up`
2. Generate Prisma Client: `pnpm db:generate`
3. Apply migrations: `pnpm db:deploy`
4. Seed demo data: `pnpm db:seed`
5. Start the app: `pnpm dev -- --hostname 127.0.0.1 --port 3000`

Local Docker Postgres uses host port `55432` because port `5432` may already be occupied by a machine-level Postgres service.

## Runtime Rule

- `development` and `production` require `DATABASE_URL`.
- `test` may use in-memory stores for deterministic unit tests.
- Assistant repository, lead execution, generated documents, and document templates must not silently fall back to memory outside tests.

## Production

Production must provide `DATABASE_URL` and run Prisma migrations before serving app traffic:

- `pnpm db:generate`
- `pnpm db:deploy`

Do not rely on memory fallback in production.
