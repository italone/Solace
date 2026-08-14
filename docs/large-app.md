# Large App Guide

This guide collects the current patterns Solace supports for larger applications. It is not a new
runtime contract. It explains how to compose the existing public APIs so teams can keep apps
readable as they grow.

## Fit

Solace fits larger apps best when the app keeps a clear split between:

- a small app shell
- feature modules owned by routes
- local state for local UI
- shared store state for cross-route state
- explicit release gates and benchmark checks

## Structure

Prefer a shallow shell with feature folders underneath:

```text
src/
  app/
    App.tsx
    router.ts
    store.ts
  features/
    dashboard/
      DashboardPage.tsx
      dashboard.store.ts
      dashboard.routes.ts
    users/
      UsersPage.tsx
      user.routes.ts
      user.api.ts
  shared/
    components/
    composables/
    styles/
```

Keep the shell responsible for app wiring only:

- `createApp()`
- router installation
- store installation
- app-level `provide()`
- top-level layout

Keep feature modules responsible for view state, route records, and feature-local logic.

## First Slice

Start with one route slice and keep the first pass small:

- put the route record next to the feature page
- keep the feature store local until another route needs the same data
- move only truly shared building blocks into `shared/`
- keep shell-level setup limited to routing, store registration, and top-level layout

This keeps the first migration readable and makes it easier to split more features later.

## Route Slice Example

A feature route file can export only records:

```ts
import type { RouteRecord } from "@italone/solace";
import { lazyRoute } from "@italone/solace";

export const userRoutes: RouteRecord[] = [
  {
    path: "/users",
    name: "users",
    component: lazyRoute(() => import("./UsersPage")),
    meta: { title: "Users" },
  },
];
```

The app router can compose feature routes in one place:

```ts
import { createRouter, createWebHistory } from "@italone/solace";

import { HomePage } from "./HomePage";
import { userRoutes } from "../features/users/user.routes";

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "home", component: HomePage }, ...userRoutes],
});
```

If the app needs auth or permissions, keep enforcement in the backend or in an app-owned guard
layer. Do not add `auth` or `permissions` fields to router options or route records.

## Routing

For larger apps, route modules should stay close to the feature they load.

- Use route names, aliases, props, and nested routes to keep URLs explicit.
- Keep auth and permission enforcement in the backend or an app-specific guard layer.
- Treat route `meta` as application-owned metadata, not a security boundary.
- Keep router setup in one place so redirects and guards stay easy to audit.

If the route tree becomes difficult to scan, split route records by feature and compose them in the
router bootstrap file.

## State

Use the smallest state surface that solves the problem:

- local reactive state for local UI
- store state for data that multiple routes or panels share
- `provide()` / `inject()` for dependency-style sharing
- computed values for derived state

Avoid putting every API response in one store. Keep ownership near the feature that uses it.

## State Ownership Cheat Sheet

Use this simple rule when the app grows:

- local reactive state: form drafts, modal toggles, tab selection, temporary UI state
- store state: data that two or more routes need to read or update
- `provide()` / `inject()`: app-wide services such as analytics, feature flags, or a shared client
- computed values: derived totals, filtered lists, and display-only projections

If a piece of state can move with the feature folder, keep it there. If it cannot, promote it only
as far as the sharing need requires.

## SSR And Hydration

Keep server and client entry points explicit.

- Use `renderToString()` for synchronous server trees.
- Use `generateStaticSite()` for in-memory SSG.
- Keep manifest and router integration outside the renderer until a separate contract adds it.
- Use `createApp(App).hydrate(container)` only for matching server HTML.
- Keep hydration recovery explicit with `{ recover: true }`.

For large apps, prefer one clear server shell over deeply nested implicit rendering rules.

## Performance

Use the benchmark commands as trend tools, not as absolute promises.

- `pnpm benchmark`
- `pnpm benchmark:browser`
- `pnpm benchmark:history`

For browser history review, keep enough samples to make the trend meaningful before comparing
releases. If a change affects route transitions or keyed list updates, inspect the relevant scenario
before making a performance claim. Keep `.benchmark-history/` as ignored local JSONL history and
share summarized results instead of committing raw samples.

## Adoption Checklist

Before using Solace in a larger app, confirm the project can live within the current beta boundary:

- read `docs/project-status.md` and keep deferred router, SSR/hydration, DevTools, UI library, and
  plugin ecosystem gaps visible in planning
- build one route slice using only documented package-root APIs before migrating more features
- keep auth and permission enforcement outside route records
- choose one benchmark scenario that represents the app's most important interaction
- run package smoke and browser e2e checks before publishing or recommending the integration to
  another team

Validate the installed artifact rather than a repository source alias:

```bash
pnpm adoption:smoke
pnpm adoption:smoke:browsers
pnpm adoption:smoke -- --package <exact-version>
```

The local fixture proves package-only CSR bundling plus SSR/hydration recovery. It does not count as
an independent production adoption. Record real application ownership, exact package version,
upgrade result, bundle result, error recovery, and browser matrix separately for 1.0 evidence.

## Ecosystem And UI Libraries

Solace does not currently ship a first-party UI component library or stable plugin ecosystem. For a
larger app, keep those decisions at the application layer and use
[docs/ecosystem.md](./ecosystem.md) as the beta-line decision record:

- wrap third-party UI components behind app-owned components before exposing them across features
- keep design tokens, form patterns, table patterns, and accessibility decisions outside the Solace
  runtime contract
- avoid package-level adapters until a real app proves the integration shape
- treat DevTools extension panels as diagnostics, not as an ecosystem plugin API

This keeps the framework runtime small while the beta line continues to harden public package
boundaries.

## Release Discipline

Before public API changes, keep these gates aligned:

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`
- `pnpm test:e2e:devtools-extension`

Update README, project status, API, package usage, consumer smoke, and the guide together when a
public boundary changes.

## Migration Notes

When moving a larger codebase onto Solace:

1. Start with one shell and one route slice.
2. Keep local state local until a shared need is proven.
3. Add store modules only when multiple feature areas need the same data.
4. Keep one benchmark scenario around the interaction you care about most.
5. Keep the router contract explicit and small.
