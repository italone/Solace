# Performance Benchmark Expansion Design

## Context

Solace already has a runnable benchmark path through `pnpm benchmark`, backed by Vitest and
tinybench. Existing coverage measures initial rendering of 1000 components, 10000-row list create /
update / delete / reorder, and repeated component mount/unmount memory observation.

README now lists benchmark expansion as a primary next step. The next increment should improve
benchmark coverage without changing runtime behavior or introducing new benchmark tooling.

## Goal

Extend the existing benchmark suite to cover more realistic renderer pressure points:

- keyed diff local insert, local remove, and item movement patterns,
- Fragment initial render and Fragment patch behavior,
- batched reactive component updates through the scheduler.

Each benchmark case must still assert a concrete DOM result so the benchmark also catches broken
runtime behavior.

## Proposed Approach

Use existing Vitest + tinybench conventions:

- Keep each benchmark as a `.bench.ts` file under `tests/performance/`.
- Use short `Bench({ iterations: 1, time: 20, warmup: false })` settings, matching current files.
- Use jsdom DOM assertions inside each task.
- Print latency and throughput through the existing `report()` pattern.
- Avoid threshold assertions for absolute speed. The suite should verify completion and report
  metrics, not fail due to normal machine variance.

## Benchmark Cases

### Keyed Diff Patterns

Extend `tests/performance/list-diff.bench.ts` with focused keyed operations against a stable list:

- Insert a block into the middle of a keyed list.
- Remove a block from the middle of a keyed list.
- Move a keyed item from tail to head or head to tail.

These cases complement the current full reverse reorder and make future keyed diff changes easier to
compare.

### Fragment Rendering

Add a dedicated Fragment benchmark file:

- Initial render of a Fragment containing many keyed children.
- Patch from one Fragment child set to another while preserving keyed identity.
- Replace a Fragment with a normal element, or a normal element with a Fragment, only if existing
  renderer behavior supports that transition reliably.

The benchmark should import `Fragment`, `h`, and `render` from the package root.

### Batched Component Updates

Add a component update benchmark file:

- Render a component tree with many reactive consumers.
- Mutate reactive state multiple times synchronously.
- Await `nextTick()` and assert the DOM reflects only the final value.

This measures scheduler batching and component update throughput at the API level, matching how users
drive updates.

## Documentation And Logs

Update `docs/performance.md` and README's later-roadmap section to mention the expanded benchmark
coverage. Add a project log entry `2026-07-13-015-performance-benchmark-expansion.md` and index row.

## Validation

Run these commands after implementation:

- `pnpm benchmark`
- `pnpm typecheck`
- `pnpm format:check`

Run `pnpm quality` if source or shared test helpers are changed. This design should only add
benchmark tests and docs, so e2e is not required.

## Non-Goals

- No renderer algorithm changes.
- No new benchmark dependency.
- No browser-run benchmark harness.
- No absolute performance thresholds.
- No CI release gate change unless the existing `pnpm benchmark` script already participates.
