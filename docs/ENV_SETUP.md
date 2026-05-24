# Environment Setup

Canonical project folder: `C:\repos\CRM`

## Local Runtime

Use the local app at:

```text
http://127.0.0.1:37173
```

The required local database value is already present in:

- `apps/web/.env.local`
- `packages/db/.env`

```env
DATABASE_URL="postgresql://ai_crm:ai_crm_local_password@127.0.0.1:55432/ai_crm?schema=public"
```

## Where To Put Keys

Do not put real secrets into `.env.example`. Use it only as the checklist.

For local testing:

1. Put app/runtime keys in `apps/web/.env.local`.
2. Put Prisma database access in `packages/db/.env`.
3. Restart the dev server after changing env files.

For production:

1. Add the same required variables in the production host dashboard.
2. Set `DATABASE_URL` to the production Postgres connection string.
3. Run `pnpm db:deploy` before serving production traffic.

## Required Now

```env
DATABASE_URL=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

The app requires `DATABASE_URL` in development and production. Memory fallback is only for tests.

The assistant runtime now requires `OPENAI_API_KEY`; without it, assistant message submission fails instead of falling back to the earlier deterministic stub.

## Ready Placeholders

These are prepared in `.env.example` for upcoming integrations:

```env
NEXT_PUBLIC_APP_URL=""
AUTH_SECRET=""
NEXTAUTH_SECRET=""
NEXTAUTH_URL=""
CRM_ALLOWED_ADMIN_EMAILS="ekaterina.reyzbikh@gmail.com,olegp306@gmail.com"
OPENAI_API_KEY=""
OPENAI_MODEL=""
ANTHROPIC_API_KEY=""
RESEND_API_KEY=""
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""
STORAGE_PROVIDER=""
LOCAL_STORAGE_DIR=""
S3_ENDPOINT=""
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

The web app also loads values from the repository root `.env` at startup, without overriding variables already supplied by the process or production host.

## Telegram Lead Intake

The Telegram worker reads the repository root `.env` when started from the monorepo.

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_ALLOWED_CHAT_IDS=""
TELEGRAM_WORKSPACE_ID="workspace-demo"
TELEGRAM_POLL_INTERVAL_MS="5000"
TELEGRAM_TEST_MESSAGE=""
TELEGRAM_TEST_CHAT_ID=""
TELEGRAM_TEST_MESSAGE_ID=""
TELEGRAM_TEST_RECEIVED_AT=""
```

Run one polling pass locally with:

```bash
pnpm worker:telegram
```

Run continuous local polling while testing Telegram messages with:

```bash
pnpm worker:telegram:loop
```

For a local synthetic intake pass, set `TELEGRAM_TEST_MESSAGE` and optional `TELEGRAM_TEST_CHAT_ID`, `TELEGRAM_TEST_MESSAGE_ID`, and `TELEGRAM_TEST_RECEIVED_AT`; the worker will create a lead from that message instead of polling Telegram.

## OpenAI Assistant Runtime

Assistant message submission uses OpenAI chat completions and expects JSON action plans. For lead creation requests, OpenAI returns a `create_lead` action preview; after the user confirms it in the drawer, the existing assistant execution path creates the lead record in Postgres.

## Cloudflare R2 Storage

Cloudflare R2 is supported through the S3-compatible storage adapter.

```env
STORAGE_PROVIDER="s3"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_BUCKET="<bucket-name>"
S3_REGION="auto"
S3_ACCESS_KEY_ID="<r2-access-key-id>"
S3_SECRET_ACCESS_KEY="<r2-secret-access-key>"
```

Use `STORAGE_PROVIDER="local"` and `LOCAL_STORAGE_DIR="./.local-storage"` for local file storage. Uploaded DOCX templates are now written to object storage under keys such as `workspaces/<workspace-id>/templates/kp/<file-name>.docx`; generated document attachment metadata uses the same storage-key convention.
