# Component Update Pending Guard Design

## Context

Solace already batches component update jobs through `queueJob()` and dedupes identical job functions in the scheduler.
The current component update scheduler callback still calls `queueJob(instance.update)` every time a reactive dependency
for that component is triggered in the same tick. The scheduler's `Set` prevents duplicate execution, but high fan-out
component updates still pay repeated queue/dedupe calls before the flush.

The latest local jsdom benchmark metrics include `1000 component batched reactive update`, where many component
consumers observe one reactive source and the source is mutated several times synchronously before `nextTick()`. The
next narrow component batching slice should reduce per-component repeated scheduling overhead without changing flush
ordering, public APIs, or renderer semantics.

## Goal

Add an internal component-level pending update guard so each component instance attempts to enqueue its update job at
most once per scheduler tick.

## Non-Goals

- Do not change scheduler queue ordering, dedupe semantics, `nextTick()` timing, or DevTools scheduler payloads.
- Do not add priority scheduling, async rendering, interruptible rendering, or partial tree scheduling.
- Do not skip actual component updates when a component has pending reactive changes.
- Do not change public APIs, package exports, benchmark thresholds, or release gates.
- Do not optimize browser initial render in this slice.

## Proposed Approach

Add an internal boolean to `ComponentInstance`, for example `isUpdateQueued`.

When a mounted component's reactive effect scheduler runs:

1. If `instance.update` is `null`, return as today.
2. If `instance.isUpdateQueued` is already true, return without calling `queueJob()`.
3. Otherwise set `instance.isUpdateQueued = true` and enqueue a stable component update job.
4. When that job starts executing, clear `instance.isUpdateQueued = false`, then run the current component update.

This keeps the existing scheduler as the source of queue ordering and flush timing. The component layer only avoids
repeatedly asking the scheduler to dedupe the same component job during one pending window.

The stable job can be stored on the component instance, for example `queuedUpdate`, so the scheduler still receives the
same function identity for normal dedupe and DevTools accounting. Clearing the pending flag at job start allows updates
triggered during an update flush to be considered for a later queue attempt according to the existing scheduler rules.

## Alternatives Considered

### Optimize `queueJob()` Internals

The scheduler already has a direct `Set` lookup and array push. Reworking the scheduler would affect every job type,
including function-rendered roots and future internal jobs. The component benchmark pressure is narrower, so a component
instance guard has less blast radius.

### Add Job Metadata To Scheduler

The scheduler could accept structured jobs with a queued flag. That would make dedupe state explicit, but it would
change the scheduler API and require adapting all callers. The current public surface does not need that generality.

### Only Add Larger Benchmarks

Adding bigger samples would improve evidence but not reduce any known overhead. The existing benchmark already exercises
the repeated scheduling shape; the implementation should add a targeted test and keep the benchmark as validation.

## Behavioral Requirements

- Multiple synchronous mutations of one dependency should enqueue each mounted component update at most once before
  `nextTick()`.
- The component should still render the final reactive value after the flush.
- Different component instances should still each receive their own update.
- A direct component update triggered after the previous flush completes should be able to enqueue again.
- Scheduler tests for dedupe, in-flush queuing, `nextTick()`, and DevTools summaries should continue to pass.
- Stable child component skip behavior should remain unchanged.

## Test Plan

Use TDD before changing runtime code:

- Add a component or integration test that spies on `queueJob`, renders many reactive component consumers, performs
  repeated synchronous mutations, and proves each component queues only once before `nextTick()` while the DOM reflects
  the final value.
- Add or retain a follow-up assertion that another mutation after the first flush can queue and update the same
  components again.
- Run `tests/performance/component-update.bench.ts` to confirm the existing `1000 component batched reactive update`
  task still completes and reports metrics.

Validation commands:

- `pnpm exec vitest run tests/unit/component/component.test.ts tests/integration/batched-render.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with a short note that component updates now avoid repeated enqueue attempts while pending.
- `solace-project-log/index.md` and a new implementation log entry for the runtime change.

This design document is tracked separately as `2026-07-20-002`.

## Risk And Safety

The main risk is clearing the pending flag at the wrong time. Clearing too late could drop a legitimate later update;
clearing too early could reintroduce duplicate queue attempts in the same pending window. The implementation should
clear at the start of the enqueued component job and rely on existing scheduler behavior for any update requested during
the current flush.

The second risk is testing only scheduler calls while missing DOM behavior. Tests must assert both reduced enqueue
attempts and the final rendered DOM so the optimization cannot mask lost updates.
