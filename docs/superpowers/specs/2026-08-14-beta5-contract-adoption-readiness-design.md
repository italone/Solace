# Beta.5 Contract, Adoption, And Readiness Design

**Date:** 2026-08-14

**Target:** Prepare `0.1.0-beta.5` as the next local candidate while keeping publication, remote
tags, and npm dist-tags outside this implementation.

## Goal

Close the repository-versus-release gap after beta.4, finish the TSX typed-slot producer contract,
add independent packed and registry-backed adoption evidence, define the router-aware SSR/hydration
boundary without widening the runtime API, and turn the `1.0` requirements into executable gates.

## Scope And Sequence

The work is split into five ordered slices:

1. Prepare the local `0.1.0-beta.5` candidate and validate both the long-term beta.2 baseline and
   the most recent beta.4 baseline.
2. Extend typed slots from component-side consumption to JSX and `h()` production, including packed
   TypeScript consumer coverage.
3. Run independent CSR and SSR/hydration consumers from installed packages without source aliases.
4. Document router-aware SSR/hydration as the next production bottleneck while retaining explicit
   runtime rejection for router integration options.
5. Define machine-readable `1.0` admission checks for adoption, compatibility, performance history,
   DevTools permissions, and migration policy.

No slice publishes npm, pushes Git state, creates tags, adds auth or permissions, implements
streaming or Suspense, or creates a UI library or plugin marketplace.

## P0: Beta.5 Candidate And Compatibility Matrix

The next candidate version is `0.1.0-beta.5`. Package metadata, README status, CHANGELOG, English and
Chinese project status, release documentation assertions, and fresh gate metrics must move together.
Published registry state remains `latest -> 0.0.5` and `beta -> 0.1.0-beta.4` until a separate
maintainer publication decision.

The Operations Console compatibility smoke accepts repeatable `--baseline` arguments from an exact
allowlist. The release candidate gate runs the long-term `0.1.0-beta.2` baseline and the most recent
`0.1.0-beta.4` baseline before testing the local packed candidate. Baseline-specific capability
profiles keep beta.2/beta.4 consumers from compiling candidate-only APIs.

## P1: Typed Slot Producer Contract

`defineComponent<Props, Events, SlotMap>` already types component-side slot consumption. The producer
slice carries `SlotMap` through JSX managed props and `h()` children.

### JSX Rules

- Optional or required `default` slots determine whether JSX children are optional or required.
- A default slot with zero parameters accepts ordinary JSX children.
- A scoped default slot still accepts ordinary JSX children because JSX syntax cannot provide the
  scope callback explicitly; the scope contract remains enforced inside the child component.
- Components with no declared `default` slot reject JSX children.
- Named slots are not encoded as JSX attributes in this slice.

### `h()` Rules

- A declared slot map accepts a slot object whose keys and function signatures match the map.
- Required slots are required in the slot object.
- Unknown named slots and incompatible scoped-slot parameters are rejected.
- For components with a default slot, existing direct VNode/string/array children remain valid and
  are interpreted as the default slot.
- Components without an explicit slot map retain the existing broad `ComponentVNodeChildren`
  contract.

The runtime representation and normalization remain unchanged. This is a declaration-level contract
with source type tests, both JSX runtime modes, generated declarations, and packed consumer tests.

## P2: Independent Adoption Consumers

Add one fixture package with two entries installed from a package spec:

- CSR builds and executes a small routed interactive application.
- SSR/hydration renders HTML from the server entry, hydrates matching DOM without replacing the root
  node, and exercises explicit mismatch recovery.

The fixture imports only documented package paths and contains no repository source alias. The smoke
runner supports a local tarball for release gates and an exact published version for manual registry
audits. Browser verification covers Chromium, Firefox, and WebKit for the local candidate. Network
installation failures are reported separately from consumer contract failures.

## P3: Router-Aware SSR/Hydration Boundary

This iteration produces a reviewed design, not a public implementation. The future design centers on
an explicit server router snapshot created from `createMemoryHistory()`, serializable normalized
route state, and hydration-time verification that the client router resolves the same canonical
location before committing DOM effects.

The current APIs continue rejecting `router` options in SSR, SSG, and hydration. Contract tests and
documentation must retain those rejections so no accidental partial integration ships. Auth,
permissions, streaming, Suspense/selective hydration, route crawling, and filesystem output remain
separate designs.

## P4: 1.0 Admission Gate

Add a pure readiness checker driven by a versioned JSON evidence file. It reports each criterion and
fails until all are satisfied:

- two independent real applications;
- beta.2 and latest-beta upgrade coverage;
- at least five recent browser and jsdom benchmark records per required scenario;
- narrowed production DevTools host permissions;
- documented compatibility, deprecation, migration, and rollback procedures.

The repository-owned Operations Console is validation infrastructure and does not count as one of the
two independent applications. Missing evidence is an expected beta result, not something to bypass.

## Error Handling

- CLI argument errors identify the accepted exact baselines or package-spec forms.
- Registry/DNS/install failures are distinguished from candidate build, TypeScript, runtime, and
  browser failures.
- Readiness output lists every unsatisfied criterion in one run.
- Router integration attempts continue throwing field-specific `TypeError` messages.

## Validation

Focused TDD checks run before implementation for baseline parsing, typed slot producers, adoption
configuration, and readiness evaluation. Final validation includes `pnpm release:check`, both
network-backed baseline consumers when registry access is available, independent browser consumers,
`git diff --check`, and a clean generated-output review.
