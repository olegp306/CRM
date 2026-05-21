# Agent Instructions

## Canonical Workspace

This project must be implemented only in:

`C:\repos\ai_crm`

Before reading, editing, testing, running dev servers, or continuing implementation, verify the working directory is `C:\repos\ai_crm`.

Do not implement project changes in:

- `C:\Users\olegp\OneDrive\Документы\AI CRM`
- any OneDrive folder
- any temporary copy outside `C:\repos\ai_crm`

If the active shell or tool context points elsewhere, stop and switch to `C:\repos\ai_crm` before making changes.

## Progress Tracking

Keep implementation status in:

`docs\IMPLEMENTATION_PROGRESS.md`

After each implementation block, update that file with:

- completed checklist items
- current block status
- latest verification commands and results
- estimated coverage of the first four product cards

## Verification Rhythm

Use fast checks during development:

- `pnpm test:assistant`
- `pnpm --filter @app/auth test`
- `pnpm typecheck:web`
- HTTP smoke for touched routes

Run full `pnpm build` only at larger checkpoints or before final handoff.
