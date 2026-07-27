# Solace Roadmap

## Current Phase: Alpha (completed)

The alpha runtime is feature-complete for its declared scope:

- Reactive core, scheduler, renderer, components, events, store, JSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.

## Next Phase: Beta

Planned work, in rough priority order:

1. **SFC compiler stabilization** — keep the public contract limited to `@italone/solace/vite` and `@italone/solace/sfc`, then harden diagnostics, source-map policy, compatibility tests, and documented syntax before promoting the compiler beyond alpha.
2. **Router beta stabilization** — keep the beta slice limited to static routes, dynamic params, wildcard fallback routes, query strings, web/hash history, `RouterLink`, `RouterView`, `useRoute`, and `useRouter`; defer nested routes, guards, redirects, lazy route components, scroll behavior, memory history, SSR/SSG/hydration integration, auth, and permissions.
3. **Mandatory public API gates** — keep package export tests, packed-consumer smoke, browser e2e, and release readiness required for public API changes.
4. **SSR / hydration minimum loop** — implemented through `@italone/solace/server` and
   `createApp(App).hydrate(container)` for synchronous VNode/component trees; continue hardening
   styles, mismatch policy, async boundaries, and integration tests before widening the contract.
5. **SSG** — build static generation on top of `renderToString()` after the SSR/hydration minimum
   loop is stable.
6. **Browser DevTools extension UI** — build a panel on top of the existing
   `@italone/solace/devtools` API after SSR/SSG/hydration planning is underway.
7. **Production adoption guidance** — large-app patterns, performance tuning, migration notes.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- Long-term compatibility policy for internal modules.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
