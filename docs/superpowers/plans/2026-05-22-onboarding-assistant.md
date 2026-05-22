# Onboarding Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided onboarding assistant that collects free-form client answers and saves each useful answer as versioned feedback.

**Architecture:** The feature reuses the existing assistant persistence and feedback inbox instead of creating a new storage path. `@app/assistant` owns the onboarding questions, context brief, and answer-to-feedback content mapping; the web assistant drawer owns the client-facing onboarding entry.

**Tech Stack:** Next.js App Router, React client component, existing `@app/assistant` feedback pipeline, Prisma-backed assistant repository, Vitest.

---

### Task 1: Onboarding Domain Helpers

**Files:**
- Create: `packages/assistant/src/onboarding.ts`
- Create: `packages/assistant/src/onboarding.test.ts`
- Modify: `packages/assistant/src/index.ts`
- Modify: `packages/assistant/src/context.ts`
- Modify: `packages/assistant/src/conversation.ts`

- [x] Add onboarding questions, current product brief, and `createOnboardingFeedbackContent`.
- [x] Include `onboarding` in assistant module context and route mapping.
- [x] Export helpers from `@app/assistant`.
- [x] Test stable question ids, brief version metadata, and feature-request classification content.

### Task 2: Web Assistant Onboarding Entry

**Files:**
- Modify: `apps/web/components/assistant-drawer.tsx`
- Modify: `apps/web/app/(app)/assistant/actions.ts`
- Modify: `apps/web/components/app-navigation.ts`
- Modify: `apps/web/components/app-navigation.test.ts`
- Modify: `apps/web/components/app-transition.ts`
- Modify: `packages/ui/src/i18n/locale.ts`

- [x] Remove the standalone onboarding route from sidebar navigation.
- [x] Show a closed-assistant onboarding indicator when the onboarding message is unread.
- [x] Render the current technical brief, planned work, and guided questions as the assistant's first message.
- [x] Save the client's combined free-form answer as feedback with `moduleContext: onboarding` and current app version.

### Task 3: Verification

**Files:**
- Test: `packages/assistant/src/onboarding.test.ts`
- Test: `apps/web/components/app-navigation.test.ts`

- [x] Run targeted assistant and navigation tests.
- [x] Run full `pnpm typecheck`.
- [x] Run full `pnpm test`.
