# CRM staging VM deployment

This staging deployment is designed so several projects can live on the same VM without port, container, or service-name conflicts.

## Current VM

- Host: `204.168.163.99`
- App directory: `/opt/apps/crm-staging`
- Git branch: `codex/feedback-release-history-links-a11y`
- Web port: `3002`
- Local-only Postgres port: `15432`
- Compose project: `crm_staging`
- Services:
  - `crm-staging-web.service`
  - `crm-staging-telegram.service`

## Multi-project rules

- Put each project under `/opt/apps/<project-env>`, for example `/opt/apps/crm-staging` or `/opt/apps/booking-staging`.
- Give each project a unique web port, for example `3002`, `3003`, `3004`.
- Give each project a unique local-only database port, for example `15432`, `15433`, `15434`.
- Use a unique Docker Compose project name with `docker-compose -p <project_env> ...`.
- Do not use global `container_name` in shared Compose files; Compose should generate project-scoped container names.
- Use unique systemd unit names per project, for example `crm-staging-web.service`.
- Keep database ports bound to `127.0.0.1`; expose only web ports or reverse-proxy routes.

## Deploy commands

```bash
mkdir -p /opt/apps
git clone --branch codex/feedback-release-history-links-a11y --single-branch https://github.com/olegp306/CRM.git /opt/apps/crm-staging
cd /opt/apps/crm-staging
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
```

Create `/opt/apps/crm-staging/.env` from the project env and set staging-specific values:

```env
DATABASE_URL="postgresql://ai_crm:ai_crm_local_password@127.0.0.1:15432/ai_crm?schema=public"
NEXT_PUBLIC_APP_URL="http://204.168.163.99:3002"
NEXTAUTH_URL="http://204.168.163.99:3002"
API_PORT="3002"
PORT="3002"
TELEGRAM_TEST_MESSAGE=""
TELEGRAM_TEST_CHAT_ID=""
TELEGRAM_TEST_MESSAGE_ID=""
TELEGRAM_TEST_RECEIVED_AT=""
TELEGRAM_WORKER_MODE="loop"
```

Start the isolated database:

```bash
DB_HOST_PORT=15432 docker-compose -p crm_staging -f ops/staging/docker-compose.yml up -d postgres
```

Prepare and build:

```bash
DATABASE_URL="postgresql://ai_crm:ai_crm_local_password@127.0.0.1:15432/ai_crm?schema=public" pnpm --filter @app/db prisma:generate
DATABASE_URL="postgresql://ai_crm:ai_crm_local_password@127.0.0.1:15432/ai_crm?schema=public" pnpm --filter @app/db exec prisma migrate deploy --schema prisma/schema.prisma
DATABASE_URL="postgresql://ai_crm:ai_crm_local_password@127.0.0.1:15432/ai_crm?schema=public" pnpm --filter @app/db seed
pnpm build:web
```

Install systemd units:

```bash
cp ops/staging/systemd/crm-staging-web.service /etc/systemd/system/
cp ops/staging/systemd/crm-staging-telegram.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now crm-staging-web.service
systemctl enable --now crm-staging-telegram.service
```

## Verify

From the VM:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/leads
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/platform/feedback
journalctl -u crm-staging-telegram.service -n 80 --no-pager
```

If the provider firewall does not expose `3002`, use an SSH tunnel:

```powershell
ssh -i $HOME\.ssh\hetzner_204_168_163_99 -N -L 43002:127.0.0.1:3002 root@204.168.163.99
```

Then open `http://localhost:43002/leads`.

For public staging URLs, prefer a reverse proxy such as Caddy or Nginx on `80/443`, with one hostname per project, for example `crm-staging.example.com` and `booking-staging.example.com`.
