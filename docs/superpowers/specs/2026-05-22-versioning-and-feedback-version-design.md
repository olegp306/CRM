# Versioning And Feedback Version Design

## Purpose

Starting now, the CRM project uses explicit release versioning so stable states can be restored, feature work can be isolated, and support or feature-request messages can be traced back to the product version where they were created.

## Version Scheme

The project uses SemVer while the product is pre-1.0:

- `0.1.0`, `0.2.0`, `0.3.0` for feature releases.
- `0.1.1`, `0.2.1` for fixes to an existing release.
- `1.0.0` is reserved for the first public/stable product release.

The current stable baseline is `0.1.0`, because `main` already contains the first working CRM/Telegram loop.

## Branching Model

`main` is always the stable branch.

All product work starts in a feature branch named:

```text
codex/<feature-name>
```

Before a feature branch is merged into `main`, it must pass:

```text
pnpm typecheck
pnpm test
```

After a merge into `main`, the project version is bumped and the stable commit is tagged:

```text
v0.1.0
v0.2.0
v0.2.1
```

## Version Storage

The source of truth for the app version is the root `package.json` `version` field.

The web app and server-side packages read this version through a small shared metadata module rather than duplicating a literal version string. This keeps support capture, UI display, and future release tooling aligned.

## Feedback Version Capture

Support, bug, UX feedback, and feature-request items store the app version that was active when the assistant message was submitted.

The field is named:

```text
appVersion
```

It is attached when a `FeedbackItem` is created from an assistant message. It is shown in the platform feedback inbox so an operator can connect a request or bug to a specific product version.

## UI Behavior

The platform feedback table shows the version for each item. If older rows do not have a version, the UI shows a neutral fallback such as `unknown`.

The app shell may also show the current version in a low-emphasis area, such as the sidebar footer, so testers can easily report what build they are using.

## Documentation

Add `docs/VERSIONING.md` with the practical release workflow:

- create a feature branch;
- develop and verify;
- merge to `main`;
- bump `version`;
- tag the stable release;
- push commits and tags.

## Testing

Add focused tests for:

- reading current app metadata from `package.json`;
- creating feedback with `appVersion`;
- listing platform feedback with version data;
- rendering version data in the feedback UI.

Existing full verification remains:

```text
pnpm typecheck
pnpm test
```
