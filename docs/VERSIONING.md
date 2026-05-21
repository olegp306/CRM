# Versioning

The CRM project uses SemVer before the public `1.0.0` release.

## Current Stable Baseline

Current stable version: `0.1.0`

Stable tag format:

```text
v0.1.0
v0.2.0
v0.2.1
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

The same panel summarizes planning event count, total planned items, total skipped items, and planning actor counts for the current history scope.

The `Release workflow` panel summarizes the selected version as a lightweight checklist: captured feedback, remaining planning work, release notes review, and Markdown export readiness.

The `Release readiness` panel shows whether the selected version is blocked or ready for release note review, including actionable counts, planned counts, draft item counts, and explicit blockers.
