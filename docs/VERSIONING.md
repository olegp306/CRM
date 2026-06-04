# Versioning

The CRM project uses SemVer before the public `1.0.0` release.

## Current Stable Baseline

Current stable version: `0.4.3`

Stable tag format:

```text
v0.1.0
v0.2.0
v0.2.1
v0.2.2
v0.2.3
v0.2.4
v0.3.0
v0.3.1
v0.3.2
v0.3.4
v0.3.5
v0.3.6
v0.3.7
v0.3.8
v0.3.9
v0.4.0
v0.4.1
v0.4.2
v0.4.3
```

## Branch Workflow

`main` is always stable.

Create feature branches from `main`:

```text
codex/<feature-name>
```

Examples:

```text
codex/versioning-workflow
codex/lead-table-inline-editing
codex/telegram-lead-attachments
```

When features are being prepared as a sequence of pull requests, use stacked branches:

1. Finish and push the current feature branch.
2. Create the next feature branch from the tip of the previous feature branch.
3. Keep each branch focused so PRs can be merged into `main` in order.

Example:

```text
main
  -> codex/feedback-version-filter
    -> codex/next-feedback-feature
```

## Verification Before Merge

Before merging a feature branch into `main`, run:

```bash
pnpm typecheck
pnpm test
```

## Version Bumps

Use `minor` for product features:

```text
0.1.0 -> 0.2.0
```

Use `patch` for fixes:

```text
0.2.0 -> 0.2.1
```

Reserve `major` for the public `1.0.0` release.

## Stable Release Steps

1. Merge the verified feature branch into `main`.
2. Bump the root `package.json` `version`.
3. Commit the version bump.
4. Tag the stable commit:

```bash
git tag v0.2.0
```

5. Push the branch and tags:

```bash
git push origin main
git push origin v0.2.0
```

## Feedback Version Capture

Support, bug, UX feedback, feature requests, and permission-blocked signals store `appVersion`.

This makes it possible to connect a request such as "please add this feature" to the product version where the message was created.

## Release Triage

The platform feedback inbox includes release triage grouped by `appVersion`.

Use it to see which product versions generated the most open support, bug, UX, and feature-request signals before planning the next minor or patch release.

The same inbox also shows a release notes draft for the selected version. Draft sections are generated from feedback signals:

- feature requests become `Features`;
- bug reports become `Fixes`;
- support, UX, and permission-blocked signals become `Support and UX`.

Use `Download Markdown` in the release notes draft panel to export the selected version draft as a Markdown file for planning, support replies, or release notes review.

Use `Plan release items` in the same panel to move actionable `new` and `triaged` feedback for the selected version into `planned` without touching already planned, transferred, declined, archived, or other-version signals.

Release planning writes a `platform.release.planned` audit event with the selected `appVersion`, planned item count, skipped count, and actor user ID so support messages can be traced back to the product version and planning action that handled them.

The feedback inbox also shows a `Release history` panel sourced from those audit events, making prior planning actions visible alongside triage, readiness, workflow, and release notes draft panels.

Use `Export CSV` in the `Release history` panel to download prior release planning actions with version, actor, planned count, and skipped count. When a version filter is selected, the panel and export are scoped to that same `appVersion`.

The release history export link exposes an accessible label that names whether it exports all versions or the selected version scope.

The panel header states that release history and CSV export follow the selected version filter, so operators can tell when they are looking at a scoped history view.

Each release history row exposes a combined accessible label with version, actor, planned count, and skipped count.

Release history summary metrics expose matching accessible labels for the visible planning event, planned, and skipped counts.

The same panel summarizes the active history scope, top planning actor, planning event count, total planned items, total skipped items, and planning actor counts. The history scope metric has a matching accessible label. Planning actors are sorted by activity, with stable alphabetical ordering for ties. Actor counts use singular/plural event wording, and each actor chip exposes the full actor name in the title attribute plus a matching accessible label. The top actor metric also exposes the full actor name when the visible value is truncated and has a matching accessible label; when no release planning event exists yet the metric shows `No actor yet` and `No actor events yet`.

When a version filter is active, the history scope metric includes `View all history` to clear the version and return to the full release planning timeline.

When another scope is active, the same metric includes `Current version history` to jump to release planning events for `currentAppMetadata.version`.

When no release planning events exist yet, the panel prompts operators to use `Plan release items` to create the first history event.

The empty history state also exposes an accessible label that names the current history scope.

The `Release workflow` panel summarizes the selected version as a lightweight checklist: captured feedback, remaining planning work, release notes review, and Markdown export readiness.

The `Release readiness` panel shows whether the selected version is blocked or ready for release note review, including actionable counts, planned counts, draft item counts, and explicit blockers.

## 0.4.25

Lead table and client linking release:

- Lead tables now default to the client, project, area, description, interest, urgency, todo, address, phone, email, messenger, source, and client-project-count columns.
- Column visibility, widths, and column order are saved, and table headers can be reordered with drag handles.
- Lead creation from Telegram or web intake links to an existing matching client, or creates and links a client when enough contact data is available.
- Client-owned lead table fields can be edited inline through the linked client record.
- Lead cards now order editable fields to match the default lead table first, then show the remaining fields.
- Lead cards include a confirmed `Delete lead` action that removes the lead and its linked context/calendar rows.

## 0.4.3

Telegram lead undo release:

- Telegram lead creation replies include an `Undo` action that removes or archives the newly created lead and clears linked context/calendar rows.
- Telegram lead update replies include an `Undo` action that restores the previous lead fields.
- After undoing an update, Telegram can create a separate new lead from the same source material when the update was actually a new request.
- Typed lead undo requests now ask for clarification instead of accidentally creating or updating a lead.
- Telegram undo records are persisted through assistant channel audit metadata so callbacks can be recovered outside in-memory state.

