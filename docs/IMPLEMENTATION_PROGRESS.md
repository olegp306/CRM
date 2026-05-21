# AI CRM Implementation Progress

Last updated: 2026-05-21

Canonical workspace: `C:\repos\CRM`

## Workspace Rule

- [x] Canonical implementation folder is `C:\repos\CRM`.
- [x] Root agent instruction file exists: `AGENTS.md`.
- [x] Future implementation, tests, dev server work, and progress updates must happen from `C:\repos\CRM`.
- [x] Do not continue work from OneDrive or any other copy.

## Current Position

We are in the R4 L01 lead intake phase. Local development now has Docker Postgres on port `55432`, Prisma migration history, seeded demo data, and DB-backed runtime for assistant repository, lead execution, generated documents, and document templates. The monorepo, app shell, CRM helper packages, assistant orchestration, multi-user session resolution, platform feedback queue/export/bulk actions, assistant audit trail including executed actions, audit review filters/export/summary, feedback triage transitions and filters, Prisma assistant write-plan shape, Prisma repository adapter, assistant action execution path, durable Prisma lead creation adapter, durable generated document adapter with DOCX/PDF attachment history, template validation, template upload attachment metadata, Today due follow-up view, follow-up scheduling execution, project task update execution, and KP document generation execution are in place.

## Database Rule

- [x] Local Docker Postgres runs as `ai-crm-postgres` on host port `55432`.
- [x] Local `apps/web/.env.local` and `packages/db/.env` point to the Docker Postgres database.
- [x] Development and production runtime require `DATABASE_URL`; memory fallback is allowed only in tests.
- [x] Prisma migration `20260521124500_init` is present and marked applied locally.

## First Four Product Cards

- [x] Card 1: App foundation and workspace shell
  - Monorepo, Next app, shared packages, Tailwind/theme, app sidebar, base routes.
- [x] Card 2: CRM deterministic core
  - Leads, clients, project helpers, price table helpers, document placeholders, seed data.
- [x] Card 3: Assistant workflow foundation
  - Context capture, intent classification, submit flow, action preview, confirmation state, memory persistence.
  - Prisma write-plan shape, repository adapter, runtime DB selection, action confirmation execution, create-lead execution, schedule-follow-up execution, project-task update execution, and KP document generation execution are ready.
  - Workspace/user/role can now resolve from request-like values with demo fallback.
  - Generated KP documents can render a template preview and persist through a Prisma adapter when DB config is present.
  - Larger checkpoint validation passed.
- [x] Card 4: Platform operations
  - Feedback inbox reads assistant memory drafts.
  - Audit page reads assistant submission/action preview events.
  - Feedback items can move through triage states.
  - Runtime can switch platform ops to Prisma-backed storage when `DATABASE_URL` is configured.
  - Feedback can be filtered by status/type, and executed assistant actions are audited.
  - Feedback can be exported as CSV and bulk-triaged from the current filtered queue.
  - Audit events can be filtered, summarized, and exported as CSV.
  - Larger checkpoint validation passed.

Estimated coverage of first four cards: 100%.

## Completed Blocks

