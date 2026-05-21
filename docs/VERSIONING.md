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
