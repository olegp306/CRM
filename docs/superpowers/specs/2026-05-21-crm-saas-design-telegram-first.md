# CRM SaaS v1 Design Spec · Telegram-First Alternative

## Goal

Build a no-name, brand-editable CRM/workspace product for architecture-agency workflows, with team roles, Google login, Telegram-first lead intake, assistant-driven operations, document generation, project operations, cold outreach, content planning, and platform-level feedback intelligence.

## Product Shape

The product is a multi-workspace SaaS. Billing is not included in v1, but the data model keeps nullable plan/subscription fields so billing can be added later without redesign.

Each user belongs to one workspace in v1. The schema should still use workspace memberships so future multi-workspace support is possible.

The UI language is English by default, with German and Russian translations supported. Branding is editable per workspace: name, logo, primary color, document header details, and company contact details.

## Roles

Workspace roles:

- Owner: full control, workspace settings, users, integrations, branding, all modules.
- Admin: all operational modules, users, settings, integrations, but not ownership transfer.
- Manager: clients, leads, projects, documents, outreach, content, and operational work.
- Member: assigned work only, project tasks, comments, files, and limited updates.
- Viewer: read-only access, no sensitive exports by default.

Platform role:

- Platform Admin: internal SaaS operator route access. Can view all workspace assistant messages, feedback inbox, audit events, workspaces, and users.

## Core Modules

### L01 Lead Intake

Purpose: turn raw inbound information from Telegram into Client, Lead, generated KP, and follow-up.

Core behavior:

- Telegram is the primary v1 intake channel, not a later add-on.
- The Telegram bot must accept text messages, photos, PDFs, and mixed inputs.
- A lead intake may arrive as one message or as several consecutive messages from the same Telegram chat.
- The system groups related Telegram messages into an intake bundle before extraction.
- A bundle can include text notes, screenshots/photos, PDF files, links, and short corrections sent after the first message.
- The grouping rule should be explicit: same sender/chat, short time window, and either no previous bundle finalized or user explicitly continues the current bundle.
- Owner/Admin can finalize a bundle from Telegram with a command or from the web UI.
- The web UI must support the same intake flow for manual correction, review, and fallback, but Telegram is the first-class entry point.
- Photos should be processed through vision/OCR extraction when needed.
- PDFs should be processed through text extraction first and OCR/vision fallback when text extraction fails.
- Assistant extracts client/project fields, asks missing questions, and proposes actions.
- Standard projects use BGF price lookup.
- Non-standard projects are marked for manual pricing.
- Generated KP creates DOCX and PDF attachments.
- Follow-up is scheduled inside CRM and optionally synced to Google Calendar.

Telegram intake lifecycle:

1. User sends raw lead material to the Telegram bot.
2. Bot creates or updates an intake bundle.
3. Bot acknowledges what it received and shows a short bundle summary.
4. System extracts structured fields from all bundle items.
5. If required fields are missing, bot asks targeted follow-up questions.
6. Owner/Admin reviews and confirms creation of Client/Lead.
7. Lead appears in CRM Leads table.
8. If standard, KP can be generated from the price table and template.
9. Follow-up plan is created and visible on the lead detail view.

Important edge cases:

- Multiple messages may belong to one lead.
- One Telegram chat may send several unrelated leads in the same day.
- User may send a correction after extraction.
- User may send a photo/PDF before any text context.
- User may send a duplicate or partial lead already present in CRM.
- Bot must avoid silently creating records without preview/confirmation.

### L02 Bautraeger Cold Outreach

Purpose: manage cold targets, cadence, AI personalization, and conversion to warm lead.

Core behavior:

- Cold targets are imported from CSV.
- Cadence has 8 touches over 6 weeks.
- Assistant generates persona hooks from notes_research.
- User manually sends email/LinkedIn/call actions, then marks touch as sent.
- Outcomes stop cadence and set review dates.
- When interested, cold target converts into Client + Lead.
- Converted target becomes inactive history linked to Client and Lead.

### L03 Project Operations

Purpose: project workspace after contract/payment.

Core behavior:

- Full project operations module in v1.
- Phases -> tasks -> checklist items.
- Task cards include status, assignee, due date, priority, files, comments/activity, and optional blocked_by_task_id.
- Decision Log is a first-class block in v1.
- Attachments are stored with lifecycle status, not full version control.
- Old generated documents are retained as historical attachments.
- Google Drive, Telegram, Hubstaff, WhatsApp, Miro, ArchiCAD paths are optional external links/integrations.
- CRM remains source of truth.

Project phases include:

- Negotiations
- Ecosystem
- Client/project discovery
- Analysis
- File preparation
- First sketch
- Revisions
- LP3
- LP4
- Submission
- Bauamt feedback
- Completed/archive

Project roles:

- Main
- Executor
- Consultant
- Informed

### L04 Content Factory

Purpose: transform a text case idea into channel-specific content drafts and publication planning.

Core behavior:

- Text-only input in v1 unless Telegram intake infrastructure is later reused for content.
- Assistant classifies case type.
- Assistant creates drafts for relevant channels.
- Supported channels start with Instagram RU, Threads, Telegram, LinkedIn.
- System stores drafts, schedule, publication status, and publication history.
- PromoRepublic is an optional integration/export target.

## Assistant

The Assistant is always available as Help/Assistant in the web UI and has a Telegram-facing operational role for L01 intake.

Access model:

- All roles can use Assistant for help, support, feedback, and questions.
- Action-capable mode is limited by role permissions.
- In v1, Owner and Admin have full action assistant capabilities.
- Lower roles can submit requests and feedback; blocked actions are captured as product signals.
- Telegram commands that mutate CRM data must respect the same permission model.

Assistant can:

- Create/update records when permitted.
- Create leads from Telegram intake bundles or web text.
- Schedule follow-ups.
- Generate KP.
- Prepare outreach touches.
- Draft content.
- Update project tasks/phases/decisions after confirmation.
- Classify user messages into support, bug, feature request, UX feedback, CRM action, permission-blocked action, or other.

Action safety:

- Mutating actions require preview + confirmation.
- Every assistant action creates an audit/activity entry.
- Telegram-created previews must also be visible in the web UI.

Assistant history:

- Store all messages.
- Store context: workspace, user, role, current route, linked entity, selected records, Telegram chat/message IDs when relevant.
- Classify messages.
- Feed relevant items into Feedback Inbox.

## Feedback Intelligence

The product includes a Workspace Feedback Inbox and a Platform Feedback Inbox.

Workspace Owner/Admin can see their workspace feedback.

Platform Admin can see real assistant messages across all workspaces. This must be covered in Terms/Privacy and shown with a short assistant notice in the UI. Platform Admin reads must be audit-logged.

Feedback item fields:

- type: feature_request, bug_report, support_request, ux_feedback, crm_action, permission_blocked, other
- workspace
- user
- role
- source thread/message
- Telegram chat/message source when relevant
- module context
- status: new, triaged, planned, transferred, declined, archived
- priority
- internal notes
- external task link

No full internal product backlog is required in v1. Items are transferred manually to external tools.

## Documents And Templates

Template Manager supports DOCX upload.

Owner/Admin can upload templates for:

- KP/Angebot
- Contract
- Invoice
- Status Report
- Meeting Summary

Template behavior:

- Parse placeholders in the form `{{field_name}}`.
- Show detected placeholders.
- Show available variables.
- Save templates even when unknown placeholders exist.
- Mark template version as needs_attention when unknown placeholders exist.
- Unknown placeholders remain visible in generated DOCX.
- PDF generation with unresolved placeholders requires explicit confirmation.
- Templates are versioned.
- Generated documents store template_id, template_version_id, attachments, generation inputs snapshot, warnings, status, generated_by, generated_at.

Generated document statuses are manual:

- draft
- generated
- reviewed
- approved
- sent
- signed
- obsolete
- archived

## Attachments

Files are owned by the CRM first.

Storage model:

- Metadata in PostgreSQL.
- Physical files in object storage.
- Supabase Storage is recommended for v1.
- Google Drive links are optional sync/export metadata.
- Telegram-uploaded photos and PDFs are stored as attachments after ingestion.
- Attachments keep source metadata, including Telegram file ID, chat ID, message ID, and original filename when available.