- [x] Repository and workspace skeleton
- [x] Next app shell with app/platform route groups
- [x] Shared UI/theme/i18n helpers
- [x] Prisma schema and seed-data shape
- [x] Auth permissions, route guards, invites, workspace access helpers
- [x] CRM dictionaries, IDs, lead/client/project/pricing helpers
- [x] Assistant intent classification, action preview, permission blocked responses
- [x] Assistant context capture, thread/message drafts, confirmation state
- [x] Assistant drawer submit flow with conversation history
- [x] Workspace session provider stub for future auth integration
- [x] Assistant persistence draft contract
- [x] Server-side in-memory assistant repository
- [x] Platform feedback inbox summary and UI
- [x] Assistant audit event drafts and platform audit UI
- [x] Platform feedback triage transitions
- [x] Prisma assistant write-plan shape
- [x] Prisma assistant repository wiring behind shared contract
- [x] Assistant action confirmation execution path
- [x] Lead creation action execution from assistant preview
- [x] Runtime switch from memory repository to Prisma repository when database config is available
- [x] Durable lead creation through Prisma when database config is available
- [x] Assistant execution audit event for confirmed/executed actions
- [x] DB-backed platform feedback filters and admin triage surface
- [x] Multi-user session integration for assistant persistence
- [x] Platform feedback CSV export
- [x] Platform feedback admin bulk actions
- [x] Platform feedback release version triage, release notes export, release planning actions, release workflow checklist, and release readiness summary
- [x] Schedule follow-up assistant action preview and execution
- [x] Project task update assistant action preview and execution
- [x] KP document generation assistant action preview and execution
- [x] Platform audit review filters, summary, and CSV export
- [x] Durable generated document rendering/storage adapter
- [x] Larger checkpoint full build
- [x] R3 Template Manager foundation
- [x] R3 Template upload and attachment storage
- [x] R3 Generated DOCX/PDF attachment history
- [x] R3 Documents checkpoint full build
- [x] R4 L01 Today follow-up view
- [x] Card 1 validation test cases
- [x] Loop 1 L01 Lead Intake validation test cases
- [x] Real local DB runtime setup and smoke verification
- [x] Loop 2 L02 Bautraeger Cold Outreach deterministic validation test cases
- [x] Loop 3 L03 Project Operations deterministic validation test cases
- [x] Visible route-loading feedback in the app sidebar
- [x] Environment setup checklist for local and production testing
- [x] DB-backed Clients, Leads, and Projects list states
- [x] Full 2026 honorar table and Chiemgau cold target seed/import
- [x] Root env loader and Cloudflare R2-compatible object storage adapter
- [x] OpenAI assistant runtime for action previews
- [x] L01 web and Telegram lead intake entry points

## Current Block

- [ ] Loop 3 L03 Project Operations UI and DB persistence

Latest verification:

- L01 web and Telegram lead intake:
  - Added a shared `LeadIntakeDraft` pipeline for manual web input and Telegram-style inbound messages.
  - Telegram paste intake now normalizes sender name, message text, message URL, email, phone, BGF, request type, address, missing data, and standardness into the same draft shape used by manual web intake.
  - `/leads` now includes a manual `Create lead` form and a `Telegram intake` paste form; both create DB lead records through the same store.
  - New lead IDs are allocated with the existing business ID sequence and stored with `new` or `needs_data` status depending on missing fields.
  - `pnpm --filter @app/core test`: 16 files, 46 tests passed.
  - `pnpm --filter @app/web test`: 17 files, 40 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/leads` returned 200 and rendered both `Create lead` and `Telegram intake`.

- OpenAI assistant runtime:
  - Added an OpenAI provider for assistant submissions using JSON action plans.
  - Web assistant submission now requires `OPENAI_API_KEY`; it no longer silently falls back to the deterministic stub in runtime.
  - OpenAI `create_lead` plans are converted into the existing confirmation preview, so confirmed actions still execute through the existing DB-backed lead creation path.
  - `.env.example` and `docs/ENV_SETUP.md` now mark OpenAI as an active assistant runtime requirement.
  - Real OpenAI smoke with the configured local key returned `create_lead` and `awaiting_confirmation`.
  - `pnpm --filter @app/assistant test`: 18 files, 56 tests passed.
  - `pnpm --filter @app/assistant typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.

- Environment and object storage:
  - Web startup now loads repository root `.env` without overriding values supplied by the process or production host.
  - Added an object storage adapter with `local` and S3-compatible modes; Cloudflare R2 is supported via `S3_ENDPOINT`, bucket, region, access key, and secret key.
  - Template DOCX uploads now write the physical file to configured object storage before storing attachment metadata in Postgres.
  - `.env.example` and `docs/ENV_SETUP.md` now include `S3_ENDPOINT` and Cloudflare R2 setup guidance.
  - `pnpm --filter @app/core test`: 15 files, 43 tests passed.
  - `pnpm --filter @app/web test`: 16 files, 39 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.

