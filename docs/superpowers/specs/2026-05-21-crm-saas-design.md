# CRM SaaS v1 Design Spec

## Goal

Build a no-name, brand-editable CRM/workspace product for architecture-agency workflows, with team roles, Google login, assistant-driven operations, document generation, project operations, cold outreach, content planning, and platform-level feedback intelligence.

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

Purpose: turn raw inbound information into Client, Lead, generated KP, and follow-up.

Core behavior:

- Web assistant chat accepts text input.
- Telegram can be added later, but web UI must support the same chat-like intake flow.
- Assistant extracts client/project fields, asks missing questions, and proposes actions.
- Standard projects use BGF price lookup.
- Non-standard projects are marked for manual pricing.
- Generated KP creates DOCX and PDF attachments.
- Follow-up is scheduled inside CRM and optionally synced to Google Calendar.

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

- Text-only input in v1.
- Assistant classifies case type.
- Assistant creates drafts for relevant channels.
- Supported channels start with Instagram RU, Threads, Telegram, LinkedIn.
- System stores drafts, schedule, publication status, and publication history.
- PromoRepublic is an optional integration/export target.

## Assistant

The Assistant is always available as Help/Assistant.

Access model:

- All roles can use Assistant for help, support, feedback, and questions.
- Action-capable mode is limited by role permissions.
- In v1, Owner and Admin have full action assistant capabilities.
- Lower roles can submit requests and feedback; blocked actions are captured as product signals.

Assistant can:

- Create/update records when permitted.
- Create leads.
- Schedule follow-ups.
- Generate KP.
- Prepare outreach touches.
- Draft content.
- Update project tasks/phases/decisions after confirmation.
- Classify user messages into support, bug, feature request, UX feedback, CRM action, permission-blocked action, or other.

Action safety:

- Mutating actions require preview + confirmation.
- Every assistant action creates an audit/activity entry.

Assistant history:

- Store all messages.
- Store context: workspace, user, role, current route, linked entity, selected records.
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

## UI Direction

The UI should be modern, light, careful, and mobile-ready, closer to Airbnb than enterprise-heavy CRM.

Recommended UI stack:

- Tailwind CSS
- shadcn/ui
- Radix UI
- design tokens for theme switching
- TanStack Query
- TanStack Table

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
- BullMQ + Redis for jobs if background workers are needed in v1
- DOCX generation library for template replacement
- PDF rendering service/library for document export

## Open But Non-Blocking Decisions

- Exact deployment provider.
- Whether API is Next.js route handlers or separate NestJS/Fastify service.
- Exact PDF rendering approach.
- Whether Google Drive/Calendar/Gmail are implemented in first build milestone or phased after core CRM.
- Exact L03 phase/task templates content.

