# Solace Roadmap

## Current Phase: Alpha (completed)

The alpha runtime is feature-complete for its declared scope:

- Reactive core, scheduler, renderer, components, events, store, JSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.

## Next Phase: Beta

Work remaining, in rough priority order:

1. **SFC compiler stabilization** — keep the public contract limited to `@italone/solace/vite` and `@italone/solace/sfc`, then harden diagnostics, source-map policy, compatibility tests, and documented syntax before promoting the compiler beyond alpha.
2. **Router beta stabilization** — keep the beta slice limited to static routes, dynamic params, wildcard fallback routes, query strings, web/hash history, nested routes, redirects, global and route-level guards, explicit `lazyRoute()` components, `RouterLink`, `RouterView`, `useRoute`, and `useRouter`; defer route names, aliases, route props, scroll behavior, memory history, SSR/SSG/hydration integration, auth, and permissions.
3. **Mandatory public API gates** — keep package export tests, packed-consumer smoke, browser e2e, and release readiness required for public API changes.
4. **SSR / hydration minimum loop** — implemented through `@italone/solace/server` and
   `createApp(App).hydrate(container)` for synchronous VNode/component trees, including
   server-side style collection and hydration-safe style dedupe; continue hardening mismatch policy,
   async boundaries, streaming, full pipeline automation, and integration tests before widening the
   contract.
5. **SSG core** — implemented on top of `renderToString()` via `generateStaticSite()`; keep
   filesystem output and route crawling deferred while preserving collected `renderToString()`
   styles, production asset tags, and explicit-path router records through the shell contract.
6. **SSR/SSG/hydration next phase** — follow
   `docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md`; harden hydration
   mismatch diagnostics, document SSG shell/style placement, and keep full router-aware SSR and
   hydration deferred until separately designed.
7. **Browser DevTools extension UI** — the first example panel is implemented under
   `examples/devtools-extension`; continue hardening extension packaging, browser-extension manual
   QA, richer event contracts, and future inspectors without reading private runtime state.
8. **Production adoption guidance** — large-app patterns, performance tuning, migration notes.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- Production-grade DevTools extension distribution and advanced inspectors.
- Long-term compatibility policy for internal modules.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
