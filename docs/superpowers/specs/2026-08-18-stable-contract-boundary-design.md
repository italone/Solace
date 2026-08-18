# Stable Contract Boundary Design

## Goal

Freeze the current Solace public maturity boundary without promoting beta or experimental APIs to
stable compatibility promises. This design makes the boundary explicit, machine-checkable, and
reviewable before any future 1.0 admission decision.

## Current Boundary

The protected package entries remain the eight exports listed in `release/public-contract.json`:

| Entry               | Maturity     | Compatibility scope                                                                       |
| ------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `.`                 | beta         | Core runtime, reactivity, rendering, components, store, and the beta Router/async surface |
| `./devtools`        | beta         | Instrumentation listener and recorder APIs                                                |
| `./jsx-dev-runtime` | stable       | Development JSX runtime                                                                   |
| `./jsx-runtime`     | stable       | Automatic JSX runtime                                                                     |
| `./package.json`    | stable       | Published package metadata                                                                |
| `./server`          | beta         | SSR, SSG, and hydration helpers                                                           |
| `./sfc`             | experimental | Narrow `.solace` type shim                                                                |
| `./vite`            | experimental | Narrow `.solace` Vite transform plugin                                                    |

The root entry remains beta because it exposes Router and asynchronous rendering capabilities whose
compatibility surface is still being hardened. The server entry remains beta for the same reason.
SFC/Vite remain experimental and do not imply a stable component syntax or compiler ecosystem.

## Invariants

1. Every `package.json` export must appear exactly once in `release/public-contract.json`.
2. Maturity values are limited to `stable`, `beta`, and `experimental`.
3. `stableAdmission` remains `false` while any protected entry is beta or experimental.
4. A maturity promotion requires a separate design, synchronized English and Chinese contract
   documentation, retained package-boundary tests, a changeset, and fresh release evidence.
5. This freeze does not add exports, change signatures, widen Router/SSR/SFC/Vite/DevTools behavior,
   or alter the beta compatibility policy.
6. Runtime implementation details and deep subpaths remain outside the public compatibility
   guarantee.

## Verification Design

The existing public-contract checker remains the first line of defense. Its tests must additionally
assert the exact maturity map and the stable-admission invariant, so a future manifest edit cannot
silently promote an entry or claim 1.0 readiness. Documentation contract tests must keep the English
and Chinese compatibility tables synchronized with the manifest.

The 1.0 readiness checker continues to treat `stableAdmission: false` as an honest incomplete state.
Adoption, performance, DevTools distribution, migration, and compatibility evidence are evaluated
independently; passing the boundary check alone must never produce a 1.0 release decision.

## Release Workflow

For any public contract change:

1. Write or update a focused design before implementation.
2. Update `release/public-contract.json`, compatibility documentation, and the synchronized Chinese
   documentation in one change.
3. Add or update package-export and documentation contract tests.
4. Add a changeset and release note describing the maturity or signature impact.
5. Run the focused contract tests, `pnpm release:contract:check`, `pnpm quality`, and the applicable
   release gates before making a publish decision.

The current beta.6 work only freezes the boundary and does not satisfy these promotion requirements.

## Out Of Scope

- Opening `stableAdmission` or declaring Solace 1.0 ready.
- Splitting the root entry into new stable and beta subpaths.
- Router, async SSR/SSG/hydration, SFC/Vite, DevTools, auth, permissions, or plugin ecosystem
  feature work.
- Production adoption evidence, browser-history backfill, or production DevTools distribution; those
  remain separate 1.0 evidence tracks.