- Honorar table and cold targets:
  - Price table schema now stores BGF range, approximate Wohnfläche, LP3 net, LP4 net, total net, MwSt 19%, and total gross.
  - Added `parseHonorartabelleTsv` for paste/file replacement of the 2026 honorar table.
  - Extended cold target import parsing for TSV/CSV with `target_id`, `client_id`, `fit_score`, and `priority`.
  - Demo seed now loads 31 honorar rows and 11 researched cold targets into `workspace-demo`.
  - `/settings/price-table` reads the DB table and can replace it from pasted TSV or uploaded CSV/TSV/TXT.
  - `/outreach` reads DB cold targets and can replace them from pasted TSV/CSV or uploaded CSV/TSV/TXT.
  - Migration `20260521162000_price_table_details` applied locally; `pnpm db:status`: database schema is up to date.
  - `pnpm db:seed`: completed successfully.
  - Local DB counts: 31 price rows, 11 cold targets.
  - HTTP smoke confirmed `/settings/price-table` renders `HONORARTABELLE 2026`, `8.035 EUR`, `250-254`, and `/outreach` renders `Projektbau Chiemgau` through `T-2026-011`.
  - `pnpm --filter @app/core test`: 14 files, 39 tests passed.
  - `pnpm --filter @app/db test`: 7 files, 20 tests passed.
  - `pnpm --filter @app/web test`: 14 files, 34 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/db typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.

- DB-backed CRM list states:
  - Clients, Leads, and Projects pages now query Postgres for the current workspace instead of showing early placeholder text.
  - Empty completed lookups show explicit messages: `No clients found yet.`, `No leads found yet.`, `No projects found yet.`
  - Demo seed data now uses stable IDs matching the local demo session: `workspace-demo` and `user-demo`.
  - `pnpm db:seed`: completed successfully.
  - Local demo DB counts for `workspace-demo`: 2 clients, 2 leads, 1 project.
  - HTTP smoke confirmed `/clients`, `/leads`, and `/projects` render seeded records.
  - `pnpm --filter @app/web test`: 14 files, 34 tests passed.
  - `pnpm --filter @app/db test`: 7 files, 19 tests passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - `pnpm --filter @app/db typecheck`: passed.

- Environment setup:
  - `.env.example` now lists the required DB variable plus prepared placeholders for app URL, auth/session, LLM providers, email, file storage, and optional integrations.
  - `docs/ENV_SETUP.md` explains where to put local keys, where production variables belong, and which variables are currently read by the app.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/` returned 200.

- Navigation loading UX:
  - App sidebar now uses client-side `Link` navigation and immediately marks the clicked pending route as visually active.
  - Pending routes show a pulsing dot in the nav item; the previous bottom loading text under the nav was removed.
  - Main page content immediately switches to a target-route preview shell, then dims and blurs while the route transition is pending.
  - Separate visible route loader/skeleton overlays were removed; the app relies on active nav state, the pulsing nav dot, and blurred pending content.
  - Route group `loading.tsx` intentionally returns `null` so app-page streaming/loading states do not add another loader.
  - `pnpm --filter @app/web test -- components/app-transition.test.ts components/app-navigation.test.ts`: 2 files, 7 tests passed.
  - `pnpm --filter @app/web test`: 15 files, 38 tests passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/clients` returned 200.
  - Remaining gap: in-app browser automation was unavailable in this session, so the final click-through visual check should be done manually at `http://127.0.0.1:37173`.

- Loop 3 L03 Project Operations deterministic validation:
  - `packages/core/src/projects/project-template.test.ts`: validates the 12 L03 project phases and decision-log setup task.
  - `packages/core/src/projects/project-operations.test.ts`: validates project workspace creation, task/checklist updates, decision superseding, file attachments, historical generated documents, and CRM identity.
  - `apps/web/app/(app)/projects/l03-project-operations-loop.test.ts`: deterministic full loop from project workspace creation to task update, checklist completion, decision supersede, file attachment lifecycle, external links, and preserved CRM identity.
  - `pnpm --filter @app/core test`: 14 files, 37 tests passed.
  - `pnpm --filter @app/web test`: 13 files, 29 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/projects` returned 200.
  - Remaining gaps: project detail UI with tabs, DB-backed persistence for phases/tasks/checklists/decisions/files, browser-click E2E.

- Loop 2 L02 Bautraeger Cold Outreach deterministic validation:
  - `packages/core/src/outreach/cold-outreach.test.ts`: CSV import, duplicate/missing-company warnings, 8-touch cadence, persona hook generation, sent-touch advancement, outcome rules, conversion to Client + Lead and inactive target history.
  - `apps/web/app/(app)/outreach/l02-cold-outreach-loop.test.ts`: deterministic full loop from CSV row to cadence, sent touch, interested outcome, conversion records, and archived target update.
  - `pnpm --filter @app/core test`: 13 files, 33 tests passed.
  - `pnpm --filter @app/web test`: 12 files, 28 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/outreach` returned 200.
  - Remaining gaps: CSV import UI, DB-backed ColdTarget/OutreachTouch persistence flow, browser-click E2E.

