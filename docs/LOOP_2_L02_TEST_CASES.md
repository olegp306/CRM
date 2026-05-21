# Loop 2 Test Cases: L02 Bautraeger Cold Outreach

Last updated: 2026-05-21

Canonical workspace: `C:\repos\ai_crm`

## Scope

Loop 2 is **L02 Bautraeger Cold Outreach** from the original product cards:

- cold targets are imported from CSV
- duplicates and validation warnings are detected
- cadence creates 8 touches over 6 weeks
- assistant/persona hook is generated from `notes_research`
- user sends a touch and the active cadence advances
- outcomes stop cadence and set review dates
- interested targets convert into Client + Lead
- converted target becomes inactive history linked to Client and Lead

## Automated Test Cases

- [x] `packages/core/src/outreach/cold-outreach.test.ts`: CSV import, duplicate/missing-company warnings, 8-touch cadence, persona hook generation, sent-touch advancement, outcome rules, conversion to Client + Lead and inactive target history.
- [x] `apps/web/app/(app)/outreach/l02-cold-outreach-loop.test.ts`: full deterministic loop from CSV row to cadence, hook, sent touch, interested outcome, Client/Lead conversion records, and archived converted target update.

## Smoke Test Cases

- [x] `/outreach` route exists and renders.

## Result

- Status: deterministic loop coverage is in place.
- Coverage estimate: 100% of the current L02 deterministic acceptance path is covered by automated tests.
- Verification:
  - `pnpm --filter @app/core test`: 13 files, 33 tests passed.
  - `pnpm --filter @app/web test`: 12 files, 28 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/outreach` returned 200.
- Remaining gaps before full product coverage:
  - CSV upload/import UI is not built yet.
  - DB-backed persistence store for ColdTarget/OutreachTouch conversion flow is not built yet.
  - Browser-click E2E for import, send touch, and convert interested target is not built yet.
