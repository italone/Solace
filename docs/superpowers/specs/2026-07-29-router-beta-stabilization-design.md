# Router Beta Stabilization Design

## Goal

Continue stabilizing Solace's beta router by adding boundary coverage and one small capability:
documented, predictable normalization for path, query, and hash-history inputs. The work should make
the current router slice safer without widening it into guards, nested routes, redirects, named
routes, or auth/permission routing.

## Context

The router beta already exposes the first SPA slice from the package root:

- Static routes and dynamic params.
- `/:pathMatch(.*)*` wildcard fallback.
- Query parsing and stringifying.
- Web and hash history adapters.
- `createRouter`, `createWebHistory`, `createWebHashHistory`.
- `RouterLink`, `RouterView`, `useRouter`, and `useRoute`.

Recent stabilization added runtime and package-boundary checks for deferred route fields, deferred
router options, invalid route lists, invalid route paths, deferred object-location fields, and
deferred param syntax. The next useful slice is not a larger feature. It is clearer edge behavior for
the surfaces users already have.

## Scope

This project covers these existing contracts:

- `src/router/query.ts`
- `src/router/matcher.ts`
- `src/router/history.ts`
- `src/router/router.ts`
- `src/router/components.ts`
- Router documentation in `docs/api.md`, `docs/api.zh-CN.md`, and `docs/package-usage.md`
- Focused router unit and integration tests

The work should not add new public route concepts. Existing types should stay narrow unless a type
needs a stricter description of already-supported input.

## Small Capability

The router should define stable normalization behavior for existing location inputs:

- Empty string route locations resolve to `/`.
- Relative path strings such as `users/1` resolve as `/users/1`.
- Multiple trailing slashes normalize to the canonical path except for `/`.
- Query strings preserve the existing repeated-key behavior and skip nullish object values.
- Hash history treats an empty hash as `/`, accepts hash paths with or without a leading slash, and
  preserves query strings inside the hash path.

This is a clarification of the current beta contract, not a new navigation model.

## Boundary Tests

Add test-first coverage for:

- Query parsing of bare keys, repeated keys, empty values, `+` characters, and malformed percent
  encoding.
- Query stringification of arrays containing nullish values and keys or values requiring encoding.
- Router resolution for empty strings, relative paths, trailing slashes, unknown routes, and object
  locations with path/query only.
- Web history and hash history listener cleanup.
- Hash history path normalization for blank hash, missing leading slash, and query-preserving hash
  paths.
- Repeated `router.install(app)` calls replacing the previous history listener instead of duplicating
  route updates.
- `RouterLink` click handling for ordinary left clicks, already-prevented clicks, modified clicks,
  and `replace`.
- `RouterView` continuing to render an empty fragment for unmatched routes.

Tests should assert user-visible or public-contract behavior rather than internal implementation
details.

## Deferred Scope

These remain out of scope:

- Navigation guards and route meta.
- Nested route records and nested `RouterView` depth.
- Redirects, aliases, route names, named locations, and params objects.
- Lazy route component contracts.
- Scroll behavior.
- Memory history.
- Router SSR, SSG, or hydration integration.
- Auth and permission routing.

If a test exposes a bug that requires one of these concepts, the fix should be deferred to a separate
design instead of sneaking it into this stabilization slice.

## Documentation

Documentation should say the beta router has explicit normalization behavior for supported inputs and
continues to reject deferred fields. Keep the wording concise and aligned between English and Chinese
API docs where touched.

## Validation

Minimum validation:

- `pnpm vitest run tests/unit/router`
- `pnpm vitest run tests/integration/router-component.test.ts`

Expanded validation when production router behavior or docs are changed:

- `pnpm typecheck`
- `pnpm test:e2e -- router-basic`

The full `pnpm quality` and package smoke gates are not required for this narrow slice unless package
exports or release scripts change.

## Risks

- Changing normalization can alter `fullPath` output. Tests should pin only the intended canonical
  behavior.
- Query decoding can throw on malformed percent encoding. The chosen behavior must be explicit:
  either stable pass-through or stable `TypeError`, with docs and tests aligned.
- Hash history listens to both `popstate` and `hashchange`; cleanup tests should prove listeners do
  not leak across repeated installs.
- `RouterLink` event handling must keep native browser affordances for modified clicks and already
  prevented clicks.

## Acceptance Criteria

- Router boundary tests cover the listed edge cases.
- Any production changes are limited to existing beta router modules.
- Public router API surface does not add guards, nested routes, redirects, named routes, memory
  history, auth, permission, SSR, SSG, or hydration concepts.
- Router docs describe the stabilized normalization behavior and deferred scope.
- The selected router unit and integration validation commands pass before completion is claimed.
