# Friendly Assistant And Telegram Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web assistant handle onboarding conversation naturally and make Telegram lead intake group related messages, explain capabilities, and return a useful CRM lead card.

**Architecture:** Keep the web assistant and Telegram intake as separate deterministic service layers with focused tests. Telegram batching happens inside one polling pass before parsing; assistant translation and feedback enrichment happen before persistence so the UI can review original source text, generated task summary, and app version.

**Tech Stack:** TypeScript, Vitest, Next.js server actions, Prisma-backed repositories, Telegram Bot API, OpenAI Responses API.

---

### Task 1: Telegram Lead Batch And Reply Card

**Files:**
- Modify: `packages/integrations/src/telegram/telegram-polling.ts`
- Modify: `packages/integrations/src/telegram/telegram-worker.ts`
- Modify: `packages/integrations/src/telegram/openai-lead-parser.ts`
- Test: `packages/integrations/src/telegram/telegram-worker.test.ts`

- [ ] Add grouping for allowed Telegram messages from the same chat in one poll pass.
- [ ] Preserve all message ids in raw input using `Telegram sources: telegram:<chat>:<id>, ...`.
- [ ] Parse grouped text/photos/PDFs as one lead draft.
- [ ] Reply with a concise lead card containing only non-empty fields.
- [ ] Add an inline CRM URL button when `TELEGRAM_CRM_BASE_URL` or `NEXT_PUBLIC_APP_URL` is configured.
- [ ] Reply with a help message instead of creating a lead when the message is not lead-like.

### Task 2: Friendly Assistant Conversation Routing

**Files:**
- Modify: `packages/assistant/src/submission.ts`
- Modify: `packages/assistant/src/openai-provider.ts`
- Modify: `packages/assistant/src/feedback-item.ts`
- Modify: `packages/assistant/src/platform-inbox.ts`
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `apps/web/components/assistant-drawer.tsx`
- Test: assistant package tests and web assistant drawer tests

- [ ] Include visible conversation history and onboarding context in assistant submissions.
- [ ] Detect translation/language-switch requests and answer conversationally without creating feedback.
- [ ] Keep onboarding answers as feature requests only when they contain product answers or product feedback.
- [ ] Generate short feedback titles and summaries while preserving the original message.
- [ ] Keep `appVersion` mandatory on feedback items and expose it in the review UI.

### Task 3: Feedback Detail Review UI

**Files:**
- Modify: `apps/web/app/platform/feedback/page.tsx`
- Modify: `packages/assistant/src/platform-inbox.ts`
- Test: `packages/assistant/src/platform-inbox.test.ts`

- [ ] Make feedback rows clickable through `?selected=<sourceMessageId>`.
- [ ] Show a detail panel with type, status, module, app version, original message, and generated task summary.
- [ ] Keep bulk triage controls working for the filtered queue.

### Task 4: Verification And Publish

- [ ] Run `pnpm --filter @app/integrations test -- src/telegram/telegram-worker.test.ts src/telegram/openai-lead-parser.test.ts`.
- [ ] Run targeted assistant/web tests.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Commit and push `codex/friendly-assistant-telegram`.
