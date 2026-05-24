# Template-Backed KP Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate KP DOCX/PDF artifacts from the latest uploaded KP template instead of the internal placeholder-only template.

**Architecture:** The document package renders an uploaded DOCX by replacing placeholders in `word/document.xml`. The generated-document Prisma store resolves the latest active KP template, reads its DOCX attachment from object storage, renders it with lead fields, and stores generated attachments with the chosen template/version IDs. The templates page marks the latest KP template as current.

**Tech Stack:** Next.js server actions, Prisma-style DB adapter, local/S3 object storage abstraction, Vitest, minimal OOXML ZIP parsing in `@app/documents`.

---

### Task 1: Render Uploaded DOCX Templates

**Files:**
- Modify: `packages/documents/src/docx-package.ts`
- Test: `packages/documents/src/docx-package.test.ts`

- [ ] Add a DOCX renderer that reads ZIP entries, inflates `word/document.xml` when needed, replaces `{{ placeholder }}` values, optionally prepends draft paragraphs, and writes a valid DOCX ZIP.
- [ ] Cover placeholder replacement and draft notice insertion with Vitest.

### Task 2: Resolve Current KP Template In Generation

**Files:**
- Modify: `packages/db/src/assistant-generated-document-prisma-store.ts`
- Test: `packages/db/src/assistant-generated-document-prisma-store.test.ts`

- [ ] Extend the Prisma-like client type with template/version and attachment read operations.
- [ ] Resolve the latest active `documentType = kp` template for the workspace.
- [ ] Read the template DOCX from object storage and render it with lead fields.
- [ ] Fall back to the internal simple DOCX only when no uploaded template is available.
- [ ] Store real `templateId` and `templateVersionId` for generated documents.

### Task 3: Show Current Template In UI

**Files:**
- Modify: `apps/web/app/(app)/settings/templates/page.tsx`

- [ ] Mark the newest KP template as `Current`.
- [ ] Keep older KP templates visible for history without changing generation behavior.

### Task 4: Verify

**Files:**
- Run targeted tests and typecheck.

- [ ] Run `pnpm --filter @app/documents test`.
- [ ] Run `pnpm --filter @app/db test -- assistant-generated-document-prisma-store.test.ts`.
- [ ] Run `pnpm --filter @app/web typecheck`.
