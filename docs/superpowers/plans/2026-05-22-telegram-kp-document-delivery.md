# Telegram KP Document Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Telegram intake completes KP-required fields, create a generated KP document record, link it to the lead, prepare Telegram delivery metadata, and expose downloadable KP artifacts from CRM.

**Architecture:** Extend the Telegram worker with injectable document-generation and lead-update ports. Store generated PDF and DOCX artifacts through the shared attachment/object-storage layer so Telegram and the web UI use the same source of truth.

**Tech Stack:** TypeScript, Vitest, existing Telegram worker, existing assistant generated-document type contract.

---

### Task 1: Telegram Document API Surface

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-polling.ts`
- Test: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [x] Add a `sendTelegramDocument` helper that posts to Telegram `sendDocument`.
- [x] Keep this helper binary-agnostic by accepting a URL or storage link as `document`.
- [x] Cover it indirectly from worker tests through a mocked `fetchImpl`.

### Task 2: Worker KP Document Port

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [x] Add `generateKpDocument` config port.
- [x] Add optional `lead.update` Prisma-like port to store `kpGeneratedDocumentId`.
- [x] After creating a KP-ready lead, call `generateKpDocument` with workspace id, lead id, source text, and a deterministic Telegram document id.
- [x] Update the lead with `kpGeneratedDocumentId`.
- [x] Send a Telegram confirmation that includes the generated document id.

### Task 3: CRM Artifact Access

**Files:**
- Modify: `packages/db/src/assistant-generated-document-prisma-store.ts`
- Modify: `packages/documents/src/docx-package.ts`
- Modify: `apps/web/app/(app)/documents/page.tsx`
- Create: `apps/web/app/(app)/documents/attachments/[attachmentId]/route.ts`

- [x] Generate durable PDF and DOCX attachment records for each KP document.
- [x] Persist generated artifacts into the configured object storage.
- [x] Add a CRM download route for generated attachments.
- [x] Link KP documents from lead cards and the Documents page.
- [x] Use a real minimal OOXML DOCX package instead of a text placeholder.
- [x] Pass structured Telegram lead fields into KP generation.
- [x] Show structured KP fields on the Documents page with source material collapsed by default.

### Task 4: Verification

**Commands:**
- `pnpm --filter @app/documents test -- src/docx-package.test.ts`
- `pnpm --filter @app/documents typecheck`
- `pnpm --filter @app/db test -- src/assistant-generated-document-prisma-store.test.ts`
- `pnpm --filter @app/db typecheck`
- `pnpm --filter @app/integrations test -- src/telegram/telegram-worker.test.ts`
- `pnpm --filter @app/integrations typecheck`
- `pnpm --filter @app/assistant typecheck`
- `pnpm --filter @app/web typecheck`
- `pnpm typecheck`
