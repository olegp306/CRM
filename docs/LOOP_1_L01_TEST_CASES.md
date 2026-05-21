# Loop 1 Test Cases: L01 Lead Intake

Last updated: 2026-05-21

Canonical workspace: `C:\repos\ai_crm`

## Scope

Loop 1 is **L01 Lead Intake** from the original product cards:

- raw inbound text enters the CRM through the assistant/web intake path
- client data is validated and matched
- lead data is checked for missing fields
- standard lead is classified through BGF price-table rules
- owner/admin confirms lead creation
- KP document generation creates DOCX/PDF attachment history
- follow-up is scheduled and appears in Today

## Automated Test Cases

- [x] `apps/web/app/(app)/leads/l01-lead-intake-loop.test.ts`: raw lead input -> client validation/match -> missing-data check -> standard classification -> lead creation -> KP generation with DOCX/PDF attachment ids -> follow-up visible in Today view model.
- [x] Supporting tests:
  - `packages/core/src/clients/client-validation.test.ts`
  - `packages/core/src/clients/client-matching.test.ts`
  - `packages/core/src/leads/missing-data.test.ts`
  - `packages/core/src/leads/standard-classifier.test.ts`
  - `packages/assistant/src/action-execution.test.ts`
  - `apps/web/app/(app)/today/today-store.test.ts`
  - `apps/web/app/(app)/assistant/document-execution-store.test.ts`

## Smoke Test Cases

- [x] `/leads` returns 200.
- [x] `/leads/intake-preview` returns 200.
- [x] `/documents` returns 200.
- [x] `/today` returns 200.

## Result

- Status: passed for deterministic loop coverage and route smoke.
- Coverage estimate: 100% of the current L01 deterministic acceptance path is covered by automated tests; UI route availability is covered by HTTP smoke. Remaining gap: full browser-click E2E with real upload/DB is not implemented yet.
- Verification:
  - `pnpm --filter @app/core test`: 12 files, 28 tests passed.
  - `pnpm --filter @app/assistant test`: 17 files, 54 tests passed.
  - `pnpm --filter @app/web test`: 10 files, 20 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/assistant typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/leads`, `/leads/intake-preview`, `/documents`, `/today` returned 200.
