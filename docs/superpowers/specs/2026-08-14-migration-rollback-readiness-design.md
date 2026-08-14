# Migration And Rollback Readiness Design

**Date:** 2026-08-14

**Target:** Replace the boolean-only `1.0` migration criterion with auditable documentation evidence
while keeping real npm publication, dist-tag changes, and rollback execution outside this work.

## Goal

Make the `release.migration-policy` criterion pass only when compatibility, deprecation, migration,
and rollback procedures are both explicitly marked as documented and linked to checked-in evidence.
Add an English and Chinese runbook that maintainers and package consumers can execute without relying
on repository source aliases or mutable npm artifacts.

This slice proves that a release procedure exists. It does not claim that two real applications have
adopted Solace, that benchmark history exists, or that a live npm rollback has been rehearsed. Those
remain separate `1.0` criteria or external release operations.

## Evidence Model

Keep `evaluateOneZeroReadiness()` pure. Replace each boolean under `migrationPolicy` with a structured
record:

```json
{
  "documented": true,
  "evidence": ["docs/compatibility.md", "docs/compatibility.zh-CN.md"]
}
```

The four required keys remain `compatibility`, `deprecation`, `migration`, and `rollback`. A key
passes only when:

- its value is an object;
- `documented` is exactly `true`;
- `evidence` is a non-empty array;
- every evidence entry is a non-empty repository-relative path string.

The evaluator reports missing or malformed keys by name in the existing
`release.migration-policy` message. Bare booleans no longer pass. This prevents the readiness file
from claiming completion without identifying reviewable artifacts.

The JSON evaluator does not parse Markdown or access the filesystem. The existing documentation
contract test reads the referenced files directly and verifies the required headings and procedural
content. Keeping these responsibilities separate preserves deterministic unit tests while still
binding the checked-in evidence paths to real documents.

## Migration Runbook

Add `docs/migration.md` and `docs/migration.zh-CN.md`. Both documents describe the same procedure and
must remain synchronized.

The migration procedure covers:

1. Classify the release against the eight protected package entries and the documented maturity
   labels.
2. Identify affected imports, public types, runtime behavior, error contracts, and replacement APIs.
3. For a deprecation, add visible documentation and TypeScript `@deprecated` markers where the type
   surface supports them, retain the old boundary, name the replacement, and provide before/after
   consumer examples.
4. Prepare the changeset or explicitly selected prerelease metadata, release note, compatibility
   matrix entry, and retained tests.
5. Validate an exact-version package consumer from npm or a release tarball without `src/**` or
   `dist/**` aliases. Run install, typecheck, build, relevant CSR or SSR/hydration checks, bundle
   review, and failure recovery checks.
6. Record the source version, target version, affected public entries, commands, results, unresolved
   risks, and rollout decision before publication.

The runbook distinguishes repository fixtures from independent real applications. A fixture can
validate the package contract but cannot satisfy `adoption.independent-apps`.

## Rollback Runbook

The same bilingual runbook defines rollback triggers and actions.

Rollback triggers include a protected-entry regression, consumer typecheck or build failure,
unexpected CSR or SSR/hydration behavior, unrecoverable runtime errors, bundle regressions outside
the approved budget, or accidental permission widening.

Rollback actions are ordered:

1. Stop further rollout and preserve logs, package versions, lockfiles, and failing consumer evidence.
2. Pin affected consumers to the last verified exact npm version and reinstall from the lockfile.
3. Re-run the affected package-only consumer and compatibility smoke to verify recovery.
4. Revert the source change and publish a new corrective version if repository code must change.
5. Change an npm dist-tag only after explicit maintainer approval, pointing it to an already
   published immutable version.
6. Record the trigger, known-good version, corrective version, dist-tag decision, verification
   results, and follow-up owner.

The procedure never overwrites, deletes, or republishes an existing npm version, and it never moves a
Git release tag to different content. `npm unpublish`, publication, dist-tag mutation, Git push, and
tag creation remain external-state changes requiring separate maintainer authorization.

## Documentation Integration

- `docs/release.md` links the runbook from the `1.0` admission report and release checklist.
- `docs/roadmap.md` records the migration/rollback procedure as satisfied once the structured evidence
  and bilingual documents pass their tests.
- `docs/project-status.md` and `docs/project-status.zh-CN.md` update the current `1.0` report so only
  truthful remaining gaps are listed.
- `release/one-zero-readiness.json` uses structured evidence for all four procedure keys.
- UI library and plugin marketplace work remain outside the mainline and outside this criterion.

## Error Handling

- A boolean or missing migration-policy record fails with the affected procedure name.
- An empty evidence array fails even when `documented` is `true`.
- Empty, absolute, or parent-traversal path strings are rejected as evidence references.
- `--report` continues printing every criterion in one run and exits successfully for inspection.
- The default check continues exiting nonzero while real adoption or performance evidence is absent.

## Testing

Use test-first changes in the existing readiness and documentation suites:

1. Change the ready fixture to structured records and confirm the current evaluator fails.
2. Add negative cases for legacy booleans, empty evidence, empty paths, absolute paths, and `..`
   traversal.
3. Implement the minimal structural evaluator and verify the focused readiness tests pass.
4. Add documentation assertions for the English and Chinese migration and rollback procedures,
   immutable-version rule, exact consumer validation, and explicit external-state authorization.
5. Update the evidence file and verify `pnpm release:one-zero:check -- --report` changes only
   `release.migration-policy` from FAIL to PASS.
6. Run formatting, focused tests, `pnpm release:check`, refresh the final test metrics in both project
   status documents, and run `git diff --check`.

## Non-Goals

- No npm publish, unpublish, dist-tag mutation, Git push, or tag creation.
- No fabricated independent application or benchmark-history evidence.
- No router-aware SSR/hydration implementation.
- No auth, permissions, streaming, Suspense, UI library, or plugin marketplace work.
- No automated rollback command that mutates consumer repositories or registry state.
