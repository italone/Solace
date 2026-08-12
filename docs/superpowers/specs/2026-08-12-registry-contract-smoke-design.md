# Registry Contract Smoke Design

**Date:** 2026-08-12

**Target:** Repeatable post-publish validation for a selected npm release of
`@italone/solace`

## Goal

Turn the successful beta.4 registry smoke into a repository-owned command that can validate an
explicit published version or dist-tag without rebuilding or reading the local `dist/**` output.
The command must prove the eight protected public entries remain consumable, server rendering works,
and an unsupported private deep path remains blocked.

This is release-tooling hardening after `0.1.0-beta.4`. It does not change runtime behavior, package
exports, version metadata, dist-tags, or the published beta.4 tarball.

## Context

The repository already has two different package checks:

- `pnpm package:smoke` builds and installs the current local tarball.
- `pnpm stable:app:upgrade` compares the exact published beta.2 baseline with the current local
  candidate through the Operations Console.

The beta.4 publication also used an ad hoc registry smoke after npm publish. That check established
the right contract but is not yet repeatable from a project script. Folding registry access into the
ordinary local or pull-request gate would make those deterministic checks network-dependent, while
leaving the smoke ad hoc makes future release verification easy to omit or execute inconsistently.

## Selected Approach

Add a dedicated Node CLI and package script:

```bash
pnpm registry:smoke -- 0.1.0-beta.4
pnpm registry:smoke -- beta
```

The single positional target is required. It may be a valid npm version or dist-tag for the fixed
package name `@italone/solace`. The CLI does not accept another package name and does not silently
default to `beta`, because a moving default would make release evidence ambiguous.

The command is an explicit network-backed audit step. It is documented for post-publish verification
and manual compatibility audits, but it is not added to `quality`, `release:check`,
`release:candidate:check`, or routine CI. A candidate cannot be checked through the registry before
it is published.

## Alternatives Considered

### Extend `package:smoke`

The local packed-consumer script already validates a broad contract, but making it switch between a
local tarball and npm would mix two different sources of truth. It would also make a release gate
that is currently local and deterministic depend on registry availability. Keep local candidate and
published registry validation separate.

### Extend `stable:app:upgrade`

The Operations Console is the stronger real-application comparison and should remain pinned to a
known compatibility baseline. Reusing it for post-publish export verification would require a full
application copy/build for checks that only need Node imports, SSR output, package metadata, and
exports blocking. Keep this smoke smaller and faster.

### Keep the command external to the repository

This avoids code changes but leaves the exact entry matrix, failure behavior, and cleanup process
undocumented and untested. The release process already depends on these facts, so the repository
should own the command.

## CLI Contract

The implementation will add `scripts/registry-contract-smoke.mjs` and a package script named
`registry:smoke`.

Argument behavior:

1. Exactly one non-empty positional target is required.
2. `--help` prints usage and exits successfully without network access.
3. Missing or extra positional arguments exit non-zero with a usage error.
4. Targets containing whitespace, path separators, `file:`, URLs, or another package name are
   rejected before any child process starts.
5. Accepted targets are appended only to the fixed package name, producing
   `@italone/solace@<target>`.

Examples of accepted inputs include `0.1.0-beta.4`, `0.0.5`, `beta`, and `latest`. The CLI reports
both the requested target and the installed package version so a moving dist-tag remains auditable.

## Temporary Consumer Flow

The CLI uses `mkdtemp()` under the operating-system temporary directory and removes the workspace in
a `finally` block.

The flow is:

1. Create a minimal private ESM consumer package.
2. Install only `@italone/solace@<target>` from npm with lifecycle scripts disabled.
3. Import the installed `@italone/solace/package.json` through its protected public entry using
   Node's JSON import attributes, then confirm its name and version.
4. Run an ESM contract probe from the temporary consumer.
5. Print a concise success summary containing the resolved version and completed check groups.
6. Remove the temporary consumer on success or failure.

The implementation must use argument arrays with `spawn`, not shell interpolation. It must not read,
print, or persist npm credentials. Registry authentication and network configuration remain owned by
the caller's existing npm environment.

## Contract Matrix

The ESM probe imports exactly the eight protected entries documented by the `0.1.x` compatibility
policy:

1. `@italone/solace`
2. `@italone/solace/jsx-runtime`
3. `@italone/solace/jsx-dev-runtime`
4. `@italone/solace/devtools`
5. `@italone/solace/server`
6. `@italone/solace/sfc`
7. `@italone/solace/vite`
8. `@italone/solace/package.json`