Attachment lifecycle statuses:

- draft
- in_review
- approved
- sent
- signed
- current
- obsolete
- archived

If a new version is generated or uploaded, old files remain and can be marked obsolete/archived.

## Google Integrations

Use option B: CRM is source of truth, Google is optional sync/export.

Drive:

- Save/export DOCX/PDF.
- Create or sync project folders later.

Calendar:

- Optional sync for follow-ups, cadence touches, project deadlines.

Gmail:

- Prepare drafts or record email activity later.
- Sending may stay manual in v1.

If Google is disconnected, CRM still works.

## Data Model Summary

Main entities:

- Workspace
- User
- WorkspaceMembership
- Invite
- Client
- Lead
- LeadIntakeBundle
- LeadIntakeBundleItem
- Project
- ProjectPhase
- ProjectTask
- ProjectChecklistItem
- ProjectDecision
- PriceTableRow
- ColdTarget
- OutreachTouch
- ContentCase
- ContentDraft
- ContentPublication
- Attachment
- DocumentTemplate
- DocumentTemplateVersion
- GeneratedDocument
- AssistantThread
- AssistantMessage
- AssistantAction
- FeedbackItem
- AuditLog
- IntegrationAccount
- TelegramIntegrationAccount

Telegram intake entities:

- `LeadIntakeBundle`: one potential lead intake session before CRM record creation.
- `LeadIntakeBundleItem`: one Telegram text/photo/PDF/link/message inside a bundle.
- `TelegramIntegrationAccount`: bot/workspace connection and allowed user/chat configuration.

## UI Direction

The UI should be modern, light, careful, and mobile-ready, closer to Airbnb than enterprise-heavy CRM.

Recommended UI stack:

- Tailwind CSS
- shadcn/ui
- Radix UI
- design tokens for theme switching
- TanStack Query
- TanStack Table

Data table standard:

- All table-oriented CRM screens should use a proper table library instead of hand-built tables.
- Recommended library: TanStack Table.
- TanStack Table is headless, free, mature, and works well with Tailwind/shadcn styling.
- The product should use TanStack Table for Leads first, then reuse the same table shell for Clients, Projects, Outreach, Content, Documents, and Platform Admin lists.
- Required table capabilities: column sorting, column resizing, column visibility, horizontal scroll, pagination, row click, and future support for persisted user column preferences.
- The Leads tab must show all lead fields from the CRM model, with long fields truncated in the table and fully editable in the detail view.
- Clicking a lead row opens an editable detail drawer or detail view with Save action and action plan timeline.
- Table styling must remain visually consistent with the current calm SaaS UI: white surfaces, subtle borders, 8px radius, restrained hover/selected states.

The first visual direction is captured in:

- `docs/mockups/crm-v1-ui-directions.html`

Design must support replacing the visual theme later through tokens, not by rewriting business components.

## Recommended Tech Stack

- Next.js with TypeScript
- Node.js API in TypeScript
- PostgreSQL
- Supabase for managed Postgres, auth-friendly setup, and storage
- Prisma as ORM
- Tailwind CSS + shadcn/ui + Radix UI
- TanStack Query
- TanStack Table
- BullMQ + Redis or equivalent worker queue for Telegram ingestion, OCR/PDF processing, and scheduled jobs if needed
- Telegram Bot API for bot communication
- OCR/vision pipeline for photos and scanned PDFs
- PDF text extraction pipeline for text-based PDFs
- DOCX generation library for template replacement
- PDF rendering service/library for document export

## Open But Non-Blocking Decisions

- Exact deployment provider.
- Whether API is Next.js route handlers or separate NestJS/Fastify service.
- Exact PDF rendering approach.
- Exact OCR/vision provider for Telegram photos and scanned PDFs.
- Exact Telegram bundle finalization UX: timeout-based, command-based, or both.
- Whether Google Drive/Calendar/Gmail are implemented in first build milestone or phased after core CRM.
- Exact L03 phase/task templates content.

