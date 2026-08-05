# Router Stable Contract Design

## Goal

Stabilize the next Router beta contract for route names, route aliases, route props, and first-party
memory history. This should widen only those four public surfaces and keep scroll behavior,
auth/permission semantics, and SSR/SSG/hydration router integration deferred.

## Context

The current router beta already supports path matching, dynamic params, query parsing, web/hash
history adapters, nested route records, redirects, global `beforeEach` guards, route-level
`beforeEnter` guards, route `meta`, `lazyRoute()` route components, `RouterLink`, and `RouterView`.

The remaining user-facing gap is that route records still reject `name`, `alias`, and `props`, object
locations still reject named navigation and params, and the package does not export a first-party
memory history adapter. These are practical Router building blocks with clear contracts and bounded
implementation scope. They should be stabilized before larger features such as scroll restoration,
auth/permission policy, or router-aware SSR integration.

## Public API

Route records should allow names, aliases, and route props:

```ts
export type RouteRecordName = string;

export type RouteProps =
  | boolean
  | Record<string, unknown>
  | ((route: RouteLocationNormalized) => Record<string, unknown>);

export interface RouteRecord {
  path: string;
  name?: RouteRecordName;
  component?: RouteComponent | null;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
  alias?: string | string[];
  props?: RouteProps;
}
```

Raw locations should support either path locations or named locations:

```ts
export type RouteParamInputValue = string | number;
export type RouteParamsInput = Record<string, RouteParamInputValue>;

export type RouteLocationRaw =
  | string
  | { path: string; query?: QueryInput }
  | { name: RouteRecordName; params?: RouteParamsInput; query?: QueryInput };
```

Normalized locations should expose the canonical name when the matched record has one:

```ts
export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  name?: RouteRecordName;
  redirectedFrom?: RouteLocationNormalized;
}
```

The public router module and package root should export a memory history adapter:

```ts
export function createMemoryHistory(initial?: string | string[]): RouterHistory;
```

## Deferred Public Surface

The following fields and APIs remain outside this beta contract:

- router `scrollBehavior`
- auth-specific route types or guard helpers
- permission-specific route types or guard helpers
- `createSSRRouter`
- SSR, SSG, or hydration router integration

Passing still-deferred router options should continue throwing `TypeError` so users do not
accidentally rely on unsupported behavior.

## Route Names

Route names are developer-authored string identifiers for canonical route records.

Creation-time validation:

- `name`, when present, must be a non-empty string.
- Names must be globally unique across the full route tree.
- Duplicate names throw `TypeError` during `createRouter()`.
- A layout-less record with `component: null` may have a name if its own path is navigable through
  redirect, children, or an empty child route. The name still resolves to the record's canonical
  full path.

Named location resolution:

- `{ name }` resolves against the canonical record path, never an alias path.
- Required params are inferred from the canonical full path's `:param` segments.
- Missing required params throw `TypeError`.
- Extra params throw `TypeError`.
- Param values must be strings or numbers and are encoded with `encodeURIComponent()`.
- Resolved `params` in `RouteLocationNormalized` remain decoded strings.
- Query handling uses the existing `QueryInput` validation and stringification contract.

Unknown names:

- `router.resolve({ name: "missing" })`, `router.push()`, `router.replace()`, redirects, and guard
  returns using an unknown name throw `TypeError`.

## Aliases

Aliases are alternate URL paths for a canonical route record.

Route record validation:

- `alias` may be a string or an array of strings.
- Each alias must follow the same route path syntax as `path`.
- Empty alias arrays are allowed and behave like no alias.
- Alias entries must be unique within the compiled matcher. A duplicate alias/path collision should
  throw `TypeError` during `createRouter()` because ambiguous stable matching is not a useful
  contract.

Matching behavior:

- Alias records are internal matcher entries only; they do not create new public `RouteRecord`
  objects.
- A URL that matches an alias returns the canonical `matched` record chain.
- `route.path` and `route.fullPath` preserve the actual alias URL that was matched.
- `route.name` is the canonical matched record name when present.
- `route.params` are decoded from the actual alias URL.
- Redirects and guards observe the alias URL in `to.path` and `to.fullPath`, while `to.matched` and
  `to.name` point to the canonical route.

Named navigation:

- `{ name: "user", params: { id: 1 } }` always generates the canonical path.
- There is no public option to prefer an alias for generated hrefs in this phase.

Nested aliases:

- Relative aliases are joined against the parent canonical full path.
- Absolute aliases begin at the root but still use the canonical parent chain for `matched`.
- Child aliases do not automatically create aliases for parent paths. Each public alternate URL must
  be explicit.

## Route Props

Route props map the current normalized route into props for the component rendered by `RouterView`.

Supported forms:

- `props: true` passes `route.params`.
- `props: { ... }` passes that object.
- `props: (route) => ({ ... })` calls the function with the current normalized route and passes its
  return value.

