# Solace Roadmap

## Current Phase: Beta (in progress)

The initial runtime scope is feature-complete, and the repository is now tracking a published beta
line:

- Reactive core, scheduler, renderer, function components, events, store, JSX/TSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.
- Completed stable prerequisites: medium-app validation and the compatibility and deprecation policy.
- Router-aware SSR/hydration and production DevTools remain deferred.

## Next Phase: Beta

Work remaining, in rough priority order:

1. **JSX/TSX-first runtime ergonomics** — make function components, JSX/TSX examples, explicit
   runtime APIs, and package-boundary usage the main Solace identity. Avoid steering the framework
   toward a Vue-style SFC-first direction, and avoid presenting Solace as a React compatibility
   layer. The target is a React-influenced but independent component model with Solace-owned JSX
   types, event conventions, slot behavior, and runtime primitives.
2. **Maintain optional experimental SFC support** — keep the public SFC contract limited to
   `@italone/solace/vite` and `@italone/solace/sfc`, preserve diagnostics, source-map policy, and
   compatibility tests, and do not expand `.solace` syntax without a separate design.
3. **Router beta stabilization** — the stable slice now covers static routes, dynamic params,
   wildcard fallback routes, query strings, web/hash/memory history, nested routes, redirects, route
   names, aliases, route props, named locations, global and route-level guards, explicit
   `lazyRoute()` components, `RouterLink`, `RouterView`, `useRoute`, `useRouter`, and scroll
   behavior; keep SSR/SSG/hydration integration, auth, and permissions deferred until separately
   designed.
4. **Mandatory public API gates** — keep package export tests, packed-consumer smoke, browser e2e, and release readiness required for public API changes; these are completed stable prerequisites.
5. **SSR / hydration minimum loop** — implemented through `@italone/solace/server` and
   `createApp(App).hydrate(container)` for synchronous VNode/component trees, including
   server-side style collection and hydration-safe style dedupe; continue hardening mismatch policy,
   async boundaries, streaming, full pipeline automation, and integration tests before widening the
   contract.
6. **SSG core** — implemented on top of `renderToString()` via `generateStaticSite()`; keep
   filesystem output and route crawling deferred while preserving collected `renderToString()`
   styles, production asset tags, and explicit-path router records through the shell contract.
7. **SSR/SSG/hydration next phase** — follow
   `docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md`; harden hydration
   mismatch diagnostics, document SSG shell/style placement, and keep full router-aware SSR and
   hydration deferred until separately designed.
8. **Browser DevTools extension UI** — the first example panel is implemented under
   `examples/devtools-extension`; continue hardening extension packaging, the browser extension QA
   checklist, richer event contracts, and future inspectors without reading private runtime state.
9. **Production adoption guidance** — large-app patterns, performance tuning, migration notes. A
   first guide now exists in `docs/large-app.md` and `docs/large-app.zh-CN.md`; ecosystem and UI
   library decisions are recorded in `docs/ecosystem.md`; keep evolving both from real usage.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- React compatibility mode or React API cloning.
- SFC syntax expansion without a separate design.
- Production-grade DevTools extension distribution and advanced inspectors.
- Long-term compatibility guarantees for private internal modules.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