- Real local DB runtime:
  - `docker compose up -d postgres`: local Postgres started as `ai-crm-postgres`.
  - `pnpm db:generate`: Prisma Client generated.
  - Initial migration SQL applied to Docker Postgres and marked applied with Prisma.
  - `pnpm --filter @app/db exec prisma migrate status --schema prisma/schema.prisma`: database schema is up to date.
  - `pnpm db:seed`: seed completed.
  - Prisma real DB smoke created one lead, one generated KP document, and two attachment records in Postgres.
  - DB-backed HTTP smoke returned 200 for `/leads`, `/leads/intake-preview`, `/documents`, `/today`, `/settings/templates`, `/platform/feedback`, `/platform/audit`.
  - `pnpm --filter @app/db test`: 7 files, 19 tests passed.
  - `pnpm --filter @app/web test`: 11 files, 27 tests passed.
  - `pnpm --filter @app/db typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.

- Loop 1 L01 Lead Intake validation:
  - `pnpm --filter @app/core test`: 12 files, 28 tests passed.
  - `pnpm --filter @app/assistant test`: 17 files, 54 tests passed.
  - `pnpm --filter @app/web test`: 10 files, 20 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/assistant typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/leads`, `/leads/intake-preview`, `/documents`, `/today` returned 200.
  - Coverage estimate: 100% of the current deterministic L01 acceptance path is covered; remaining gap is a full browser-click E2E with real upload/DB.

- Card 1 validation:
  - `pnpm --filter @app/web test`: 9 files, 19 tests passed.
  - `pnpm --filter @app/ui test`: 2 files, 5 tests passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - `pnpm --filter @app/ui typecheck`: passed.
  - HTTP smoke: `/`, `/today`, `/clients`, `/leads`, `/projects`, `/settings`, `/assistant/preview` returned 200.

Previous R4 verification:

- `pnpm --filter @app/core test`: 12 files, 28 tests passed.
- `pnpm --filter @app/web test`: 7 files, 17 tests passed.
- `pnpm --filter @app/core typecheck`: passed.
- `pnpm --filter @app/web typecheck`: passed.
- HTTP smoke:
  - `/today`: 200 `text/html; charset=utf-8`
  - `/leads/intake-preview`: 200 `text/html; charset=utf-8`

Previous R4/R3 checkpoint verification:

- `pnpm build`: passed.
- Post-build dev server smoke:
  - `/documents`: 200 `text/html; charset=utf-8`
  - `/settings/templates`: 200 `text/html; charset=utf-8`
  - `/leads/intake-preview`: 200 `text/html; charset=utf-8`

Previous R3 verification:

- `pnpm --filter @app/core test`: 11 files, 27 tests passed.
- `pnpm --filter @app/assistant test`: 17 files, 54 tests passed.
- `pnpm --filter @app/db test`: 6 files, 17 tests passed.
- `pnpm --filter @app/web test`: 6 files, 16 tests passed.
- Release planning audit trail:
  - `Plan release items` now writes a `platform.release.planned` audit event with `appVersion`, planned count, skipped count, and actor user ID.
  - Memory and Prisma assistant repositories both support explicit audit event persistence.
  - `/platform/audit` parsing and action filters include release planning events.
- Release planning history:
  - `/platform/feedback` now includes a `Release history` panel sourced from `platform.release.planned` audit events.
  - The platform inbox summary returns `releaseHistory` with version, actor, planned count, skipped count, and `releaseHistorySummary` totals plus actor counts.
  - The release history panel explains that its list and CSV export follow the selected version filter.
  - The release history summary shows the active history scope (`All versions` or the selected app version).
  - Version-scoped release history includes a `View all history` link to clear the selected app version.
  - The release history empty state points operators to `Plan release items` so the first audit-backed history event is discoverable.
  - `/platform/feedback/release-history/export` exports release planning history as CSV and follows the selected `appVersion` filter.
