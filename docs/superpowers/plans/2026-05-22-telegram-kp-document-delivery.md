# Telegram KP Document Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Telegram intake completes KP-required fields, create a generated KP document record, link it to the lead, and prepare Telegram delivery metadata.

**Architecture:** Extend the Telegram worker with injectable document-generation and lead-update ports. Reuse existing generated document records instead of introducing binary DOCX/PDF generation in this slice.

**Tech Stack:** TypeScript, Vitest, existing Telegram worker, existing assistant generated-document type contract.

---

### Task 1: Telegram Document API Surface

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-polling.ts`
- Test: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] Add a `sendTelegramDocument` helper that posts to Telegram `sendDocument`.
- [ ] Keep this helper binary-agnostic by accepting a URL or storage link as `document`.
- [ ] Cover it indirectly from worker tests through a mocked `fetchImpl`.

### Task 2: Worker KP Document Port

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] Add `generateKpDocument` config port.
- [ ] Add optional `lead.update` Prisma-like port to store `kpGeneratedDocumentId`.
- [ ] After creating a KP-ready lead, call `generateKpDocument` with workspace id, lead id, source text, and a deterministic Telegram document id.
- [ ] Update the lead with `kpGeneratedDocumentId`.
- [ ] Send a Telegram confirmation that includes the generated document id.

### Task 3: Verification

**Commands:**
- `pnpm --filter @app/integrations test -- src/telegram/telegram-worker.test.ts`
- `pnpm --filter @app/integrations typecheck`
- `pnpm typecheck`
