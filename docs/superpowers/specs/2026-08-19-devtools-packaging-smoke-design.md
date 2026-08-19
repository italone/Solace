# DevTools Packaging Smoke Design

## Goal

Exercise the real origin-scoped DevTools ZIP packaging path in routine CI and the local release gate
without presenting a synthetic origin or generated artifact as production distribution evidence.

## Current Gap

`pnpm package:devtools-extension` already requires exact HTTPS origins, rewrites every manifest
origin boundary, rejects privileged manifest keys, verifies the generated manifest, and writes a
deterministic ZIP plus SHA-256 evidence sidecar. Unit tests exercise that behavior through an injected
build callback, but routine CI and `pnpm release:check` do not execute the real Vite build and package
command.

The checked-in production evidence must remain incomplete. There is no reviewed production origin,
store artifact, store review, signing, automatic update channel, or production inspection result.

## Selected Approach

Add a `package:devtools-extension:smoke` package script that invokes the existing packaging command
with the RFC-reserved origin `https://devtools-smoke.invalid` and writes an ignored smoke artifact:

```text
.devtools-artifacts/solace-devtools-smoke.zip
```

The package command remains the single implementation of manifest rewriting, archive construction,
and digest generation. The smoke script adds no second packaging path and no new dependency.

## Evidence Boundary

The smoke proves only that the current source tree can produce a deterministic, minimally permissioned
distribution artifact through the real build path. It does not prove that any deployable application
origin was tested.

The smoke must not modify:

- `release/devtools-distribution-evidence.json`;
- `release/one-zero-readiness.json`;
- `distributableManifestVerified`;
- `testedOrigins`;
- browser-store, signing, review, or update claims.

The 1.0 evaluator will reject `.invalid` hostnames as production DevTools origins. This prevents the
smoke origin from being copied into a passing evidence record while preserving the existing exact
HTTPS checks for real declarations.

## Gate Integration

`pnpm release:check` will run `pnpm package:devtools-extension:smoke` before the benchmark and browser
test tail of the local gate. Release-readiness validation will require the script and its presence in
the release-check command sequence.

The CI `browser` job will run the same smoke after the ordinary package build and before Playwright
browser installation. This placement fails quickly on packaging or manifest drift and does not depend
on browser downloads. The existing DevTools extension E2E remains mandatory and separate because ZIP
construction is not a browser interaction test.

Generated `.devtools-artifacts/` output remains ignored. CI does not upload the smoke artifact because
it is not release evidence and retaining it could invite accidental promotion.

## Failure Behavior

The smoke exits nonzero when the real extension build fails, the requested origin is not applied
consistently, a privileged manifest key appears, the distribution contains a symlink, an archive path
is unsafe, or artifact writing fails. The existing child-process exit and signal diagnostics remain
authoritative.

The release and CI gates do not catch or downgrade those failures. No retry is added because packaging
is deterministic and does not depend on a remote service.

## Testing

Tests will be added before production changes and observed failing for the missing behavior:

1. the release-readiness contract requires the named smoke script and release-check ordering;
2. the CI workflow contract requires the smoke in the `browser` job before Playwright installation;
3. the 1.0 evaluator rejects `https://devtools-smoke.invalid` even when the remaining DevTools fields
   are otherwise internally consistent;
4. documentation states that smoke artifacts and `.invalid` origins never count as production
   evidence.

After implementation, run the focused tests, the real smoke command, format and type checks, the full
unit suite, `git diff --check`, and `pnpm release:check`. The final 1.0 report must remain `INCOMPLETE`
for the existing external adoption, five-date history, production DevTools, and stable-contract gaps.

## Rollback

Rollback removes the smoke package script and its release/CI references, restores the prior command
ordering assertions, and removes the `.invalid`-specific evaluator check only if the smoke mechanism
is abandoned. Ignored smoke artifacts may be deleted independently and never affect source evidence.

## Out Of Scope

- Selecting or inventing a production inspected origin.
- Updating production DevTools evidence fields.
- Publishing, signing, or submitting an extension to a browser store.
- Automatic updates or release-channel infrastructure.
- Expanding the panel into a component tree, dependency graph, flame chart, or persisted capture tool.
- Changing runtime DevTools events or package public APIs.
