# Component Child Batch Mount Design

## Context

Solace already batches initial mount of element-only children through `DocumentFragment`, which helps Fragment and
large-element-tree cases. The remaining component initial render benchmark, `1000 component initial render`, still
mounts each child component directly into the parent container because the batch helper only accepts element VNodes.

The result is a lot of parent-container insertion pressure during large component trees even when the child list is a
single initial mount. The next narrow runtime slice should reduce that mount overhead without changing update,
unmount, or scheduler semantics.

## Goal

Batch initial array-child mounts through a `DocumentFragment` even when the children include components, so component
heavy initial renders only insert once into the real parent container.

## Non-Goals

- Do not change component update scheduling, queue dedupe, or `nextTick()` timing.
- Do not change unmount batching, keyed diff ordering, or public APIs.
- Do not add new benchmark scenarios or adjust benchmark thresholds.
- Do not change DevTools payload shapes or release flows.
- Do not optimize browser benchmark harness code in this slice.

## Proposed Approach

Broaden the renderer's initial child-mount batching predicate in `src/renderer/diff.ts` so a non-empty child array can
mount into a `DocumentFragment` before one parent insertion.

Keep the change local to the child mount path:

1. Mount each child into a fragment when the helper says batching is allowed.
2. Insert that fragment once into the real container.
3. Leave unmount batching and child-update diffing unchanged.

This preserves the existing component mount/update semantics while removing repeated parent insertions on large
initial mount trees.

## Alternatives Considered

### Keep Element-Only Batching

This is already in place, but it leaves the component initial render benchmark on the table. The current benchmark data
points at component mount pressure, so keeping the old guard would not move the next hotspot.

### Rewrite Component Rendering

Component-specific caching or prebuilt VNode trees would be broader and riskier. The current change is a local renderer
mount improvement that reuses the same component model and existing fragment insertion behavior.

### Move the Benchmark To Static HTML

That would reduce measured work, but it would also weaken the benchmark as a renderer signal. The runtime batching path
is a cleaner fit for the current performance work.

## Behavioral Requirements

- Initial mounts of component children should still render the same DOM tree.
- Child mounted hooks should still run.
- Update and unmount behavior should remain unchanged.
- Existing element-only batching behavior should continue to work.
- The component initial render benchmark should still render 1,000 child components and report completion.

## Test Plan

Use TDD before changing runtime code:

- Add a component unit test that renders many child components under one parent element, spies on the parent element's
  `insertBefore`, and proves the initial mount only inserts the child block once into the real parent container.
- Keep the DOM assertion so the batch path cannot hide missing children.
- Run `tests/performance/render.bench.ts` to confirm the `1000 component initial render` task still completes.

Validation commands:

- `pnpm vitest run tests/unit/component/component.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/render.bench.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with a short note that component initial mounts now batch child inserts through a
  `DocumentFragment`.
- `solace-project-log/index.md` and a new implementation log entry for the runtime change.

## Risk And Safety

The main risk is broadening the batch helper too far and changing the timing of mounted hooks or insertion anchors.
This design keeps the change in the initial child mount path only and preserves the existing fragment insertion model,
which already batches element children today.
