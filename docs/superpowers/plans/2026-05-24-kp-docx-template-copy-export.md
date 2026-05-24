# KP DOCX Template Copy Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate commercial proposals by copying the uploaded DOCX template, replacing bracketed placeholders inside the copy, and exporting the rendered DOCX to PDF.

**Architecture:** `@app/documents` owns DOCX package rendering and the DOCX-to-PDF conversion contract. `@app/db` loads the active uploaded KP template, renders the copied DOCX, asks the converter for PDF bytes, and stores both outputs. No minimal hand-built PDF fallback remains for KP documents.

**Tech Stack:** TypeScript, Vitest, OOXML DOCX zip rendering, optional LibreOffice/soffice headless conversion.

---

### Task 1: DOCX Placeholder Syntax

**Files:**
- Modify: `packages/documents/src/docx-package.test.ts`
- Modify: `packages/documents/src/docx-package.ts`

- [ ] **Step 1: Write the failing test**

Add a test that renders both `{{ client_name }}` and `{project_address}` from a copied DOCX package and confirms original template bytes are not mutated.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @app/documents test -- "docx-package.test.ts"`
Expected: FAIL because `{project_address}` is still left unreplaced.

- [ ] **Step 3: Implement placeholder replacement**

Update the placeholder regex to accept either double-brace or single-brace field placeholders and keep missing field tracking.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @app/documents test -- "docx-package.test.ts"`
Expected: PASS.

### Task 2: PDF Converter Contract

**Files:**
- Create: `packages/documents/src/pdf-converter.ts`
- Modify: `packages/documents/src/index.ts`
- Test: `packages/documents/src/pdf-converter.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for a converter that can be injected and for a LibreOffice converter that reports a clear unavailable error when no executable is configured or found.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @app/documents test -- "pdf-converter.test.ts"`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement converter contract**

Export `DocxToPdfConverter`, `DocxToPdfUnavailableError`, and `createLibreOfficeDocxToPdfConverter`. The LibreOffice converter writes the DOCX to temp, runs `soffice --headless --convert-to pdf`, reads the PDF, and cleans temp files.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @app/documents test -- "pdf-converter.test.ts"`
Expected: PASS.

### Task 3: KP Generation Uses Rendered DOCX PDF

**Files:**
- Modify: `packages/db/src/assistant-generated-document-prisma-store.test.ts`
- Modify: `packages/db/src/assistant-generated-document-prisma-store.ts`
- Modify: `apps/web/app/(app)/assistant/document-execution-store.ts`

- [ ] **Step 1: Write failing tests**

Add a db-store test proving PDF bytes come from the converter input DOCX, and a test proving no PDF fallback is generated when converter is missing.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @app/db test -- "assistant-generated-document-prisma-store.test.ts"`
Expected: FAIL because the store still calls `createMinimalPdfBytes`.

- [ ] **Step 3: Implement store wiring**

Add `pdfConverter` to store options. Generate DOCX from template first, call `pdfConverter.convertDocxToPdf(docxBody)`, and throw `DocxToPdfUnavailableError` when unavailable.

- [ ] **Step 4: Wire web runtime**

Create the Prisma generated document store with `createLibreOfficeDocxToPdfConverter()` so production can generate PDF when LibreOffice is installed/configured.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @app/db test -- "assistant-generated-document-prisma-store.test.ts"` and `pnpm --filter @app/web test -- "document-execution-store.test.ts"`.

### Task 4: Verification and Publish

**Files:**
- No new files unless tests reveal gaps.

- [ ] **Step 1: Run focused package tests**

Run document/db/integrations tests affected by KP generation.

- [ ] **Step 2: Run typechecks**

Run: `pnpm --filter @app/documents typecheck`, `pnpm --filter @app/db typecheck`, `pnpm --filter @app/web typecheck`.

- [ ] **Step 3: Commit and open PR**

Commit the branch and create a ready PR to `main`.
