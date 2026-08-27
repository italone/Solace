# readstack — Solace-Primary Adoption Application Design

Date: 2026-08-27
Status: approved design, pending implementation plan

## Purpose

`readstack` is a new, independent read-it-later/bookmark application that uses
`@italone/solace@beta` from npm as its primary renderer. It exists to (1) be a genuinely useful
small tool and (2) exercise all five production workflows required by the Solace 1.0 adoption
evidence checklist — `router`, `store`, `asyncComponents`, `errorRecovery`, `ssrHydration` — as
real application behavior, not as a checklist demo.

This design lives in the Solace repository because it describes a cross-repository project, but
the application itself is a separate repository and must never depend on Solace internals or
deep subpaths.

## Repository and Toolchain

- Location: `/Users/alone/Desktop/TEST/readstack` — its own git repository.
- Package manager: pnpm. Node 20+.
- Build: Vite + TypeScript + TSX with `jsxImportSource: "@italone/solace"` (Solace public
  contract entries only: package root, `@italone/solace/jsx-runtime`, `@italone/solace/server`).
- Server: plain `node:http` server, no web framework.
- Solace is installed from npm (`@italone/solace@beta`, exact version pinned in the lockfile).

## Architecture

Two Vite entries share one application source tree:

- `src/client.tsx` — client entry. Waits for router readiness and calls
  `hydrateAsync(container, { router, routerIdentifyRecord })`, which verifies the embedded
  route snapshot (`script#__solace-router-snapshot`) before hydrating.
- `src/server.ts` — SSR entry. Calls
  `renderToStringAsync(source, { router: { url, routes, identifyRecord }, manifest, clientEntry })`
  so the server settles a request-scoped memory router, injects its provides, appends the route
  snapshot, and injects production asset tags from the Vite build manifest.
- `src/app/**` — shared components, routes, and store.

In production the server serves built static assets and renders HTML per request. In development
the app runs against Vite dev-server middleware output (or a simple rebuild step; the
implementation plan fixes the exact dev workflow).

### Data

- Source of truth: `localStorage` on the client (bookmarks: url, title, tag(s), read flag,
  added timestamp).
- SSR renders the shell and shared seed content; after hydration the client store takes over.
  No server-side persistence.

## Routes and Features

- `/` — bookmark list with unread/read filter and tag filter.
- `/item/:id` — detail view, loaded through a `defineAsyncComponent` view; loader failure keeps
  the fallback with a retry control (does not crash the stream or the page).
- `/tags/:tag` — aggregated view for one tag.
- Routing uses `createWebHistory`, `RouterLink`, `RouterView`; navigation state (active filters)
  is reflected in routes.
- Store: `createStore` with reactive bookmark state, computed getters (filtered lists, tag
  counts), and named actions (add, remove, mark read/unread, retag).

## Error Handling

- Async loader failure: `defineAsyncComponent({ loader, fallback })` keeps the fallback;
  the UI offers retry. No unhandled rejection.
- Hydration mismatch: catch `SolaceHydrationError` and re-render client-side with
  `recover: true` semantics.
- Router snapshot verification failure: fall back to client-side navigation from the current
  URL instead of failing the page.
- Server errors: non-throwing 500 page rendered through the same SSR path.

## Testing

- Vitest unit tests: store actions and getters, filter logic, route parameter handling.
- Playwright e2e: add bookmark → filter by tag → open detail (async view) → mark read →
  verify persistence across reload and that post-hydration interactions work.
- Node SSR smoke: server response contains first-paint content, asset tags, and the router
  snapshot script.

## Explicitly Out of Scope

Authentication, multi-user support, server-side database, import/export, theming, PWA/offline,
streaming SSR (`renderToStream`), and DevTools integration. Any of these may be added later;
none are needed for adoption workflow coverage.

## Adoption Evidence Positioning

readstack satisfies the application-side prerequisites (Solace-primary renderer, all five
workflows, exact npm version). Recording it as formal 1.0 adoption evidence additionally
requires an HTTPS repository remote and an exact HTTPS production origin, a
baseline→candidate→rollback rehearsal, and reviewer approval, per the runbook in
`release/adoption-evidence.md`. Until those exist, readstack is an application, not evidence.