The smoke asserts only stable entry-level signals:

- each entry resolves and imports, with the package metadata entry using JSON import attributes;
- representative documented exports exist for runtime, JSX, DevTools, server, and Vite entries;
- the SFC entry resolves to its intentionally empty runtime module; its type-shim behavior remains
  covered by the existing packed-consumer TypeScript gate;
- package metadata reports `@italone/solace` and a resolved version matching an exact requested
  version when the target is an exact semver;
- `renderToString(h("p", null, "registry contract smoke"))` returns exactly
  `<p>registry contract smoke</p>` with no styles;
- importing `@italone/solace/dist/index.js` fails with Node's package-exports boundary error.

The probe does not duplicate the full packed-consumer typecheck, Router workflows, browser E2E, SFC
compilation, or Operations Console behavior. Those stay in their existing gates.

## Error Classification

Every failure is prefixed with one of these stable stage labels:

- `registry smoke usage failed`
- `registry smoke install failed`
- `registry smoke metadata failed`
- `registry smoke public entry failed`
- `registry smoke server render failed`
- `registry smoke private entry failed`

Child-process failures include the command name and exit status, while preserving useful npm stderr.
The CLI does not reinterpret DNS, authentication, package-not-found, or registry timeout errors as
contract failures; they remain under the install stage so maintainers can distinguish environment
failures from package behavior.

## Test Strategy

Unit tests will exercise CLI orchestration without reaching npm. The script should expose no public
library API, but it may support test-only environment overrides for the package-manager executable
and temporary root, matching the repository's existing script-test style.

Tests cover:

- required target, extra target, unsafe target, and `--help` behavior;
- exact construction of the fixed `@italone/solace@<target>` dependency;
- lifecycle scripts disabled during install;
- all eight protected entry strings present in the generated probe;
- the exact SSR paragraph assertion;
- the private `dist/index.js` rejection assertion;
- stage-specific failure prefixes for install and probe failures;
- cleanup after success and failure;
- `package.json` contains `registry:smoke` while ordinary release and CI commands remain unchanged.

The real network path is verified explicitly with:

```bash
pnpm registry:smoke -- 0.1.0-beta.4
```

That command is release evidence, not a unit test and not a routine CI dependency.

## Documentation

Update `docs/release.md` with a post-publish registry verification section that distinguishes:

- local candidate validation: `pnpm package:smoke`;
- pinned real-application upgrade validation: `pnpm stable:app:upgrade`;
- published package validation: `pnpm registry:smoke -- <version-or-tag>`.

The beta.4 release log remains historical evidence and is not rewritten to pretend this command was
used during the already completed publish. A new project-log entry records the tooling addition and
the first successful repeat run against exact beta.4.

## Files and Boundaries

Expected implementation files:

- add `scripts/registry-contract-smoke.mjs`;
- add `tests/unit/scripts/registry-contract-smoke.test.ts`;
- modify `package.json`;
- modify `docs/release.md`;
- modify the release-readiness script test only if it owns the package-script presence contract;
- add a project-log entry and index row.

Explicitly unchanged:

- `src/**`;
- package version and `CHANGELOG.md`;
- package `exports` and protected entry list;
- `.changeset/**`;
- `release:check`, `release:candidate:check`, publish commands, and CI;
- npm dist-tags and Git release tags.

## Acceptance Criteria

- The CLI requires an explicit safe version or dist-tag target.
- An exact beta.4 registry run installs the public npm package, validates all eight protected entries,
  renders the expected SSR paragraph, and proves the private deep path is blocked.
- Failures identify usage, install, metadata, public-entry, server-render, or private-entry stage.
- Temporary files are removed on success and failure.
- Unit tests do not access the network.
- Normal local/PR/release-candidate gates remain deterministic and unchanged.
- No runtime source, public API, package version, release tag, or npm dist-tag changes.

## Risks

The main risk is accidentally treating a registry outage as a package regression. Stage-prefixed
errors and keeping the command out of routine CI contain that risk. The second risk is duplicating
the much broader packed-consumer smoke; the matrix intentionally stays at public entry resolution,
one server-render observable, metadata, and private deep-path blocking. The third risk is unsafe
package-manager argument handling; the fixed package name, strict target validation, and non-shell
spawn calls prevent arbitrary package or command injection.
