# CRM SaaS Master Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready v1 of the CRM SaaS described in `docs/superpowers/specs/2026-05-21-crm-saas-design.md`.

**Architecture:** Build a TypeScript SaaS with a Next.js web app, PostgreSQL as source of truth, object storage for files, assistant-driven workflows, and optional Google sync/export integrations. Keep domain modules isolated so the UI theme, integrations, assistant engine, and CRM business logic can evolve independently.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL, Prisma, Supabase Auth/Storage or compatible managed services, Tailwind CSS, shadcn/ui, Radix UI, TanStack Query, TanStack Table, background workers where needed.

---

## 0. Delivery Strategy

This project must be delivered as a sequence of small, working releases. Do not build all modules in parallel before the foundation is usable.

Recommended release train:

1. **R0 Foundation:** repo, auth, workspace, roles, shell UI, database.
2. **R1 CRM Core:** Clients, Leads, Projects, Price Table, IDs, attachments.
3. **R2 Assistant Core:** chat history, context, intent classification, preview/confirm actions, feedback inbox.
4. **R3 Documents:** template upload, placeholder validation, document generation, DOCX/PDF storage.
5. **R4 L01:** lead intake, KP generation, follow-up.
6. **R5 L02:** cold target CSV import, cadence, conversion to lead.
7. **R6 L03:** project operations, phases, task cards, decision log, project files.
8. **R7 L04:** content cases, drafts, planning, publication tracking.
9. **R8 Integrations:** Google Drive/Calendar/Gmail sync/export boundaries and first working syncs.
10. **R9 Platform Admin:** global feedback, audit views, workspace/user visibility.

Each release must end with:

- passing typecheck;
- passing unit tests for changed domain services;
- smoke-tested UI routes;
- a short changelog entry;
- a commit.

## 1. Repository And Runtime Foundation

**Purpose:** create the app skeleton and engineering guardrails.

