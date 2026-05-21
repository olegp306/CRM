# Card 1 Test Cases: App Foundation And Workspace Shell

Last updated: 2026-05-21

Canonical workspace: `C:\repos\ai_crm`

## Scope

Card 1 covers the app foundation and workspace shell:

- monorepo workspace files
- Next.js root app
- protected app layout
- shared UI/i18n/theme plumbing
- app sidebar navigation
- base module routes
- always-available assistant entry point

## Automated Test Cases

- [x] `apps/web/app/foundation-card.test.ts`: required workspace files, root app files, app layout, base routes, sidebar, assistant button.
- [x] `apps/web/components/app-navigation.test.ts`: sidebar route order and English labels.
- [x] Existing UI tests: locale dictionaries and workspace theme style.

## Smoke Test Cases

- [x] `/` returns 200.
- [x] `/today` returns 200.
- [x] `/clients` returns 200.
- [x] `/leads` returns 200.
- [x] `/projects` returns 200.
- [x] `/settings` returns 200.
- [x] `/assistant/preview` returns 200.

## Result

- Status: passed.
- Automated verification:
  - `pnpm --filter @app/web test`: 9 files, 19 tests passed.
  - `pnpm --filter @app/ui test`: 2 files, 5 tests passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - `pnpm --filter @app/ui typecheck`: passed.
- Smoke verification:
  - `/`: 200 `text/html; charset=utf-8`
  - `/today`: 200 `text/html; charset=utf-8`
  - `/clients`: 200 `text/html; charset=utf-8`
  - `/leads`: 200 `text/html; charset=utf-8`
  - `/projects`: 200 `text/html; charset=utf-8`
  - `/settings`: 200 `text/html; charset=utf-8`
  - `/assistant/preview`: 200 `text/html; charset=utf-8`
