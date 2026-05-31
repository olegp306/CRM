# Client Material Metaprompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-configurable client material analysis for mixed text, PDFs, photos, documents, and audio transcripts.

**Architecture:** Store per-workspace AI intake settings in Prisma, expose a small settings UI, and route existing Web/Telegram lead intake through a shared analyzer contract. Keep the current lead creation pipeline intact by mapping analyzer output into existing lead draft fields and `rawInput` summary text.

**Tech Stack:** TypeScript, Next.js App Router server actions, Prisma, Vitest, OpenAI Responses API.

---

### Task 1: Workspace AI Settings Store

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260531120000_workspace_ai_settings/migration.sql`
- Create: `packages/db/src/workspace-ai-setting-prisma-store.ts`
- Create: `packages/db/src/workspace-ai-setting-prisma-store.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] Add a `WorkspaceAiSetting` model keyed by `workspaceId` and `role`.
- [ ] Add a Prisma-like store with `get`, `upsert`, and default fallback for `client_material_analysis`.
- [ ] Test default values and upsert behavior.

### Task 2: Client Material Analyzer Contract

**Files:**
- Create: `packages/assistant/src/client-material-analysis.ts`
- Create: `packages/assistant/src/client-material-analysis.test.ts`
- Create: `packages/assistant/src/openai-client-material-analyzer.ts`
- Create: `packages/assistant/src/openai-client-material-analyzer.test.ts`
- Modify: `packages/assistant/src/index.ts`

- [ ] Define input/output types matching CRM lead fields and source material summaries.
- [ ] Add normalization from nullable OpenAI JSON into TypeScript-friendly fields.
- [ ] Add OpenAI Responses client that uses the configured metaprompt and model.
- [ ] Test prompt/model propagation, JSON schema, document summaries, and null normalization.

### Task 3: Shared Lead Intake Mapping

**Files:**
- Modify: `packages/assistant/src/lead-channel-intake.ts`
- Modify: `packages/assistant/src/lead-channel-intake.test.ts`
- Modify: `packages/assistant/src/openai-lead-parser.ts`
- Modify: `packages/assistant/src/openai-lead-parser.test.ts`

- [ ] Allow `lead-channel-intake` to consume analyzer-style output while preserving the existing parser interface.
- [ ] Append `Lead summary:` and `Source material summaries:` into `rawInput`.
- [ ] Keep legacy parser tests passing.

### Task 4: Telegram Parser Compatibility

**Files:**
- Modify: `packages/integrations/src/telegram/openai-lead-parser.ts`
- Modify: `packages/integrations/src/telegram/openai-lead-parser.test.ts`

- [ ] Update Telegram OpenAI prompt/schema to request the same fields and per-document summaries.
- [ ] Include audio transcript summaries in raw input.
- [ ] Keep existing Telegram worker contract stable.

### Task 5: Settings UI

**Files:**
- Create: `apps/web/app/(app)/settings/ai-intake/page.tsx`
- Create: `apps/web/app/(app)/settings/ai-intake/actions.ts`
- Create: `apps/web/app/(app)/settings/ai-intake/ai-intake-store.ts`
- Create: `apps/web/app/(app)/settings/ai-intake/ai-intake-store.test.ts`
- Modify: `apps/web/app/(app)/settings/page.tsx`

- [ ] Add a Settings card linking to `AI intake`.
- [ ] Add a prompt textarea and model select.
- [ ] Save settings per workspace with server action.
- [ ] Test memory/database runtime selection and default fallback.

### Task 6: Verification

**Files:**
- No production files expected.

- [ ] Run package tests touched by this feature.
- [ ] Run `pnpm typecheck`.
- [ ] Run `git diff --check`.
- [ ] Commit the feature branch.
