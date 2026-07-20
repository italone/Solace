# Initial Class Mount Fast Path Design

## Context

The latest Chromium production benchmark window still shows `initialRenderMs` as the largest browser-side metric.
The latest-window browser medians are 6.9 ms for initial render, 3.5 ms for selected-row update, and 1.1 ms for
unmount. The current browser fixture and the `1000 component initial render` jsdom benchmark both mount many elements
with a `class` prop on the initial render path.

The renderer already has an initial props mount fast path for ordinary attributes. The remaining narrow initial-render
opportunity is the `class` prop itself, which is common in both the browser benchmark and the component render bench.

## Goal

Add a conservative initial `class` mount fast path so fresh HTML elements can set class names directly without going
through generic attribute patching.

## Non-Goals

- Do not change public APIs, package exports, package build shape, or JSX runtime output.
- Do not change update-time prop patching, event handler semantics, scheduler behavior, or `nextTick()` timing.
- Do not change keyed children diffing, child mount batching, unmount batching, or DevTools event payloads.
- Do not add timing thresholds or claim an absolute browser performance target.
- Do not modify the browser benchmark fixture just to improve measured results.

## Proposed Approach

Extend the initial props mount helper in `src/renderer/diff.ts`:

1. Keep skipping empty values and the internal `key` prop.
2. For `class` on `HTMLElement` instances, assign `el.className = String(value)`.
3. For non-HTML elements, fall back to the existing attribute path for `class`.
4. Leave all other ordinary attributes on the existing direct `setAttribute()` path.
5. Leave update-time `patchProps()` unchanged so removals and replacements keep their current behavior.

This keeps the change local to first render and narrows the fast path to a prop that is common in the benchmark
fixtures while remaining conservative for non-HTML DOM nodes.

## Alternatives Considered

### Optimize `style` Next

`style` is also common in DOM applications, but this repository's current benchmark data points more directly at
`class` on large element trees. `style` would also raise more semantic questions than `class`.

### Rewrite Browser Benchmark Markup

Changing the benchmark to avoid `class` would make the measurement less representative. The runtime should absorb the
cost instead.

### Broaden To More Prop Types

A wider initial-prop specialization would be riskier and harder to prove. The next slice should stay focused on the
highest-frequency prop in the benchmark fixtures.

## Behavioral Requirements

- Initial mounting of HTML elements with a `class` prop must still produce the same visible class value.
- Initial mounting of non-HTML elements must still work through the attribute fallback path.
- Initial mounting with `null`, `undefined`, or `false` class values must not create a class attribute.
- Element prop updates must keep using the existing patch path.
- Event props must still bind and dispatch correctly.
- Existing initial prop fast path behavior for ordinary attributes must remain unchanged.

## Test Plan

Use TDD before changing runtime code:

- Add a renderer unit test that renders a plain HTML element with a `class` prop and proves the mount does not call
  `setAttribute()` for `class`.
- Add a renderer unit test that mixes `class` with an ordinary attribute and proves the ordinary attribute still mounts.
- Keep existing renderer and event tests in the focused validation set.

Validation commands:

- `pnpm vitest run tests/unit/renderer/diff.test.ts`
- `pnpm vitest run tests/unit/event/event.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts`
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

- `docs/performance.md` with a short note that initial class mounting now uses a direct HTML className fast path.
- `solace-project-log/index.md` and a new implementation log entry for the runtime change.

This design starts the new performance cycle after `2026-07-20-009-initial-props-mount-fast-path.md`.

## Risk And Safety

The main risk is accidentally changing class semantics for non-HTML nodes. The helper should only special-case
`HTMLElement` instances and should fall back to the existing attribute path elsewhere. Update-time behavior remains on
the old generic path so removals and replacements keep their current semantics.
