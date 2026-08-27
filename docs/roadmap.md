# Solace Roadmap

## Current Phase: Beta (in progress)

The initial runtime scope is feature-complete, and the repository is now tracking a published beta
line:

- Reactive core, scheduler, renderer, function components, events, store, JSX/TSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.
- Completed stable prerequisites: medium-app validation and the compatibility and deprecation policy.
- Composable router-aware SSR/hydration primitives are implemented, and the async renderer entries
  now accept a renderer-owned `router` option; router-aware SSG, sync-entry router options, and
  production DevTools remain deferred.

## Next Phase: Beta

Work remaining, in rough priority order:

The selected router-aware SSR/hydration bottleneck now has a composable first slice. Its design is recorded in
[`2026-08-14-router-aware-ssr-hydration-design.md`](./superpowers/specs/2026-08-14-router-aware-ssr-hydration-design.md).
This priority does not open auth, permissions, streaming, Suspense, route crawling, or filesystem
output; each requires a separate public API and compatibility review.

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
   behavior plus `isReady()`, canonical snapshots, request-scoped server contexts, and the
   renderer-owned `router` option on the async renderer entries; keep router-aware SSG,
   synchronous-entry router options, auth, and permissions deferred until separately designed.
4. **Mandatory public API gates** — keep package export tests, packed-consumer smoke, browser e2e, and release readiness required for public API changes; these are completed stable prerequisites.
5. **SSR / hydration minimum loop** — implemented through `@italone/solace/server` and
   `createApp(App).hydrate(container)` for synchronous VNode/component trees, including
   server-side style collection and hydration-safe style dedupe; the sequential streaming slice is
   implemented as `renderToStream()`, and the out-of-order slice is implemented as
   `renderToStream(source, { mode: "out-of-order" })` with `defineAsyncComponent({ loader, fallback })`
   fallbacks, `<!--so:b:N-->` boundary markers, resolution-order inline replacement scripts, and
   non-rejecting failure semantics; runtime production asset injection is implemented through the
   `manifest` plus `clientEntry` option pair on all three SSR renderers (build CLI pipeline
   automation stays out of scope; the app's build produces the manifest); continue hardening
   mismatch policy, async boundaries, and integration tests before
   widening the contract.
6. **SSG core** — implemented on top of `renderToString()` via `generateStaticSite()`; keep
   filesystem output and route crawling deferred while preserving collected `renderToString()`
   styles, production asset tags, and explicit-path router records through the shell contract.
7. **SSR/SSG/hydration next phase** — the composable router-aware slice now settles request routers,
   serializes canonical snapshots, and verifies before hydration. The renderer-owned router slice
   (see [`2026-08-26-renderer-owned-router-design.md`](./superpowers/specs/2026-08-26-renderer-owned-router-design.md))
   is now implemented on top of it: `renderToStream()` and `renderToStringAsync()` accept a `router`
   option that settles a request-scoped memory router, injects its `provides`, and embeds the
   serialized route snapshot, while `hydrateAsync(container, { router, routerIdentifyRecord })`
   verifies the embedded snapshot before hydrating and removes the transport script. The sequential streaming SSR slice
   is implemented as `renderToStream()` on `@italone/solace/server`: it streams the exact
   `renderToStringAsync().html` byte order, flushes completed prefixes before async components
   resolve, emits `useStyle()` styles inline at first registration, starts rendering eagerly, and
   does not handle consumer backpressure. The out-of-order streaming slice is now implemented on
   top of it: `mode: "out-of-order"` emits `<!--so:b:N-->` boundary markers with
   `defineAsyncComponent({ loader, fallback })` fallbacks and flushes `<!--so:r:N-->` replacement
   scripts in resolution order after the document; loader failures keep the fallback and emit a
   failure comment without rejecting the stream, and the DOM is final before client hydration runs.
   The Suspense/selective hydration slice is now implemented on top of it: the `Suspense` built-in
   component coordinates async subtrees behind one fallback (CSR and both streaming modes; ordered
   mode awaits the subtree inline, out-of-order mode emits one `so:b` boundary per Suspense), and
   `hydrateAsync(container, { selective: true })` hydrates ready parts immediately, patches boundary
   content on loader resolution, strips markers after settlement, and replays buffered interactions
   (click/pointerdown/keydown/input/change) with typed payloads. Keep route crawling, filesystem
   output, router-aware SSG, and synchronous-entry router options deferred.
8. **Browser DevTools extension UI** — the first example panel is implemented under
   `examples/devtools-extension`; continue hardening extension packaging, the browser extension QA
   checklist, richer event contracts, and future inspectors without reading private runtime state.
9. **Production adoption guidance** — large-app patterns, performance tuning, migration notes. A
   first guide now exists in `docs/large-app.md` and `docs/large-app.zh-CN.md`; ecosystem and UI
   library decisions are recorded in `docs/ecosystem.md`; keep evolving both from real usage.
10. **1.0 admission evidence** — keep `release/one-zero-readiness.json` and
    `pnpm release:one-zero:check -- --report` honest about independent apps, upgrade coverage,
    performance history, production DevTools permissions, and migration/rollback procedures. The
    the stricter evidence checklist currently reports `INCOMPLETE`: React/Vite compatibility installs
    are not Solace-primary adoption, browser keyed scenarios lack five distinct dates, DevTools lacks
    distributable evidence, and stable contract admission is still blocked. A future `READY` report
    remains evidence state only; it does not publish 1.0 or widen the beta contract.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- React compatibility mode or React API cloning.
- SFC syntax expansion without a separate design.
- Production-grade DevTools extension distribution and advanced inspectors.
- Long-term compatibility guarantees for private internal modules.
- UI library or plugin marketplace work as a 1.0 admission requirement.
- SuspenseList, scheduler priorities, and transition hooks on the Suspense fallback swap — the
  Suspense/selective hydration slice itself is now implemented (`h(Suspense, { fallback },
children)` plus `hydrateAsync(container, { selective: true })` on top of `renderToStream(tree, {
mode: "out-of-order" })`); these sub-items remain out of scope — revisit after 1.0 with a
  dedicated design doc.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
