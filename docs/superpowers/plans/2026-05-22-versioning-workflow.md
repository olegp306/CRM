# Versioning Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SemVer release metadata and capture the current app version on support, bug, UX, and feature-request feedback.

**Architecture:** Root `package.json` owns the current version. `@app/core` exposes shared app metadata, `@app/assistant` attaches that version to feedback drafts, `@app/db` persists it, and the web platform feedback UI renders it for operators.

**Tech Stack:** TypeScript, PNPM workspaces, Vitest, Prisma, Next.js App Router.

---

### Task 1: App Metadata

**Files:**
- Modify: `package.json`
- Create: `packages/core/src/app/app-metadata.test.ts`
- Create: `packages/core/src/app/app-metadata.ts`
- Modify: `packages/core/src/index.ts`

- [x] Add a failing test that expects current app metadata to expose version `0.1.0`.
- [x] Run `pnpm --filter @app/core test -- app-metadata.test.ts` and confirm it fails.
- [x] Add root `package.json.version = "0.1.0"` and implement metadata reading in `@app/core`.
- [x] Export metadata from `packages/core/src/index.ts`.
- [x] Rerun the focused test and confirm it passes.

### Task 2: Feedback Draft Version Capture

**Files:**
- Modify: `packages/assistant/src/feedback-item.test.ts`
- Modify: `packages/assistant/src/feedback-item.ts`
- Modify: `packages/assistant/src/submission.test.ts`

- [x] Add failing tests proving feedback drafts include `appVersion`.
- [x] Run `pnpm --filter @app/assistant test -- feedback-item.test.ts submission.test.ts` and confirm the new assertions fail.
- [x] Attach `currentAppMetadata.version` when creating feedback drafts.
- [x] Rerun focused assistant tests and confirm they pass.

### Task 3: Persistence And Prisma

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260522090000_feedback_app_version/migration.sql`
- Modify: `packages/db/src/assistant-write-plan.test.ts`
- Modify: `packages/db/src/assistant-write-plan.ts`
- Modify: `packages/db/src/assistant-prisma-repository.test.ts`
- Modify: `packages/db/src/assistant-prisma-repository.ts`

- [x] Add failing tests proving Prisma write plans and repository reads include `appVersion`.
- [x] Run `pnpm --filter @app/db test -- assistant-write-plan.test.ts assistant-prisma-repository.test.ts` and confirm failure.
- [x] Add nullable `FeedbackItem.appVersion`, migration SQL, write-plan mapping, and row mapping.
- [x] Rerun focused DB tests and confirm they pass.

### Task 4: Platform Inbox UI And CSV

**Files:**
- Modify: `packages/assistant/src/platform-inbox.test.ts`
- Modify: `packages/assistant/src/platform-inbox.ts`
- Modify: `apps/web/app/platform/feedback/page.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`
- Modify: `apps/web/components/app-chrome.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`

- [x] Add failing tests proving inbox rows and CSV include `appVersion`.
- [x] Run focused assistant tests and confirm failure.
- [x] Add `appVersion` to platform inbox rows and CSV.
- [x] Render version in the platform feedback queue, with `unknown` fallback.
- [x] Show current app version in the sidebar footer.
- [x] Rerun focused tests and typecheck the web package.

### Task 5: Versioning Documentation

**Files:**
- Create: `docs/VERSIONING.md`

- [x] Document branch naming, verification, merge, version bump, tag, and push flow.
- [x] Include the current baseline `v0.1.0`.

### Task 6: Final Verification

**Files:**
- All touched files.

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Review `git diff --stat`.
- [ ] Commit the implementation branch.