**Primary files:**

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/web/*`
- `packages/db/*`
- `packages/auth/*`
- `packages/core/*`
- `packages/assistant/*`
- `packages/documents/*`
- `packages/integrations/*`
- `packages/ui/*`

**Tasks:**

- [ ] Create monorepo workspace with `apps/web` and shared packages.
- [ ] Add strict TypeScript config.
- [ ] Add lint/typecheck/test scripts.
- [ ] Add Next.js app shell.
- [ ] Add Tailwind/shadcn/Radix setup.
- [ ] Add shared UI theme tokens.
- [ ] Add environment variable validation module.
- [ ] Add test framework.
- [ ] Add seed script structure.

**Definition of Done:**

- `pnpm install` completes.
- `pnpm typecheck` passes.
- `pnpm test` runs.
- `pnpm dev` starts the web app.
- `/` renders a minimal landing or redirect screen.

## 2. Data Model And Database

**Purpose:** create the relational foundation before UI complexity grows.

**Primary files:**

- `packages/db/prisma/schema.prisma`
- `packages/db/src/client.ts`
- `packages/db/src/seed.ts`
- `packages/core/src/ids/*`
- `packages/core/src/workspaces/*`

**Required entities:**

- `Workspace`
- `User`
- `WorkspaceMembership`
- `Invite`
- `Client`
- `Lead`
- `Project`
- `ProjectPhase`
- `ProjectTask`
- `ProjectChecklistItem`
- `ProjectDecision`
- `PriceTableRow`
- `ColdTarget`
- `OutreachTouch`
- `ContentCase`
- `ContentDraft`
- `ContentPublication`
- `Attachment`
- `DocumentTemplate`
- `DocumentTemplateVersion`
- `GeneratedDocument`
- `AssistantThread`
- `AssistantMessage`
- `AssistantAction`
- `FeedbackItem`
- `AuditLog`
- `IntegrationAccount`

**Tasks:**

- [ ] Model workspace isolation on every workspace-owned table.
- [ ] Add `WorkspaceMembership` even though v1 allows one workspace per user.
- [ ] Add unique constraints for generated business IDs per workspace.
- [ ] Add lifecycle statuses as enums where stable.
- [ ] Add indexes for high-use filters: workspace, status, date, assignee, module.
- [ ] Add audit log table early, not after sensitive features.
- [ ] Add seed data for one demo workspace, owner, price table, sample clients, sample leads, sample project.

**ID rules:**

- `Client.clientId`: `C-YYYY-NNN`
- `Lead.leadId`: `L-YYYY-NNN`
- `Project.projectId`: `P-YYYY-NNN`
- numbering resets by year and workspace;
- never reuse IDs;
- never hard-delete business records from normal UI.

**Definition of Done:**

- Initial migration applies cleanly.
- Seed creates a usable demo workspace.
- ID generator tests cover year reset and workspace separation.

## 3. Auth, Invites, Roles, And Access

**Purpose:** enforce the team workspace model before business modules are exposed.

**Primary files:**

- `packages/auth/src/permissions.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/invites.ts`
- `apps/web/app/(auth)/*`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/settings/team/*`

**Decisions:**

- Google login only.
- Invite-only workspace access.
- One active workspace membership per user in v1.
- Manual invite link/code is enough; email sending is not required in v1.
- Roles: Owner, Admin, Manager, Member, Viewer.
- Platform Admin is separate from workspace roles.

**Tasks:**

- [ ] Implement Google login.
- [ ] After login, check whether the email has an accepted membership or pending invite.
- [ ] If no workspace access exists, show “No workspace access”.
- [ ] Owner/Admin can create invite links for Admin/Manager/Member/Viewer.
- [ ] Accepting invite creates user membership.
- [ ] Add permission helpers for each module action.
- [ ] Add route guards for workspace routes.
- [ ] Add platform route guard for `/platform`.

**Definition of Done:**

- Invited Google user can enter workspace.
- Non-invited Google user cannot enter workspace.
- Viewer cannot mutate data.
- Owner/Admin can invite.
- Non-platform users cannot open `/platform`.

## 4. App Shell, Navigation, Theme, And i18n

**Purpose:** establish the UI architecture and mobile behavior before module screens multiply.

**Primary files:**

- `packages/ui/src/theme/*`
- `packages/ui/src/components/*`
- `apps/web/components/app-sidebar.tsx`
- `apps/web/components/assistant-drawer.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/lib/i18n/*`

**UI direction:**

- light, modern, clean, close to Airbnb calm;
- mobile-ready from the first version;
- cards use restrained 8px radius;
- no heavy enterprise visual clutter;
- tokenized theme so UI can be re-skinned later.

**Tasks:**

- [ ] Create design tokens for colors, radius, spacing, typography.
- [ ] Implement default `Airbnb Calm` theme.
- [ ] Add workspace theme settings for logo/name/primary color.
- [ ] Add English as primary UI language.
- [ ] Add i18n infrastructure for German and Russian.
- [ ] Build responsive sidebar/topbar.
- [ ] Build mobile navigation.
- [ ] Build always-available Assistant button.

**Definition of Done:**

- Desktop shell works at 1440px.
- Mobile shell works at 390px.
- User can switch language.
- Workspace branding appears in app shell.

## 5. CRM Core: Clients, Leads, Projects, Price Table

**Purpose:** replace the Excel CRM structure with a real database-backed system while preserving the familiar model.

**Primary files:**

- `packages/core/src/clients/*`
- `packages/core/src/leads/*`
- `packages/core/src/projects/*`
- `packages/core/src/pricing/*`
- `apps/web/app/(app)/clients/*`
- `apps/web/app/(app)/leads/*`
- `apps/web/app/(app)/projects/*`
- `apps/web/app/(app)/settings/price-table/*`

**Clients fields:**

- `client_id`
- `created_date`
- `name`
- `client_type`
- `language`
- `whatsapp`
- `email`
- `phone`
- `address`
- `source`
- `referred_by`
- `notes`
- `status`

**Leads fields:**

- `lead_id`
- `client_id`
- `created_date`
- `temperature`
- `request_type`
- `urgency`
- `budget_eur`
- `desired_start`
- `desired_move_in`
- `bgf_m2`
- `wohnflaeche_m2`
- `project_address`
- `is_standard`
- `status`
- `raw_input`
- `missing_data`
- `kp_link/generated_document_id`
- `kp_sent_date`
- `followup_1_date`
- `followup_status`
- `outcome`
- `outcome_reason`
- `project_id`

**Projects fields:**

- `project_id`
- `client_id`
- `lead_id`
- `project_name`
- `project_address`
- `cadastral_nr`
- `bgf_m2`
- `wohnflaeche_m2`
- `project_type`
- `lph_scope`
- `has_bauvoranfrage`
- `has_denkmalschutz`
- `has_befreiung`
- `total_net_eur`
- `total_gross_eur`
- `contract_date`
- `contract_generated_document_id`
- `milestone_1_status`
- `milestone_2_status`
- `milestone_3_status`
- `current_phase`
- `status`
- `notes`

**Tasks:**

- [ ] Implement list/detail/create/edit screens for Clients.
- [ ] Implement list/detail/create/edit screens for Leads.
- [ ] Implement Project basic record creation from Lead.
- [ ] Implement archive instead of delete.
- [ ] Implement dropdown dictionaries for status/type fields.
- [ ] Implement price table import/management.
- [ ] Implement BGF lookup for standard projects.
- [ ] Implement standard/non-standard classification.
- [ ] Implement CRM timeline/activity entries.

**Definition of Done:**

- User can create Client and Lead manually.
- Lead can link to Client.
- Lead can become Project.
- Price lookup works for BGF 100-254.
- Non-standard cases are flagged for manual pricing.
- Archived records stay linkable.

## 6. Assistant Core

**Purpose:** create the chat layer that is both operational and product-intelligence-critical.

**Primary files:**

- `packages/assistant/src/classify-intent.ts`
- `packages/assistant/src/context.ts`
- `packages/assistant/src/action-preview.ts`
- `packages/assistant/src/actions/*`
- `apps/web/components/assistant-drawer.tsx`
- `apps/web/app/(app)/assistant/actions.ts`

**Behavior:**

- Assistant is available to all users as Help/Feedback/Support.
- Mutating actions are permission-gated.
- Owner/Admin can execute action mode in v1.
- Other roles can ask questions and submit feedback.
- Every message is stored.
- Every message stores context.
- Every mutating action needs preview + confirmation.

**Tasks:**

- [ ] Build assistant drawer desktop and mobile.
- [ ] Store assistant threads and messages.
- [ ] Capture current route/module/entity context.
- [ ] Classify messages into CRM action, support, bug, feature request, UX feedback, business note, permission blocked, other.
- [ ] Create feedback items from relevant messages.
- [ ] Create action preview format.
- [ ] Implement confirmation flow.
- [ ] Log assistant actions and results.
- [ ] Add permission-blocked response behavior.

**Definition of Done:**

- Any user can submit assistant message.
- Message appears in thread history.
- Feature/bug/support messages create Feedback Items.
- Viewer asking to create a lead is blocked and captured.
- Owner/Admin can confirm a safe stub action.

## 7. Feedback Intelligence And Platform Admin

**Purpose:** preserve every product/customer signal and make it reviewable.

**Primary files:**

- `packages/core/src/feedback/*`
- `apps/web/app/(app)/settings/feedback/*`
- `apps/web/app/platform/feedback/*`
- `apps/web/app/platform/audit/*`
- `apps/web/app/platform/workspaces/*`

**Rules:**

- Workspace Owner/Admin sees workspace feedback.
- Platform Admin sees all workspace feedback and real assistant messages.
- Platform Admin reads are audit-logged.
- Terms/Privacy and assistant notice mention review.
- No internal product backlog in v1; transfer is manual.

**Tasks:**

- [ ] Build Workspace Feedback Inbox.
- [ ] Build Platform Feedback Inbox.
- [ ] Add filters: type, status, priority, workspace, user, role, module, date.
- [ ] Add status changes: new, triaged, planned, transferred, declined, archived.
- [ ] Add internal notes.
- [ ] Add external task link.
- [ ] Add “Mark as transferred”.
- [ ] Log platform admin message/thread reads.

**Definition of Done:**

- Feedback from assistant appears in workspace inbox.
- Same feedback appears in platform inbox.
- Platform read creates audit event.
- Item can be marked transferred with external link.

## 8. Attachments And Storage

**Purpose:** make CRM own files first, with Google only as optional sync/export.

**Primary files:**

- `packages/core/src/attachments/*`
- `packages/storage/src/*` or `packages/core/src/storage/*`
- `apps/web/components/file-upload/*`
- `apps/web/app/(app)/files/*`

**Statuses:**

- draft
- in_review
- approved
- sent
- signed
- current
- obsolete
- archived

**Tasks:**

- [ ] Configure object storage bucket.
- [ ] Implement upload service.
- [ ] Store metadata in `Attachment`.
- [ ] Add attachment relation table or polymorphic link model.
- [ ] Add file upload UI.
- [ ] Add file status update.
- [ ] Add archive/obsolete behavior.
- [ ] Add signed download URLs.

**Definition of Done:**

- User can upload file to project.
- File metadata is stored.
- File can be downloaded.
- File status can be changed.
- Old files remain visible after new upload.

## 9. Template Manager And Generated Documents

**Purpose:** generate editable DOCX and PDF documents from uploaded templates while preserving template and generation history.

**Primary files:**

- `packages/documents/src/placeholders.ts`
- `packages/documents/src/docx-template.ts`
- `packages/documents/src/generate-document.ts`
- `packages/documents/src/pdf.ts`
- `apps/web/app/(app)/settings/templates/*`
- `apps/web/app/(app)/documents/*`

**Template behavior:**

- Owner/Admin uploads DOCX.
- System parses placeholders.
- System shows available variables.
- Unknown placeholders do not block saving.
- Unknown placeholders mark version as `needs_attention`.
- Generated DOCX keeps unresolved placeholders visible.
- PDF generation with unresolved placeholders requires confirmation.
- Templates are versioned.
- Generated document stores input snapshot.

**Tasks:**

- [ ] Build Template Manager list page.
- [ ] Build template upload form.
- [ ] Parse DOCX text and placeholders.
- [ ] Compare detected placeholders with available variables.
- [ ] Save template version.
- [ ] Show validation status.
- [ ] Generate DOCX with replacement values.
- [ ] Generate PDF from generated DOCX.
- [ ] Save generated DOCX and PDF as attachments.
- [ ] Save generated document record with template version and input snapshot.

**Definition of Done:**

- Uploaded KP template detects known placeholders.
- Unknown placeholder saves with warning.
- Lead can generate KP DOCX.
- Lead can generate KP PDF after confirmation when warnings exist.
- Generated document history shows old versions.

## 10. L01 Lead Intake

**Purpose:** make the first money loop work end to end.

**Primary files:**

- `packages/core/src/lead-intake/*`
- `packages/assistant/src/actions/create-lead.ts`
- `packages/assistant/src/actions/generate-kp.ts`
- `apps/web/app/(app)/leads/*`
- `apps/web/app/(app)/today/*`

**Tasks:**

- [ ] Add assistant action preview for “create lead”.
- [ ] Add missing data detection.
- [ ] Add Client matching by email/phone/name.
- [ ] Add lead creation from assistant text.
- [ ] Add standard project classifier.
- [ ] Add BGF price lookup.
- [ ] Add KP generation action.
- [ ] Add follow-up creation.
- [ ] Add Today view for due follow-ups.
- [ ] Add “KP sent” status action.

**Definition of Done:**

- Owner/Admin pastes raw lead text into Assistant.
- Assistant previews Client + Lead creation.
- User confirms.
- Lead appears in Leads.
- Standard lead can generate KP DOCX/PDF.
- Follow-up appears in Today.

## 11. L02 Cold Outreach

**Purpose:** systematize cold Bautraeger work without mixing it into warm lead pipeline.

**Primary files:**

- `packages/core/src/outreach/*`
- `apps/web/app/(app)/outreach/*`
- `apps/web/app/(app)/outreach/import/*`
- `packages/assistant/src/actions/prepare-outreach-touch.ts`
- `packages/assistant/src/actions/convert-target-to-lead.ts`

**Tasks:**

- [ ] Build Cold Targets list.
- [ ] Build CSV import with preview.
- [ ] Add column mapping.
- [ ] Add validation warnings.
- [ ] Add duplicate detection by company/website/email.
- [ ] Save import batch.
- [ ] Create cadence touch schedule.
- [ ] Add touch status: pending, prepared, sent, skipped.
- [ ] Add assistant persona hook generation.
- [ ] Add outcome rules.
- [ ] Add conversion to Client + Lead.
- [ ] Mark converted target inactive history.

**Definition of Done:**

- CSV cold targets can be imported.
- Active cadence shows next action.
- User can mark touch as sent.
- Outcome `interested` converts target to Client + Lead.
- Cold target keeps history and no longer appears in active cadence.

## 12. L03 Project Operations

**Purpose:** provide a real project workspace with phases, tasks, decisions, files, and external links.

**Primary files:**

- `packages/core/src/projects/*`
- `apps/web/app/(app)/projects/[projectId]/*`
- `apps/web/app/(app)/projects/[projectId]/tasks/*`
- `apps/web/app/(app)/projects/[projectId]/decisions/*`
- `apps/web/app/(app)/projects/[projectId]/files/*`

**Tasks:**

- [ ] Build project detail layout with tabs.
- [ ] Add phase timeline.
- [ ] Add task cards.
- [ ] Add checklist items inside tasks.
- [ ] Add assignee, due date, priority.
- [ ] Add simple `blocked_by_task_id`.
- [ ] Add task comments/activity.
- [ ] Add Decision Log tab.
- [ ] Add create/edit/supersede decision.
- [ ] Add project file attachments.
- [ ] Add external links block: Drive, Telegram, WhatsApp, Hubstaff, Miro, ArchiCAD.
- [ ] Add project template creation from Lead conversion.

**Definition of Done:**

- Project opens as operational workspace.
- Project has phases generated from default template.
- User can create/update tasks and checklist items.
- Decision can be recorded and superseded.
- Files can attach to project/task/decision.

## 13. L04 Content Factory

**Purpose:** turn text case ideas into planned and tracked content.

**Primary files:**

- `packages/core/src/content/*`
- `packages/assistant/src/actions/create-content-case.ts`
- `packages/assistant/src/actions/draft-content.ts`
- `apps/web/app/(app)/content/*`

**Tasks:**

- [ ] Build Content Cases list.
- [ ] Build content case detail.
- [ ] Add channels: Instagram RU, Threads, Telegram, LinkedIn.
- [ ] Add case types: client story, architecture observation, technical solution, professional thought, personal/writerly.
- [ ] Add assistant action for creating content case from text.
- [ ] Add draft records per channel.
- [ ] Add draft status: draft, reviewed, scheduled, published, archived.
- [ ] Add publication schedule.
- [ ] Add publication history.
- [ ] Add manual external link/reference for PromoRepublic.

**Definition of Done:**

- User can create content case.
- Assistant can create channel-specific draft placeholders.
- Draft can be scheduled and marked published.
- Publication history is visible.

## 14. Google Integrations

**Purpose:** integrate Google as optional sync/export, not source of truth.

**Primary files:**

- `packages/integrations/src/google/*`
- `apps/web/app/(app)/settings/integrations/google/*`
- `packages/core/src/integrations/*`

**Integration order:**

1. Google OAuth connection.
2. Drive export for generated documents.
3. Calendar sync for follow-ups and outreach touches.
4. Gmail draft creation or email activity capture.

**Tasks:**

- [ ] Add Google integration account model.
- [ ] Add connect/disconnect UI.
- [ ] Store encrypted tokens.
- [ ] Add Drive export for attachments.
- [ ] Add Calendar event sync for follow-up.
- [ ] Add Gmail draft boundary.
- [ ] Add sync status and errors.
- [ ] Add audit logs for external sync.

**Definition of Done:**

- CRM works with Google disconnected.
- Connected workspace can export generated KP to Drive.
- Follow-up can optionally sync to Calendar.
- Sync failures do not corrupt CRM state.

## 15. Quality, Privacy, And Operations

**Purpose:** make v1 trustworthy enough for real customer data.

**Primary files:**

- `apps/web/app/privacy/page.tsx`
- `apps/web/app/terms/page.tsx`
- `packages/core/src/audit/*`
- `packages/core/src/privacy/*`

**Tasks:**

- [ ] Add Assistant review notice in UI.
- [ ] Add Terms page explaining assistant message review.
- [ ] Add Privacy page explaining support/product improvement review.
- [ ] Add audit logging for platform admin reads.
- [ ] Add audit logging for assistant actions.
- [ ] Add backup/export story for workspace data.
- [ ] Add basic error boundary.
- [ ] Add structured logging.

**Definition of Done:**

- User sees assistant review notice.
- Terms/Privacy pages exist.
- Sensitive platform admin reads are logged.
- Mutating assistant actions are logged.

## 16. Verification Matrix

Before v1 is considered complete:

- [ ] Owner can create workspace seed/admin state.
- [ ] Owner/Admin can invite users manually.
- [ ] Invited Google user can access workspace.
- [ ] Non-invited Google user cannot access workspace.
- [ ] Role permissions work.
- [ ] Assistant available to every role.
- [ ] Assistant actions are allowed only when permitted.
- [ ] Assistant messages are stored with context.
- [ ] Feedback Inbox receives feature/bug/support/UX signals.
- [ ] Platform Admin can review global feedback.
- [ ] Platform Admin reads are audit-logged.
- [ ] Client/Lead/Project CRUD works.
- [ ] IDs generate correctly and reset per year.
- [ ] Price Table lookup works.
- [ ] KP template upload and placeholder validation works.
- [ ] Generated DOCX/PDF are stored and history remains visible.
- [ ] Cold Target CSV import works.
- [ ] Outreach cadence works.
- [ ] Outreach conversion creates Client + Lead.
- [ ] Project Operations has phases, tasks, checklist items, decision log, files.
- [ ] Content Factory stores drafts, schedule, publication status.
- [ ] Mobile UI works for Assistant and main modules.

## 17. Suggested Subplans After Repository Handoff

After the real repository is provided, split execution into these concrete implementation plans:

1. `auth-workspace-rbac-plan.md`
2. `database-schema-and-seed-plan.md`
3. `app-shell-theme-i18n-plan.md`
4. `crm-core-clients-leads-projects-plan.md`
5. `assistant-feedback-plan.md`
6. `attachments-storage-plan.md`
7. `documents-template-generation-plan.md`
8. `l01-lead-intake-plan.md`
9. `l02-outreach-plan.md`
10. `l03-project-operations-plan.md`
11. `l04-content-factory-plan.md`
12. `google-integrations-plan.md`
13. `platform-admin-audit-plan.md`

Each subplan must include exact file paths from the actual repository, failing tests first, implementation steps, verification commands, and a commit boundary.

## Self-Review

Spec coverage:

- The plan covers team workspace, Google login, invite-only access, one-workspace-per-user v1, role model, platform admin, assistant chat, assistant history, product feedback capture, CRM modules, L01-L04, templates, generated documents, attachments, Google option B, no billing in v1, privacy notice, and audit requirements.

Placeholder scan:

- There are no unresolved TBD/TODO markers.
- Repository-specific exact paths must be adapted after the real repository is handed off; the plan names the expected greenfield paths and the required subplans.

Type consistency:

- Entity names match the design spec: Workspace, User, WorkspaceMembership, Invite, Client, Lead, Project, ColdTarget, Attachment, DocumentTemplate, GeneratedDocument, AssistantThread, AssistantMessage, FeedbackItem, AuditLog.

