# Beta.4 Contract Release Design

## Goal

Complete and publish `@italone/solace@0.1.0-beta.4` as a contract-stability release for the
currently implemented runtime. The release freezes runtime behavior and closes the version,
compatibility, documentation, and release-evidence loop without adding new framework features.

## Scope

This release may change only release metadata, release checks, tests for those checks, changesets,
release notes, and synchronized status documentation. It must not add or widen runtime APIs, router
behavior, SSR/SSG/hydration behavior, SFC syntax, DevTools payloads, or ecosystem integrations.

The published `0.1.0-beta.2` package is the compatibility baseline. The candidate must preserve all
eight protected package entries and existing synchronous return contracts while retaining the
documented beta or experimental labels for router, async rendering, SFC/Vite, and DevTools.

## Release Flow

1. Normalize all version references to the beta.4 release target and record one Changeset describing
   the additive async rendering/hydration contract and compatibility boundary.
2. Add a release-candidate upgrade gate that installs exact npm `beta.2`, builds the Operations
   Console against it, then compares the same consumer against the locally packed beta.4 candidate.
   Keep the network-backed check separate from ordinary PR quality checks.
3. Run the full local release gate, including package exports, packed consumers, Operations Console,
   coverage, benchmarks, three-browser E2E, and DevTools extension E2E.
4. Run publishable readiness, inspect the final npm tarball, publish with the `beta` dist-tag, and
   verify registry version/dist-tags, public entry imports, SSR output, and the matching Git tag.

## Failure Policy

Any failed gate stops the release. Fixes are limited to the existing contract or release process;
feature work is deferred to a later design. Registry or remote-network failures are reported as
environmental failures and must be retried, never bypassed by weakening the pinned baseline.

## Acceptance Criteria

- npm `beta` resolves to `0.1.0-beta.4`; npm `latest` remains `0.0.5`.
- The package version, Changeset, release notes, README, API docs, and English/Chinese project
  status all agree on the beta.4 scope and known gaps.
- `pnpm release:readiness -- --publishable`, the full `pnpm release:check`, the exact beta.2 upgrade
  smoke, tarball inspection, and post-publish registry smoke pass.
- The release commit and `v0.1.0-beta.4` tag are pushed, and the final worktree is clean.

## Out Of Scope

Streaming SSR, router-aware SSR/hydration, auth/permissions, Suspense/selective hydration, async
post-hydration scheduling, SFC syntax expansion, production DevTools distribution, UI components,
plugin ecosystem work, and unrelated refactoring.
