# Router Beta Next Phase Design

## Goal

Stabilize the next Router beta surface by designing nested routes, redirects, navigation guards, and
lazy route components as one coherent navigation model. The implementation should widen only the
router contracts needed for those four capabilities and keep named routes, aliases, scroll behavior,
memory history, auth/permission semantics, and SSR/router integration deferred.

## Context

The current router beta intentionally supports a narrow SPA slice: static routes, dynamic params,
wildcard fallback records, query parsing and stringification, web/hash history adapters,
`RouterLink`, `RouterView`, `useRouter`, and `useRoute`.

Current runtime guards reject deferred route record fields such as `children`, `redirect`,
`beforeEnter`, `meta`, and `name`, and reject deferred router options such as `scrollBehavior`. The
next phase should remove those rejections only for `children`, `redirect`, `beforeEnter`, and
`meta`, while preserving the rejection behavior for still-deferred fields.

## Public API

Route components may be eager components or route-level lazy loaders:

```ts
export type RouteComponent =
  ComponentType | (() => Promise<{ default: ComponentType } | ComponentType>);
```

Route records should allow nested records, redirects, route guards, and metadata:

```ts
export interface RouteRecord {
  path: string;
  component?: RouteComponent;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
}
```

Normalized route locations should expose a matched record chain:

```ts
export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  redirectedFrom?: RouteLocationNormalized;
}
```

Navigation guards should support sync and async decisions:

```ts
export type NavigationGuardResult =
  void | boolean | RouteLocationRaw | Promise<void | boolean | RouteLocationRaw>;

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => NavigationGuardResult;
```

Router navigation should become asynchronous because guards and redirects can be asynchronous or
chain into asynchronous decisions:

```ts
export interface Router {
  currentRoute: Ref<RouteLocationNormalized>;
  install(app: App): void;
  push(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  replace(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
  beforeEach(guard: NavigationGuard): () => void;
}
```

## Deferred Public Surface

The following fields and APIs remain outside the beta contract:

- route `name`
- route `alias`
- route `props`
- router `scrollBehavior`
- `createMemoryHistory`
- auth and permission-specific route types
- SSR, SSG, or hydration router integration

Passing these deferred fields should continue throwing `TypeError` so users do not accidentally rely
on unsupported behavior.

## Route Normalization

Router creation should normalize user route records into internal records before compiling matchers.
Normalization should preserve the original public record for `route.matched` while producing internal
fields for full path, parent chain, render depth, and redirect/guard lookup.

Nested path rules:

- A child `path` without a leading slash is joined to the parent path.
- A child `path` with a leading slash is treated as an absolute path while retaining the parent chain.
- A child `path: ""` is an index route for the parent path.
- A parent record without a `component` participates in matching, redirects, guards, and metadata,
  but does not consume a `RouterView` render depth.

Example:

```ts
createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/dashboard",
      component: DashboardLayout,
      children: [
        { path: "", component: DashboardHome },
        { path: "settings", component: Settings },
      ],
    },
  ],
});
```

The matcher should resolve `/dashboard/settings` with a matched chain containing the dashboard
layout record and the settings child record.

## Matcher Behavior

`matcher.resolve(path)` should return:

```ts
{
  path: "/dashboard/settings",
  params: {},
  matched: [dashboardRecord, settingsRecord],
}
```

No match should return `matched: []`, preserving the current behavior where `RouterView` renders an
empty Fragment.

Route ranking should continue preferring static routes over dynamic routes and dynamic routes over
the wildcard fallback. Nested flattening must not regress existing ordering guarantees.

Params should be merged from parent to child. If a child uses the same param name as a parent, the
child value should overwrite the parent value because it is the most specific match.

## RouterView Depth

`RouterView` should render the component for its current depth in the matched chain. Depth should be
tracked through provide/inject so nested layouts can render child route content:

```tsx
const DashboardLayout = () => () => (
  <section>
    <h1>Dashboard</h1>
    <RouterView />
  </section>
);
```

Records without a component should not consume depth. This keeps layout-less grouping routes useful
without requiring placeholder components.

When the matched chain has no component at the requested depth, `RouterView` should render an empty
Fragment.

## Navigation Pipeline

`router.push()` and `router.replace()` should call a shared `navigate()` pipeline:

```text
normalize raw location
resolve target
apply redirects
run global beforeEach guards
run matched beforeEnter guards from parent to child
commit history push/replace
update currentRoute
return final route
```

`router.resolve()` should stay synchronous and should not run redirects or guards. It only converts a
raw location into the route object for that raw target.

`RouterLink` should keep rendering an anchor with a synchronous href from `router.resolve(to)`, then
call async `router.push()` or `router.replace()` for primary unmodified clicks. Rejected navigation
promises should not be swallowed by the router internals; tests can await direct router calls for
failure paths.

