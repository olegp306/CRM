# CRM test/staging VM deployment

This test/staging deployment is designed so several projects can live on the same VM without port, container, database, or service-name conflicts.

## Current VM

- Host: `204.168.163.99`
- App directory: `/opt/apps/crm-test`
- Git branch: `codex/feedback-release-history-links-a11y`
- Web port: `3002`
- Local-only Postgres port: `15432`
- Compose project: `crm_test`
- Services:
  - `crm-test-web.service`
  - `crm-test-telegram.service`

## Multi-project rules

- Put each project under `/opt/apps/<project-env>`, for example `/opt/apps/crm-test` or `/opt/apps/booking-test`.
- Give each project a unique web port, for example `3002`, `3003`, `3004`.
- Give each project a unique local-only database port, for example `15432`, `15433`, `15434`.
- Use a unique Docker Compose project name with `docker-compose -p <project_env> ...`.
- Do not use global `container_name` in shared Compose files; Compose should generate project-scoped container names.
- Use unique systemd unit names per project, for example `crm-test-web.service`.
- Keep database ports bound to `127.0.0.1`; expose only web ports or reverse-proxy routes.
- Never share `DATABASE_URL` between production and test/staging. Each environment must have its own Postgres database, Docker Compose project, and Docker volume.
- The test stand must set `CRM_DEPLOYMENT_ENV="test"` and `NEXT_PUBLIC_CRM_DEPLOYMENT_ENV="test"` so the web UI shows a visible `TEST` marker.
- VM/systemd deployments must set `CRM_REQUIRE_DEPLOYMENT_CONFIRMATION="true"` and `CRM_DEPLOYMENT_CONFIRMATION` to the same value as `CRM_DEPLOYMENT_ENV`.
- Use a separate Telegram bot for each environment. One Telegram bot token belongs to exactly one environment and one database.

## Production/test isolation rule

Production and test may live on the same VM, but they are separate installations:

| Item | Production example | Test stand example |
| --- | --- | --- |
| App directory | `/opt/apps/crm-production` | `/opt/apps/crm-test` |
| Web port | `3001` | `3002` |
| DB host port | `15431` | `15432` |
| Compose project | `crm_production` | `crm_test` |
| Web service | `crm-production-web.service` | `crm-test-web.service` |
| Telegram service | `crm-production-telegram.service` | `crm-test-telegram.service` |
| Env marker | `CRM_DEPLOYMENT_ENV="production"` | `CRM_DEPLOYMENT_ENV="test"` |
| Env confirmation | `CRM_DEPLOYMENT_CONFIRMATION="production"` | `CRM_DEPLOYMENT_CONFIRMATION="test"` |
| Telegram bot marker | `TELEGRAM_BOT_ENV="production"` | `TELEGRAM_BOT_ENV="test"` |

The app also has a runtime guard:

- `CRM_DEPLOYMENT_ENV="test"` refuses to start unless `DATABASE_URL` points to a database whose name contains `test`, for example `ai_crm_test`.
- `CRM_DEPLOYMENT_ENV="production"` refuses to start against a test database.
- `CRM_REQUIRE_DEPLOYMENT_CONFIRMATION="true"` refuses to start unless `CRM_DEPLOYMENT_ENV` is explicitly `test` or `production`.
- `CRM_DEPLOYMENT_CONFIRMATION` must match `CRM_DEPLOYMENT_ENV`.
- If `TELEGRAM_BOT_TOKEN` is set, `TELEGRAM_BOT_ENV` must match `CRM_DEPLOYMENT_ENV`.

Before running migrations or seed commands, print the active `DATABASE_URL` and verify the port/database belongs to the intended environment. Do not run destructive reset commands against production.

## Deploy commands

```bash
mkdir -p /opt/apps
git clone --branch main --single-branch https://github.com/olegp306/CRM.git /opt/apps/crm-test
cd /opt/apps/crm-test
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
apt-get update
apt-get install -y libreoffice
```

LibreOffice is required for KP generation. The app copies the current uploaded DOCX template, replaces placeholders in that copy, then exports the rendered DOCX to PDF through `soffice`. If `soffice` is missing or PDF export fails, KP generation fails visibly instead of saving a DOCX-only artifact.

