# Telegram Lead Draft Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Telegram lead intake work as a draft session that can be started explicitly or by documents, enriched by follow-up messages, and finalized once KP-required fields are complete.

**Architecture:** Add a small Telegram draft-session model in the integrations package and wire it into the existing polling worker through an injectable store. The first version keeps persistence behind a port so tests can use memory and a later PR can replace it with Prisma-backed durable sessions.

**Tech Stack:** TypeScript, Vitest, existing Telegram polling worker, existing OpenAI lead parser, existing CRM lead Prisma port.

---

### Task 1: Draft Session Model

**Files:**
- Create: `packages/integrations/src/telegram/telegram-lead-draft-session.ts`
- Test: `packages/integrations/src/telegram/telegram-lead-draft-session.test.ts`

- [ ] Write tests for KP-required fields: `clientName`, `requestType`, `projectAddress`, and `bgfM2` when `requestType` is `new_build`.
- [ ] Implement `mergeTelegramLeadDraftSession`, `getKpRequiredFieldStatus`, and `isPossibleDifferentLead`.
- [ ] Run `pnpm --filter @app/integrations test -- src/telegram/telegram-lead-draft-session.test.ts`.

### Task 2: Worker Draft Flow

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify tests: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] Write a failing test: `/newlead` starts an empty draft and asks for lead material.
- [ ] Write a failing test: a PDF/photo creates or updates a draft, sends a compact field card, and does not create a CRM lead until KP-required fields are complete.
- [ ] Write a failing test: the next Telegram message enriches the active draft and finalizes a CRM lead when KP-required fields become complete.
- [ ] Write a failing test: a Telegram reply to the bot's draft message is treated as an explicit update to that draft.
- [ ] Implement a `telegramDraftStore` config port with `getActive`, `save`, and `clear`.
- [ ] Store the bot draft message id on the draft session so later `reply_to_message` updates can target that draft.
- [ ] Implement minimal in-memory fallback store for local worker runs.
- [ ] Run targeted Telegram worker tests.

### Task 3: Telegram Replies

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Test: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] Make draft replies concise: detected fields, KP-ready fields, missing KP fields, and next instruction.
- [ ] If a message looks like another client while a draft is active, ask whether to start another lead or continue the current one.
- [ ] When a lead is finalized, send the existing CRM link plus “KP fields ready” wording.

### Task 4: Verification

**Commands:**
- `pnpm --filter @app/integrations test -- src/telegram/telegram-lead-draft-session.test.ts src/telegram/telegram-worker.test.ts`
- `pnpm --filter @app/integrations typecheck`
- `pnpm typecheck`

**Commit:**
- `git add packages/integrations/src/telegram docs/superpowers/plans/2026-05-22-telegram-lead-draft-session.md`
- `git commit -m "feat: add telegram lead draft sessions"`