Runtime behavior:

- Props apply only to the renderable record selected for the current `RouterView` depth.
- Records without a component do not consume render depth and do not receive props.
- Function props are evaluated during `RouterView` render so they observe the latest route.
- Function props must return a non-null plain object. Invalid returns throw `TypeError`.
- Object props must be a non-null plain object during route record validation.
- `props: true` passes a shallow copy of `route.params` so component code cannot mutate the route's
  internal params object.

This phase does not add typed route params inference or component prop inference. The public
contract is runtime behavior plus broad TypeScript shapes.

## Memory History

`createMemoryHistory()` should be a first-party `RouterHistory` implementation for tests,
non-DOM examples, and controlled runtimes.

Initialization:

- No argument creates a stack with the single location `/`.
- A string argument creates a stack with that single normalized location.
- A string array creates a stack from those normalized locations and sets the current index to the
  last entry.
- An empty array behaves like no argument.
- Initial entries use the same target validation as web history targets: relative only, no hash
  fragments, normalized leading slash, and trimmed trailing slash except for `/`.

Stack behavior:

- `location()` returns the current location.
- `push(path)` appends a normalized location after the current index and drops forward entries.
- `replace(path)` replaces the current stack entry.
- `back()` moves one entry backward when possible.
- `forward()` moves one entry forward when possible.
- Boundary `back()` and `forward()` calls are no-ops.
- Every successful location change notifies current listeners once.
- No-op boundary navigation does not notify listeners.
- `listen(listener)` registers a listener and returns an unsubscribe function.

Href behavior:

- The adapter should participate in the existing internal history href formatter contract so
  `RouterLink` hrefs are plain normalized paths.
- The formatter remains internal; `RouterHistory` does not gain a public `href()` method.

Scope boundary:

- Memory history is not SSR integration. It is a general non-DOM history adapter.
- This phase does not add streaming SSR, async SSR, router-aware hydration, static route manifest
  discovery, or pipeline automation.

## Validation And Error Handling

Use `TypeError` for invalid public configuration and invalid raw locations, matching the existing
router contract.

Creation-time errors should cover:

- invalid route names
- duplicate route names
- invalid alias shapes
- alias/path collisions
- invalid route props objects
- still-deferred router options

Resolution-time errors should cover:

- unknown named locations
- missing required params
- extra params
- invalid param values
- invalid route props function returns when `RouterView` renders

Redirect and guard behavior should keep the current `RouterNavigationError` boundaries:

- A redirect or guard returning an invalid named location should surface through the existing
  redirect/guard rejection path.
- Redirect loops remain capped by the existing redirect limit.

## Testing

Type-level tests should change the previous deferred checks for route `name`, route `alias`, route
`props`, named locations, and `createMemoryHistory` into accepted public API checks. They should keep
`scrollBehavior`, hash locations, auth/permission helpers, and SSR router integration rejected.

Router unit tests should cover:

- route name creation and duplicate-name rejection
- named `resolve()`, `push()`, `replace()`, redirects, guards, and `RouterLink` hrefs
- required param interpolation, encoding, missing params, and extra params
- alias matching for static, dynamic, nested, relative, and absolute alias paths
- canonical `matched` and `name` with alias `path/fullPath` preservation
- route props boolean, object, function, nested `RouterView` depth, and invalid returns
- memory history initialization, push, replace, back, forward, listener cleanup, and no-op boundaries
- package root and router subpath exports

Integration tests should prove:

- `RouterLink` can navigate with named locations.
- `RouterView` passes route props to rendered components.
- Memory history works with `createRouter()` without DOM globals.

## Documentation

Update the English and Chinese API/package usage docs to describe the newly stable Router surface.
Move route names, aliases, route props, and memory history out of the deferred Router list. Keep
scroll behavior, auth, permissions, and SSR/SSG/hydration router integration clearly documented as
deferred.

Update project status docs so the project remains `0.1.x` beta with compatibility guarantees only
for documented public entries. The router section should say this phase stabilizes a larger SPA
contract, but does not turn Router into a full production router with scroll policy, auth policy,
permissions policy, or SSR integration.

## Acceptance Criteria

- Public types accept route names, aliases, route props, named locations, params, and
  `createMemoryHistory`.
- Runtime validation rejects invalid names, duplicate names, invalid aliases, invalid props, invalid
  named locations, and invalid params with deterministic `TypeError`s.
- Alias matches preserve the actual URL while exposing canonical matched records and route name.
- `RouterView` passes route props for the active render depth.
- `RouterLink` href generation supports named locations.
- Memory history behaves deterministically without DOM globals.
- Package export tests include `createMemoryHistory` and still exclude SSR/auth/permission-specific
  APIs.
- Documentation reflects the widened Router contract and the remaining deferred areas.
