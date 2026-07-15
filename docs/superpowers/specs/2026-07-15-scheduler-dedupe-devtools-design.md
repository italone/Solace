# Scheduler Dedupe DevTools Design

## Goal

Extend the `scheduler:flush` DevTools summary so tooling can see how many queued jobs actually ran and how many duplicate queue attempts were skipped during the same flush cycle.

## Event Shape

Change `scheduler:flush` from:

```ts
{
  type: "scheduler:flush";
  queuedJobs: number;
  durationMs: number;
}
```

to:

```ts
{
  type: "scheduler:flush";
  queuedJobs: number;
  dedupedJobs: number;
  durationMs: number;
}
```

- `queuedJobs`: number of jobs actually executed during the flush.
- `dedupedJobs`: number of queue attempts skipped because the same job was already queued or currently being flushed.
- `durationMs`: non-negative flush duration.

## Runtime Boundary

Count duplicate queue attempts in `src/scheduler/scheduler.ts` inside `queueJob(job)`, where duplicates are already detected by `queuedJobs.has(job)`.

The counter must only increment when DevTools listeners exist. Without listeners, `queueJob()` should keep the current fast path and skip no extra DevTools-only work beyond the existing listener check.

The counter resets after every `flushJobs()` completion, including error paths handled by `finally`.

## Privacy Boundary

Do not expose:

- scheduler job functions
- function names
- stack traces
- component instances
- reactive effects
- VNodes
- DOM nodes
- user data

`dedupedJobs` is a scalar count only.

## Error Behavior

Do not change scheduler error propagation. If a queued job throws, the flush should still emit a summary in `finally` when DevTools listeners exist, then clear the queue and reset scheduler state as it does today.

## Serialization

`serializeDevtoolsEvent()` must copy `dedupedJobs` for `scheduler:flush`.

Payload stability tests must allow only `durationMs`, `queuedJobs`, `dedupedJobs`, and `type` for scheduler flush events.

## Documentation

Update `docs/devtools.md`:

- include `dedupedJobs` in the documented `scheduler:flush` union member
- state that scheduler flush summaries include executed job count, deduped queue attempts, and duration only
- update the scheduler roadmap wording from flush-only summary to flush + dedupe summary

Add a project log entry and index row for the implementation.

## Validation

Use TDD:

1. Add failing scheduler tests for duplicate queue attempts before a flush and self-queue attempts during a flush.
2. Add failing payload stability expectations for `dedupedJobs`.
3. Implement the minimal event type, serializer copy, and guarded scheduler counter.
4. Run targeted scheduler and payload tests, then full validation.

Required validation commands:

- `pnpm test -- tests/unit/scheduler/scheduler.test.ts tests/integration/devtools-payload-stability.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm typecheck:jsxdev`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
