# Scheduler DevTools Flush Design

## Context

Solace now has an internal DevTools event bus, but no runtime module emits events. The safest first runtime hook is
the scheduler flush summary because it has a narrow boundary and does not expose component instances, props, DOM
nodes, or reactive targets.

## Goals

- Emit a `scheduler:flush` DevTools event after a scheduler flush completes.
- Include the number of jobs processed and a non-negative duration.
- Avoid constructing event payloads when no DevTools listener is registered.
- Preserve existing scheduler behavior and `nextTick` timing.
- Keep DevTools APIs internal.

## Non-Goals

- Do not emit component mount/update/unmount events.
- Do not emit queued job identities or function references.
- Do not add public package exports.
- Do not change scheduler batching semantics.

## Design

In `src/scheduler/scheduler.ts`, import internal DevTools helpers:

```ts
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";
```

During `flushJobs()`, track:

- `startedAt`: only when `hasDevtoolsListeners()` is true.
- `flushedJobs`: incremented for each executed job.

In `finally`, before clearing queue state, emit:

```ts
emitDevtoolsEvent({
  type: "scheduler:flush",
  queuedJobs: flushedJobs,
  durationMs: Math.max(0, now() - startedAt),
});
```

Use a small `now()` helper based on `globalThis.performance?.now() ?? Date.now()` for browser and Node compatibility.

## Testing

Use TDD by adding scheduler tests first:

- Register a DevTools listener, queue two jobs, await `nextTick`, and assert one `scheduler:flush` event.
- Assert `queuedJobs` matches executed jobs.
- Assert `durationMs` is a non-negative number.
- Existing scheduler tests continue to validate batching semantics.

## Risks

- Measuring duration can add small overhead when a listener exists; no-listener path should skip timing.
- Listener failures are handled by the event bus, not the scheduler.
- The event name and payload are internal and should not be documented as public API.
