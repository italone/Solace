# Initial Props Mount Fast Path Design

## Context

The latest Chromium production benchmark window has five fresh `large-list` samples. The latest-window browser medians
are 7.4 ms for initial render, 3.7 ms for selected-row update, and 1.1 ms for unmount. Initial render is still the
largest and most variable browser-side metric after the component update guard and component child batch mount slices.

The browser fixture mounts 10,000 row elements with plain attributes such as `data-row` and `class`. The renderer already
batches initial child insertion through `DocumentFragment`, so the next narrow initial-render slice should reduce the
per-element prop mount overhead without changing update diffing.

## Goal

Add a conservative initial element props mount fast path so ordinary attributes avoid unnecessary generic prop patching
work during first render.

## Non-Goals

- Do not change public APIs, package exports, package build shape, or JSX runtime output.
- Do not change element update props patching, event handler update semantics, scheduler behavior, or `nextTick()` timing.
- Do not change keyed children diffing, child mount batching, unmount batching, or DevTools event payloads.
- Do not add timing thresholds or claim an absolute browser performance target.
- Do not modify the browser benchmark fixture just to improve measured results.

## Proposed Approach

Replace the initial mount props loop in `src/renderer/diff.ts` with a dedicated helper for newly created elements:

1. Iterate own enumerable props with `for...in` and the existing `hasOwnProp()` helper instead of `Object.entries()`.
2. Continue skipping the internal `key` prop.
3. Skip `null`, `undefined`, and `false` values on fresh elements because there is no previous attribute to remove.
4. Route actual event props through the existing generic `patchProp()` behavior.
5. Set ordinary initial attributes directly with `el.setAttribute(key, String(value))`.

Keep `patchProps()` unchanged for updates. Update paths still need removal, event replacement, and previous-value
comparison behavior, so they should keep using the generic patching path.

## Alternatives Considered

### Broaden Child Mount Batching Again

Child insertion is already batched for initial array children, Fragment children, and component child mounts. More
batching work is unlikely to address the current browser initial render hotspot as directly as per-element prop mount
overhead.

### Rewrite VNode Creation For Static Rows

Caching or specializing the benchmark fixture would reduce measured work but would make the benchmark less useful as a
renderer signal. The runtime should optimize the common plain-attribute path instead.

### Optimize Event Detection Globally

Event prop detection is shared between mount and update semantics. A global rewrite is broader than needed. This slice
only avoids the generic path where a newly created element has a plain, non-event attribute.

## Behavioral Requirements

- Initial mounting with ordinary attributes must produce the same DOM attributes as before.
- Initial mounting must still ignore the internal `key` prop.
- Initial `null`, `undefined`, and `false` props must not create attributes.
- Initial `null`, `undefined`, and `false` props on fresh elements must not perform redundant DOM attribute removals.
- Initial event props such as `onClick` must still bind and dispatch correctly.
- Element prop updates and removals after mount must keep existing behavior.
- Inherited enumerable props must not be mounted as attributes.

## Test Plan

Use TDD before changing runtime code:

- Add a renderer unit test proving plain initial element props no longer call `Object.entries()`.
- Add a renderer unit test proving empty initial props do not call `removeAttribute()` on a fresh element.
- Rely on existing event tests and renderer prop patch tests for event binding and update semantics, and run them with
  the focused renderer suite.

Validation commands:

- `pnpm vitest run tests/unit/renderer/diff.test.ts`
- `pnpm vitest run tests/unit/event/event.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

After implementation, refresh the Chromium browser benchmark history as trend context if the local environment allows
the preview server to bind.

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with a short note that initial element props now use a conservative mount fast path.
- `solace-project-log/index.md` and a new implementation log entry for the runtime change.

This design starts the new performance cycle after `2026-07-20-006-browser-benchmark-trend-refresh.md`.

## Risk And Safety

The main risk is accidentally changing prop semantics during initial mount. The helper should only specialize cases that
are unambiguous for a newly created element and should delegate event props to the existing `patchProp()` implementation.
Update-time behavior remains on the old generic path to avoid weakening removal and event replacement semantics.