Create `/opt/apps/crm-test/.env` from the project env and set test-specific values:

```env
DATABASE_URL="postgresql://ai_crm:ai_crm_test_local_password@127.0.0.1:15432/ai_crm_test?schema=public"
NEXT_PUBLIC_APP_URL="http://204.168.163.99:3002"
NEXTAUTH_URL="http://204.168.163.99:3002"
CRM_DEPLOYMENT_ENV="test"
NEXT_PUBLIC_CRM_DEPLOYMENT_ENV="test"
CRM_DEPLOYMENT_CONFIRMATION="test"
CRM_REQUIRE_DEPLOYMENT_CONFIRMATION="true"
TELEGRAM_BOT_ENV="test"
API_PORT="3002"
PORT="3002"
TELEGRAM_TEST_MESSAGE=""
TELEGRAM_TEST_CHAT_ID=""
TELEGRAM_TEST_MESSAGE_ID=""
TELEGRAM_TEST_RECEIVED_AT=""
TELEGRAM_WORKER_MODE="loop"
SOFFICE_PATH="soffice"
```

For production, use a separate app directory, database port, database name, systemd units, and Telegram bot:

```env
DATABASE_URL="postgresql://ai_crm:<production-password>@127.0.0.1:15431/ai_crm?schema=public"
NEXT_PUBLIC_APP_URL="https://<production-hostname>"
NEXTAUTH_URL="https://<production-hostname>"
CRM_DEPLOYMENT_ENV="production"
NEXT_PUBLIC_CRM_DEPLOYMENT_ENV="production"
CRM_DEPLOYMENT_CONFIRMATION="production"
CRM_REQUIRE_DEPLOYMENT_CONFIRMATION="true"
TELEGRAM_BOT_ENV="production"
TELEGRAM_BOT_TOKEN="<production-bot-token>"
API_PORT="3001"
PORT="3001"
SOFFICE_PATH="soffice"
```

Start the isolated database:

```bash
POSTGRES_DB=ai_crm_test POSTGRES_PASSWORD=ai_crm_test_local_password DB_HOST_PORT=15432 docker-compose -p crm_test -f ops/test/docker-compose.yml up -d postgres
```

Production uses the production compose project and database port:

```bash
POSTGRES_DB=ai_crm POSTGRES_PASSWORD=<production-password> DB_HOST_PORT=15431 docker-compose -p crm_production -f ops/production/docker-compose.yml up -d postgres
```

Prepare and build:

```bash
echo "Using TEST database: postgresql://ai_crm:***@127.0.0.1:15432/ai_crm_test?schema=public"
DATABASE_URL="postgresql://ai_crm:ai_crm_test_local_password@127.0.0.1:15432/ai_crm_test?schema=public" pnpm --filter @app/db prisma:generate
DATABASE_URL="postgresql://ai_crm:ai_crm_test_local_password@127.0.0.1:15432/ai_crm_test?schema=public" pnpm --filter @app/db exec prisma migrate deploy --schema prisma/schema.prisma
DATABASE_URL="postgresql://ai_crm:ai_crm_test_local_password@127.0.0.1:15432/ai_crm_test?schema=public" pnpm --filter @app/db seed
pnpm build:web
```

Install systemd units:

```bash
cp ops/test/systemd/crm-test-web.service /etc/systemd/system/
cp ops/test/systemd/crm-test-telegram.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now crm-test-web.service
systemctl enable --now crm-test-telegram.service
```

## Verify

From the VM:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/leads
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/platform/feedback
journalctl -u crm-test-telegram.service -n 80 --no-pager
```

If the provider firewall does not expose `3002`, use an SSH tunnel:

```powershell
ssh -i $HOME\.ssh\hetzner_204_168_163_99 -N -L 43002:127.0.0.1:3002 root@204.168.163.99
```

Then open `http://localhost:43002/leads`.

For public staging URLs, prefer a reverse proxy such as Caddy or Nginx on `80/443`, with one hostname per project, for example `crm-staging.example.com` and `booking-staging.example.com`.
