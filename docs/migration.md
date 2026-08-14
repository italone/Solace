# Migration And Rollback Runbook

[简体中文](./migration.zh-CN.md)

This runbook defines the release procedure required by the Solace `1.0` admission gate. It applies
to documented public package entries and behavior. It does not turn repository fixtures into real
adoption evidence or authorize npm and Git mutations.

## Migration Procedure

1. Compare the source and target releases against the eight protected entries in
   [Compatibility And Deprecation Policy](./compatibility.md). List every affected import path,
   public type, runtime behavior, documented error contract, and maturity label.
2. Classify the change as additive, fix-only, deprecated, or breaking. A `0.1.x` patch cannot remove
   a protected entry or introduce an incompatible stable signature.
3. For every deprecation, add a visible documentation marker and a TypeScript `@deprecated` marker
   where the public declaration can express it. Name the replacement, retain the old boundary, and
   publish a release-specific migration note with before and after consumer examples.
4. Prepare a changeset or the explicitly selected prerelease metadata, release note, compatibility
   matrix entry, and retained tests before changing the published package.
5. Validate the target package in an exact-version package consumer, record the results, and resolve
   failures before approving rollout.
6. Record the source version, target version, affected public entries, verification commands,
   results, unresolved risks, and rollout decision.

Repository examples and the package-only adoption fixture validate contracts, but they do not satisfy
`adoption.independent-apps`. That criterion requires separately owned applications installed from
npm.

## Exact Package Consumer Validation

Use an exact published version for upgrade evidence:

```bash
pnpm registry:smoke -- <exact-version>
pnpm adoption:smoke -- --package <exact-version>
pnpm stable:app:upgrade
```

For an unpublished candidate, `pnpm adoption:smoke` installs the local tarball into a temporary
consumer. In every consumer, imports must use documented `@italone/solace` package paths. Do not use
`src/**`, `dist/**`, workspace links, or source aliases.

The validation record must include:

- dependency installation and resolved exact version;
- TypeScript typecheck and production bundle results;
- CSR interaction results when the application runs in a browser;
- SSR output, matching hydration identity, and explicit recovery behavior when server rendering is
  used;
- bundle observations, expected failure paths, and error recovery results;
- browser inventory and any environment or network failure kept separate from contract failures.

## Evidence Record

Store a release-specific record with these fields:

| Field                | Required content                                                    |
| -------------------- | ------------------------------------------------------------------- |
| Source version       | Exact current consumer version                                      |
| Target version       | Exact candidate or npm version                                      |
| Protected entries    | Every affected export key and import path                           |
| Replacement          | Named replacement and release-specific before/after example         |
| Commands and results | Install, typecheck, build, runtime, SSR/hydration, and browser data |
| Known-good version   | Exact rollback target already verified by the consumer              |
| Risks and decision   | Unresolved risks, rollout decision, reviewer, and date              |
| Follow-up            | Corrective version or retained-test owner when applicable           |

Do not mark evidence verified when a command was skipped, a registry request failed, or the package
was replaced with a source alias.

## Rollback Triggers

Stop rollout and begin rollback when any of these conditions is confirmed:

- a protected package entry no longer resolves or its stable signature becomes incompatible;
- an exact-version consumer fails installation, typecheck, or production build;
- CSR behavior, SSR output, hydration identity, or documented recovery changes unexpectedly;
- a runtime failure cannot recover through the documented boundary;
- bundle size or performance exceeds the approved release budget;
- DevTools or package changes widen permissions beyond the reviewed origins;
- a severe security or correctness issue requires the exception path in the compatibility policy.

## Rollback Procedure

1. Stop further rollout. Preserve logs, exact package versions, package-manager lockfiles, bundle
   output, browser results, and the failing consumer evidence.
2. Restore each affected consumer's `package.json` and lockfile to the last verified exact npm
   version. Reinstall with the consumer's locked package-manager workflow.
3. Re-run the failing exact package consumer, `pnpm registry:smoke -- <known-good-version>`, and the
   relevant compatibility smoke. Record whether the previous behavior is restored.
4. Revert the source change when repository code must change. Publish a new corrective version after
   the normal release gate; never reuse the affected version number.
5. Change an npm dist-tag only when a maintainer explicitly approves pointing it to an already
   published known-good version.
6. Record the trigger, known-good version, corrective version, dist-tag decision, recovery results,
   reviewer, and follow-up owner.

An unsuccessful rollback remains an incident. Do not resume rollout until the exact package consumer
and affected public-contract gates pass.

## Registry And Git Boundaries

Published npm versions are immutable. Never overwrite, delete, or republish an existing version as a
rollback technique, and never move an existing Git release tag to different content.

`npm publish`, `npm unpublish`, `npm dist-tag`, `git push`, and Git tag creation require separate
maintainer authorization. This runbook documents those decisions but does not grant permission to
perform them. A dist-tag rollback must point to an already published exact version; a source fix must
ship under a new version after the normal release checks.
