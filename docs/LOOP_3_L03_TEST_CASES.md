# Loop 3 Test Cases: L03 Project Operations

Last updated: 2026-05-21

Canonical workspace: `C:\repos\ai_crm`

## Scope

Loop 3 is **L03 Project Operations** from the original product cards:

- project opens as an operational workspace after contract/payment
- project phases are generated from the default template
- phases contain tasks and checklist items
- task cards include status, assignee, due date, priority, activity, and optional `blockedByTaskId`
- checklist items can be updated
- Decision Log is first-class and supports superseding old decisions
- files can attach to project, task, and decision
- generated documents remain as historical attachments
- optional external links exist for Drive, Telegram, Hubstaff, WhatsApp, Miro, and ArchiCAD
- CRM project identity remains source of truth through updates

## Automated Test Cases

- [x] `packages/core/src/projects/project-template.test.ts`: validates the 12 L03 project phases and decision-log setup task.
- [x] `packages/core/src/projects/project-operations.test.ts`: validates project workspace creation, task/checklist updates, decision superseding, file attachments, historical generated documents, and CRM identity.
- [x] `apps/web/app/(app)/projects/l03-project-operations-loop.test.ts`: deterministic full loop from project workspace creation to task update, checklist completion, decision supersede, file attachment lifecycle, external links, and preserved CRM identity.

## Smoke Test Cases

- [x] `/projects` route returns 200.

## Result

- Status: deterministic loop coverage is in place.
- Coverage estimate: 100% of the current L03 deterministic acceptance path is covered by automated tests.
- Verification:
  - `pnpm --filter @app/core test`: 14 files, 37 tests passed.
  - `pnpm --filter @app/web test`: 13 files, 29 tests passed.
  - `pnpm --filter @app/core typecheck`: passed.
  - `pnpm --filter @app/web typecheck`: passed.
  - HTTP smoke: `/projects` returned 200.
- Remaining gaps before full product coverage:
  - project detail UI with tabs is not built yet
  - DB-backed persistence for phases/tasks/checklists/decisions/files is not wired yet
  - browser-click E2E for project workspace operations is not built yet
