# Minimal Router Design

## Goal

Add a first-party, minimal SPA router to Solace for beta usage. The router should be small enough to
fit the current runtime architecture, but complete enough to support real examples with direct URL
loads, browser back/forward navigation, dynamic params, query strings, and declarative links.

## Context

Solace already exposes a compact public runtime through the package root. Extensions are expected to
use `app.use()` and app-level `provide`, while components consume shared services with `inject()`.
The router should follow that pattern instead of introducing a separate application lifecycle.

The current beta roadmap lists first-party router work immediately after SFC compiler stabilization.
This design intentionally targets the first router slice only. It does not try to become a full Vue
Router equivalent in one pass.

## Public API

The first public router API should be exported from `@italone/solace`:

```ts
import {
  RouterLink,
  RouterView,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  useRoute,
  useRouter,
} from "@italone/solace";
```

Router creation:

```ts
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: UserDetail },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

Components:

```tsx
const App = () => () => (
  <main>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to={{ path: "/users/42", query: { tab: "profile" } }}>User</RouterLink>
    </nav>
    <RouterView />
  </main>
);
```

Composition helpers:

```ts
const router = useRouter();
const route = useRoute();

router.push("/users/42?tab=profile");
route.value.params.id;
```

## Route Types

Initial route records should use a single component per route:

```ts
interface RouteRecord {
  path: string;
  component: ComponentType;
}
```

The normalized route object should expose stable values for rendering and user code:

```ts
interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  matched: RouteRecord | null;
}
```

Programmatic navigation should accept strings and path objects:

```ts
type RouteLocationRaw =
  | string
  | {
      path: string;
      query?: Record<string, string | number | boolean | null | undefined>;
    };
```

## Architecture

Create a new `src/router/` module with focused files:

- `matcher.ts`: compile route records into path matchers and extract params.
- `query.ts`: parse and stringify query strings without external dependencies.
- `history.ts`: implement web history and hash history adapters.
- `router.ts`: own reactive current-route state and navigation methods.
- `components.ts`: define `RouterView` and `RouterLink`.
- `index.ts`: public exports for the root package.

The router should hold `currentRoute` as a `ref<RouteLocationNormalized>`. `RouterView` reads the
current route and renders the matched component with route params/query available through `useRoute()`.
`RouterLink` renders an anchor VNode, prevents normal navigation for same-origin left clicks, and
calls `router.push()`.

The router object should also be a Solace plugin. `install(app)` provides the router instance and
current route, initializes the current location, and starts listening to history changes.

## History Behavior

`createWebHistory()` uses `window.location.pathname`, `window.location.search`, `history.pushState`,
`history.replaceState`, and the `popstate` event.

`createWebHashHistory()` uses the path after `window.location.hash`. A blank hash should normalize to
`/`. It should still use `pushState`/`replaceState` when available so navigation remains consistent
with back/forward behavior.

Both adapters should expose:

```ts
interface RouterHistory {
  location(): string;
  push(path: string): void;
  replace(path: string): void;
  listen(listener: () => void): () => void;
  back(): void;
  forward(): void;
}
```

## Matching Rules

The first matcher supports:

- Static paths: `/`, `/about`, `/users`.
- Dynamic params: `/users/:id`, `/teams/:teamId/users/:userId`.
- Not-found wildcard: `/:pathMatch(.*)*`.
- Trailing slash normalization by treating `/users` and `/users/` as the same route.

The first matcher does not support nested routes, optional params, custom regex params other than the
not-found wildcard, route aliases, or redirects.

Route ranking should prefer more specific records over dynamic records, and dynamic records over the
wildcard. This avoids declaration-order surprises for common routes.

## Query Rules

Query parsing should produce strings or string arrays:

- `?tab=profile` becomes `{ tab: "profile" }`.
- `?tag=a&tag=b` becomes `{ tag: ["a", "b"] }`.
- Empty values become empty strings.

Query stringification should skip `null` and `undefined`, encode keys and values with
`encodeURIComponent`, and preserve repeated keys for arrays.

## Deferred Scope

These features stay out of the first router slice:

- Nested routes and nested `RouterView` depth.
- Redirects and aliases.
- Navigation guards and route meta.
- Lazy route components.
- Scroll behavior.
- SSR, SSG, hydration, and memory history.
- Auth and permission routing.

Keeping these out preserves a small beta contract and avoids locking complex behavior before the base
router model is proven.

## Testing Strategy

Unit tests:

- Matcher static, dynamic, wildcard, ranking, and trailing slash behavior.
- Query parse/stringify including repeated keys and skipped nullish values.
- Web/hash history adapter behavior with jsdom location and `popstate`.
- Router navigation methods updating `currentRoute`.

Integration tests:

- Mount an app with `RouterView` and verify route component rendering.
- Click `RouterLink` and verify URL and rendered component update.
- Verify `useRoute()` exposes params and query values.
- Verify browser back/forward updates `RouterView`.

Package tests:

- Root package exports router APIs in ESM and CJS.
- Packed-consumer smoke imports `createRouter`, histories, `RouterView`, `RouterLink`, `useRouter`,
  and `useRoute`.

Example coverage:

- Add `examples/router-basic` with a small Home/User/NotFound app.
- Add Playwright e2e only after the jsdom integration tests are stable.

## Documentation

Document the router as beta API in:

- `docs/api.md`
- `docs/api.zh-CN.md`
- `docs/package-usage.md`
- `docs/examples.md`
- `readme.md`
- `readme.zh-CN.md`
- `docs/roadmap.md`
- `docs/project-status.md`

Docs should state the included scope and the deferred scope clearly so users do not assume guard,
nested route, SSR, or lazy route support.

## Risks

- Browser history behavior can be fragile in jsdom. Keep history adapters small and test adapter
  boundaries directly.
- A too-large router API would become difficult to revise during beta. Keep the first public surface
  narrow.
- Direct URL loads with `createWebHistory()` require server fallback in real deployments. Document
  that hash history works without server rewrite support.
- Frontend routing is not an auth boundary. Auth and permission behavior are deferred and should be
  designed separately.

## Acceptance Criteria

- Router public APIs are available from `@italone/solace`.
- Static, dynamic, wildcard, query, and trailing slash matching work.
- `RouterView`, `RouterLink`, `useRouter`, and `useRoute` work in mounted apps.
- Browser back/forward updates reactive route state.
- Package exports and packed-consumer smoke cover the router APIs.
- Documentation describes the beta router scope and deferred features.
- `pnpm quality`, relevant router tests, package smoke, and e2e checks pass before release claims.