- `pnpm --filter @app/core typecheck`: passed.
- `pnpm --filter @app/assistant typecheck`: passed.
- `pnpm --filter @app/db typecheck`: passed.
- `pnpm --filter @app/web typecheck`: passed.
- HTTP smoke:
  - `/documents`: 200 `text/html; charset=utf-8`
  - `/settings/templates`: 200 `text/html; charset=utf-8`

Previous R3 verification:

- `pnpm --filter @app/core test`: 10 files, 25 tests passed.
- `pnpm --filter @app/db test`: 6 files, 17 tests passed.
- `pnpm --filter @app/web test`: 6 files, 15 tests passed.
- `pnpm --filter @app/core typecheck`: passed.
- `pnpm --filter @app/db typecheck`: passed.
- `pnpm --filter @app/web typecheck`: passed.
- HTTP smoke:
  - `/settings/templates`: 200 `text/html; charset=utf-8`
  - `/documents`: 200 `text/html; charset=utf-8`

Previous R3 verification:

- `pnpm --filter @app/documents test`: 3 files, 5 tests passed.
- `pnpm --filter @app/db test`: 6 files, 16 tests passed.
- `pnpm --filter @app/web test`: 6 files, 14 tests passed.
- `pnpm --filter @app/documents typecheck`: passed.
- `pnpm --filter @app/db typecheck`: passed.
- `pnpm --filter @app/web typecheck`: passed.
- HTTP smoke:
  - `/settings`: 200 `text/html; charset=utf-8`
  - `/settings/templates`: 200 `text/html; charset=utf-8`
  - `/documents`: 200 `text/html; charset=utf-8`

Previous checkpoint verification:

- `pnpm build`: passed after stopping the local `next dev` process that was locking `apps/web/.next/trace`; dev server was restarted afterward.
- `pnpm test:assistant`: 17 files, 54 tests passed.
- `pnpm --filter @app/web test`: 5 files, 12 tests passed.
- `pnpm --filter @app/db test`: 5 files, 14 tests passed.
- `pnpm --filter @app/documents test`: 2 files, 3 tests passed.
- `pnpm --filter @app/assistant typecheck`: passed.
- `pnpm --filter @app/web typecheck`: passed.
- `pnpm --filter @app/db typecheck`: passed.
- `pnpm --filter @app/documents typecheck`: passed.
- HTTP smoke:
  - `/platform/feedback`: 200 `text/html; charset=utf-8`
  - `/platform/audit`: 200 `text/html; charset=utf-8`
  - `/platform/audit/export?action=assistant.action.executed`: 200 `text/csv; charset=utf-8`
  - `/leads`: 200 `text/html; charset=utf-8`
  - `/projects`: 200 `text/html; charset=utf-8`
  - `/documents`: 200 `text/html; charset=utf-8`
- Post-build dev server smoke:
  - `/platform/feedback`: 200 `text/html; charset=utf-8`
  - `/documents`: 200 `text/html; charset=utf-8`

## Next Blocks

- [ ] Loop 3 L03 Project Operations UI and DB persistence
- [ ] Loop 2 L02 Bautraeger Cold Outreach UI and DB persistence
- [x] R4 L01 KP sent status action

- R4 L01 KP sent status action:
  - Added `createKpSentLeadUpdate` to mark a lead as `kp_sent`, set `kpSentDate`, and plan the first follow-up seven days later.
  - Assistant previews and execution now support `mark_kp_sent`, including selected lead IDs, deterministic submission routing, OpenAI action routing, and web confirmation wiring.
  - `/leads` editor now shows a `Mark KP sent` quick action for generated but unsent KP leads.
  - The L01 loop test now covers lead creation, KP generation, KP sent marking, and follow-up scheduling.

## Verification Rhythm

During normal development, use fast checks:

- `pnpm test:assistant`
- `pnpm --filter @app/auth test`
- `pnpm typecheck:web`
- HTTP smoke for touched routes

Run full `pnpm build` only at larger checkpoints or before final handoff.
