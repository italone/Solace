# Suspense + Selective Hydration Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-08-25
**Depends on:** out-of-order streaming SSR (merged 2026-08-25), sequential `renderToStream()` (merged 2026-08-24)
**Sub-project:** 2 of 4 SSR capability gaps (out-of-order streaming ✅ → **Suspense/selective hydration** → renderer-owned router → production SSR pipeline)

## Goal

Add a `<Suspense>` component for subtree-level async coordination, and event-driven selective hydration: when `hydrateAsync` runs with `selective: true`, ready parts of the server DOM hydrate immediately, unresolved async boundaries keep their fallback while user interactions are captured and replayed, and each boundary hydrates incrementally as its loader resolves.

## API Surface

- **`Suspense`** — new built-in component exported from the package root (`src/component/suspense.ts`):
  - `h(Suspense, { fallback: VNode | (() => VNode) }, children)` — renders `fallback` while any `defineAsyncComponent` inside the subtree is unresolved; switches to the real content once all subtree loaders resolve.
  - Works in CSR without SSR: the component collects async loaders in its subtree, awaits them via `Promise.all`, and swaps fallback → content on resolution.
  - Nested `Suspense` boundaries are independent: each coordinates only its own subtree.
- **`hydrateAsync(App, { container, recover?, selective?: boolean })`** — new `selective` option (default `false`). When `false`, behavior is byte-identical to the current whole-tree prepare-then-match contract. When `true`:
  - Ready subtrees hydrate immediately.
  - Unresolved async boundaries (marked by `<!--so:b:N-->…<!--/so:b:N-->`) keep their fallback DOM; hydration skips that range and continues.
  - Interactions inside not-yet-hydrated regions are buffered at the container root and replayed after the boundary hydrates.
- **SSR**: in `renderToStream(tree, { mode: "out-of-order" })`, a `Suspense` boundary reuses the existing `so:b` wire protocol — the whole Suspense subtree forms one pending boundary (its internal async components are awaited as one unit, not split per component).

## Wire Protocol

No new markers. A Suspense boundary in out-of-order mode emits:

```
<!--so:b:<id>-->fallback subtree<!--/so:b:<id>-->
```

exactly like an async-component boundary, with the Suspense `fallback` as placeholder content and the resolved subtree in the replacement script. `<!--so:r:<id>-->` replacement scripts and `<!--so:b:<id> failed:<message>-->` failure comments reuse the existing builders and resolution-order race loop.

## Architecture

### Server (`src/server/render-to-stream.ts`)

`streamComponent` recognizes the `Suspense` component type and routes it to a boundary emitter: collect every async-component loader reachable in the Suspense subtree, create one `PendingBoundary` whose readiness is `Promise.all(collected loaders)`, emit markers + fallback, and let the existing flush loop produce the replacement script. Nested `Suspense` inside a Suspense subtree registers as its own pending boundary (existing nested-flush behavior applies). Ordered mode and buffered SSR (`renderToString`/`renderToStringAsync`) keep current semantics: Suspense awaits its subtree inline like any async dependency (documented; no fallback swap in buffered SSR for this slice).

### Client hydration (`src/renderer/hydration.ts` + `src/renderer/selective-events.ts`)

- The hydration walker gains comment tolerance: non-boundary comment nodes are skipped; a `<!--so:b:N-->` comment locates its `<!--/so:b:N-->` pair, the enclosed DOM range is registered as a `PendingHydrationBoundary { id, start, end, vnode }` and skipped (fallback DOM untouched).
- When the boundary's loaders resolve, the enclosed range is hydrated locally by reusing `hydratePreparedVNode`, then both marker comments are removed.
- With `selective: false` (default), `prepareAsyncSource` still pre-resolves everything before the walk — unchanged contract, and boundary markers are consumed/removed during the walk so the strict sibling-pointer matching is preserved.
- With `selective: true`, pending boundaries hydrate as loaders resolve, in resolution order.

### Event buffering (`src/renderer/selective-events.ts`, new module)

- On `selective: true`, capture-phase listeners for a whitelist (`click`, `pointerdown`, `keydown`, `input`, `change`) are attached to the hydration container.
- While buffering: each event is `preventDefault()` + `stopPropagation()`-ed and recorded with its composed path.
- After a boundary hydrates, buffered events whose target lies inside the newly hydrated range are replayed once via `dispatchEvent` and removed from the buffer; events whose target is no longer in the DOM are silently dropped.
- When all boundaries are hydrated, the container listeners are removed.

## Error Handling

- SSR boundary failure: unchanged — fallback kept, failure comment emitted, stream not rejected.
- Client loader failure during selective hydration: the boundary keeps its fallback, the error is reported via `console.error`, and `hydrateAsync` does not reject.
- Local hydration mismatch inside a boundary: honors `recover` — with `recover: true` the boundary's server DOM is discarded and client-rendered; otherwise a `SolaceHydrationError` is thrown for that boundary without disturbing already-hydrated regions.
- Invalid usage: `selective` on sync `hydrate()` throws (option only exists on `hydrateAsync`), and unknown hydration options keep throwing as today.

## Non-Goals

- No client-side parsing of the `so:r` script stream — replacement scripts execute in the browser before `hydrateAsync` runs, exactly as today; incremental hydration keys off loader readiness.
- No scheduler priority changes, no `SuspenseList`, no cross-boundary hydration ordering coordination (resolution order only).
- No transition/animation hooks on the fallback → content swap.
- No out-of-order behavior in SSG or buffered SSR APIs.

## Testing And Gates

- Unit: Suspense CSR fallback/swap/nested; walker comment tolerance; boundary skip + registration; local hydration; event buffer/replay/drop; loader-failure semantics; `selective` option validation; default-path regression (whole-tree hydration byte-identical).
- Integration: out-of-order stream → `selective: true` hydration → click buffered before boundary readiness, replayed after; full existing server/integration suites stay green.
- Docs: `docs/api.md` + `.zh-CN.md` (Suspense component, `selective` option, event buffering, failure semantics), `docs/project-status.md`(.zh-CN), `docs/roadmap.md` (move Suspense/selective hydration out of Out of Scope), `readme.md`/`readme.zh-CN.md`; docs-contract tests updated to match.
- Full gate: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`, then `pnpm build && pnpm test:package && pnpm package:smoke`.