## Redirects

Redirects run before guards. A redirect may be:

- string location
- object location
- function receiving the resolved `to`

Redirects should be repeatedly resolved until a non-redirect route is reached. To prevent loops,
navigation should fail after 16 redirects.

The final route should include `redirectedFrom` when a redirect changed the target. The original
route should be preserved as the first redirected-from location for the user-visible navigation.

## Guards

Guard order:

```text
global beforeEach guards in registration order
route beforeEnter guards from parent to child
```

Guard return behavior:

- `undefined` or `true`: allow navigation to continue.
- `false`: cancel navigation. Do not write history. Do not update `currentRoute`. Resolve the
  navigation promise with the current `from` route.
- `string` or location object: redirect to that location through the same navigation pipeline.
- thrown error or rejected promise: fail navigation. Do not write history. Do not update
  `currentRoute`.

`beforeEach()` should return an unsubscribe function. Removing a guard should preserve the order of
remaining guards.

Route `meta` is only data available through matched records and guard inputs. It does not define an
auth or permission system.

## Lazy Route Components

Lazy route components are resolved after navigation has been confirmed. They should not participate
in matching, redirects, or guard decisions.

Rendering behavior:

- Eager components render directly.
- Lazy loader success is cached on the internal record and renders the resolved component on the next
  tick/update.
- While loading, `RouterView` renders an empty Fragment.
- Loader failure should surface a router navigation/rendering error rather than silently rendering
  nothing forever.

This design does not introduce Suspense, route-level loading components, retry policy, prefetching,
or concurrent navigation cancellation.

## Navigation Errors

The beta should use a compact error shape:

```ts
export class RouterNavigationError extends Error {
  type: "redirect-loop" | "guard-rejected" | "lazy-load-failed";
  from: RouteLocationNormalized;
  to: RouteLocationNormalized;
}
```

Guard cancellation through `false` is not an error; it resolves with the current route. Guard
throw/reject should reject with `RouterNavigationError` type `"guard-rejected"`. Redirect loops
should reject with `"redirect-loop"`. Lazy loader rejection should throw or reject with
`"lazy-load-failed"` when the renderer reaches that route component.

## Testing Strategy

Unit matcher tests:

- nested child path joining
- index route `path: ""`
- absolute child path with retained parent chain
- parent and child param merging
- static, dynamic, and wildcard ranking after nested flattening

Unit router tests:

- `push()` and `replace()` return promises
- string, object, and function redirects
- redirect loop limit
- global `beforeEach()` registration and unsubscribe
- route `beforeEnter` arrays
- guard cancel does not write history or change current route
- guard redirect re-enters the navigation pipeline
- guard throw/reject keeps current route unchanged
- still-deferred fields remain rejected

Integration component tests:

- nested `RouterView` renders parent layout and child component
- index child renders under parent layout
- layout-less parent does not consume render depth
- `RouterLink` async navigation updates DOM
- lazy route component renders after resolution
- lazy route component renders empty Fragment while loading

E2E tests:

- extend `examples/router-basic` to cover nested navigation, redirect navigation, guarded
  navigation, and lazy route navigation
- cover direct URL load and client navigation for at least one nested route

Package-boundary tests:

- root package exports new navigation guard and route types
- packed consumer smoke imports the router APIs and awaits `router.push()`
- deferred fields still fail at runtime where they remain outside the beta contract

## Documentation

Update:

- `docs/api.md`
- `docs/api.zh-CN.md`
- `docs/package-usage.md`
- `docs/examples.md`
- `docs/roadmap.md`
- `docs/project-status.md`
- `readme.md`
- `readme.zh-CN.md`

Documentation should state that this is still beta router functionality and should list the remaining
deferred items explicitly.

## Rollout Plan

Implementation should be staged:

1. Add route normalization and nested matcher chain support.
2. Update `RouterView` depth rendering.
3. Add redirects through the shared navigation pipeline.
4. Add global and route-level guards.
5. Add lazy route component rendering and cache behavior.
6. Update examples, package smoke, docs, and release status.

Each stage should keep `pnpm vitest run tests/unit/router tests/integration/router-component.test.ts`
passing before moving to the next stage. Final validation should run `pnpm quality`,
`pnpm test:e2e`, `pnpm package:smoke`, and the router-specific tests.

## Risks

- Making navigation async changes the router method contract. Existing tests and examples must await
  programmatic navigation where they inspect post-navigation state.
- Redirects and guards can create loops. The redirect limit and guard redirect pipeline must be
  tested together.
- Nested route flattening can regress static/dynamic/wildcard ranking. Matcher tests should preserve
  the current ranking guarantees.
- Lazy route rendering can accidentally become a second async-component system. Keep it route-local
  and avoid loading, retry, prefetch, or Suspense contracts in this phase.