## 0.4.2

Lead search routing and changelog release:

- Telegram CRM Orchestrator understands human search phrases for project titles, client names, tags, locations, and recent lead lists.
- Search results return readable CRM buttons and filtered CRM result links.
- Lead display names stay compact in Telegram confirmations, CRM cards, and search results.
- Clicking the app version in the web UI opens concise release notes for the current build.
- Settings lead reset clears lead context entities and calendar actions before deleting test leads.

## 0.4.1

Telegram CRM orchestration and lead search release:

- Telegram and Web Assistant use updated default prompts for CRM orchestration, CRM entity extraction, and reminder handling.
- Lead cards and Telegram confirmations now use clearer lead names built from the client and project context.
- Telegram lead search can find leads by human title fragments, client names, tags, and recent-list requests, then returns CRM buttons with readable lead titles.
- Lead list URLs can open filtered CRM results for searches by date, temperature, status, or free-text lead title.
- Telegram sends an early processing acknowledgement for larger batches of files/messages and returns a generic server-error message if heavy intake fails.
- Web lead cards surface next action/calendar context and keep lead search/filter state available from shared table-store logic.

## 0.4.0

CRM entity extractor agent release:

- Settings now include a CRM Entity Extractor agent prompt and model selector.
- Telegram and Web Assistant lead create/update flows extract CRM facts, follow-ups, people, organizations, events, and tags from user input.
- Extracted CRM context is persisted on leads and shown in lead cards as a compact CRM context section.
- Extracted future actions can appear in Today alongside assistant follow-ups.
- Lead search can use generated display names and extracted search tags.

## 0.3.9

Lead summary translation hotfix:

- Lead summary translation now returns a safe UI error instead of crashing the production Server Components render.
- The translation action handles missing OpenAI configuration, failed OpenAI responses, and empty translations without throwing expected server action errors.
- The web lead card reads both compact and nested OpenAI Responses API text payloads.

## 0.3.8

Telegram lead confirmation polish release:

- Telegram lead creation confirmations no longer repeat the lead id in the field list.
- The lead summary now appears directly under the pricing/missing-data block as plain text without a `Summary:` label.
- Confirmation fields remain focused on status, KP readiness/generation, request details, standard flag, and missing KP data.

## 0.3.7

Settings reset hotfix:

- Fixed the Settings page crash caused by a non-async export in the lead reset server action module.
- The protected lead reset dialog keeps its client-side state in a regular module while the server action file exports only async actions.
- Verified the production build and `/settings` route load successfully after the fix.

## 0.3.6

Protected lead reset release:

- Settings now include a protected danger-zone action to clear lead rows for the current workspace.
- The action requires the confirmation password before deleting lead data.
- Lead reset deletes only lead records, leaving clients, projects, templates, files, and workspace settings intact.
- Lead reset writes an audit log event with the number of deleted rows.

## 0.3.5

Lead summary card polish release:

- Lead cards opened from Telegram CRM links now show a cleaner Lead Summary Info block before History.
- Telegram text is shown as readable message content without Telegram ids, source links, or download controls.
- Long text and audio summaries stay compact with an option to expand the full text.
- Saved photos, PDFs, and audio materials use concise descriptions and view links.
- Fullscreen lead cards stay inside the mobile viewport, keeping Close and accordion rows usable.

## 0.3.0

Client material analysis release:

- Settings now include an AI intake page where admins can edit the client-material analysis metaprompt and choose the parsing model.
- Telegram and Web Assistant lead intake pass source materials through the workspace prompt before creating or updating lead data.
- Lead cards show overall lead summary info plus concise per-file summaries for saved PDFs, photos, and audio source materials.
- The default prompt is adapted for Reyzbikh Architekten KP fields and returns strict JSON without inventing missing data.

## 0.2.4

Telegram notes and lead card reliability release:

- Lead card accordion sections render as usable collapsed blocks on mobile/fullscreen cards instead of thin strips.
- Telegram reminder-style messages are routed to follow-up/history instead of creating lead drafts.
- Telegram replies and selected-lead messages can save natural client context notes into lead history.
- Client-context phrases such as "дополнительная информация" and "запомни об этом клиенте" are prioritized before generic note handling.

## 0.2.3

Lead card and Telegram interaction release:

- Lead cards now open fullscreen from table rows, mobile cards, and Telegram CRM links.
- The lead card close action stays visible while scrolling.
- Telegram replies can save human notes into lead history without creating a new lead.
- Telegram returns a CRM button after lead updates, notes, KP sent, and undo actions.
- Telegram release notes can be sent quietly after an explicit preview/confirm step.

## 0.2.2

Assistant duplicate safety and CSV export release:

- Tables now expose CSV export actions for leads, clients, projects, and cold targets.
- Web Assistant and Telegram share stronger lead duplicate/update matching behavior.
- Exact duplicate lead creation is blocked, likely updates point to the existing lead, and partial matches ask for clarification.
- Lead history records duplicate checks, interaction notes, KP status actions, and channel events more clearly.

## 0.2.1

Telegram audio intake release:

- Telegram now accepts voice messages and uploaded audio files as lead source material.
- Audio is saved with the original attachments, transcribed, and included in lead parsing.
- Mixed photos, PDFs, and audio can feed the same lead/KP workflow.
- The bot asks for clarification when audio cannot be understood safely.

## 0.2.0

Shared Web Assistant and Telegram assistant channel architecture:

- Web and Telegram now share lead-flow decisions, draft merge rules, KP missing-field readiness, normalized lead actions, and channel event history contracts.
- Lead history can include channel events from both Web and Telegram audit logs.
- Theme/dark-mode questions are routed as assistant capability requests instead of lead intake.
