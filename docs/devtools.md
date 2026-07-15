# DevTools

Solace exposes a narrow public DevTools integration surface through `solace/devtools`. This document records the public
lifecycle, private runtime boundary, and safe constraints for future instrumentation.

## Goals

- Help developers inspect component, reactivity, scheduler, renderer, and store behavior.
- Keep instrumentation opt-in.
- Avoid stabilizing internal runtime objects as public API.
- Avoid adding measurable overhead to production builds or benchmarks.

## Non-Goals

- No browser extension, custom panel, network transport, storage persistence, or automatic telemetry in the current phase.

## Public API

DevTools integrations should import from the `solace/devtools` subpath:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "solace/devtools";
import type { DevtoolsEvent } from "solace/devtools";
```

The public subpath exports listener and recorder APIs only. It does not export emit helpers, listener-state helpers,
global cleanup helpers, serializers, DOM nodes, VNode trees, component instances, props, reactive targets, store state,
action arguments, or action results.

## Candidate Capabilities

| Area       | Useful Signals                                         | Notes                                                                        |
| ---------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Components | mount, update, unmount, props, emits, lifecycle hooks  | Component lifecycle and emit summaries are emitted by the internal event bus |
| Reactivity | effect creation, dependency tracking, triggers, stops  | Trigger summaries are emitted without raw targets, keys, or values           |
| Scheduler  | queued jobs, flush duration, skipped stale jobs        | `scheduler:flush` summary is emitted by the internal event bus               |
| Renderer   | element mount, prop patch, child diff, unmount         | Element summaries are emitted without DOM nodes or VNode trees               |
| Store      | action calls, narrow state paths, getter recomputation | Action summaries are emitted without args, results, or state                 |

## Hook Boundary

Solace has an internal event bus in `src/devtools/events.ts`. Runtime modules emit through that internal bus, while
public integrations subscribe through `solace/devtools`. The package root intentionally does not export DevTools APIs.

```ts
type DevtoolsEvent =
  | { type: "component:mount"; id: number; name: string }
  | { type: "component:update"; id: number; name: string }
  | { type: "component:unmount"; id: number; name: string }
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
  | { type: "scheduler:flush"; queuedJobs: number; dedupedJobs: number; durationMs: number }
  | {
      type: "reactivity:trigger";
      targetType: string;
      keyType: string;
      effectCount: number;
      scheduledEffects: number;
      runEffects: number;
    }
  | {
      type: "renderer:element";
      operation: "mount" | "update" | "unmount";
      tag: string;
    }
  | {
      type: "store:action";
      name: string;
      status: "success" | "error";
      durationMs: number;
    };
```

`component:emit` summaries include the component id, component name, emitted event name, and callable handler count only.
They do not include emitted arguments, raw props, handler functions, component instances, VNodes, DOM nodes, or user
content.

`scheduler:flush` summaries include executed job count, deduped queue attempt count, and flush duration only. They do
not include scheduler job functions, function names, stack traces, component instances, reactive effects, VNodes, DOM
nodes, or user data.

Future runtime modules should emit small serializable events only when a listener is registered. If no listener is registered, the runtime should do no meaningful extra work.

`serializeDevtoolsEvent(event)` is available only from the internal event bus module. It returns an explicit plain-object
copy for the current event union and is used by integration tests to lock the payload boundary. It is not exported from
the package root.

`createDevtoolsRecorder()` is public through `solace/devtools`. It installs a listener, stores serialized events in
memory, exposes `snapshot()` for a copy of collected events, exposes `clear()` to reset the current capture window, and
exposes `stop()` to remove the listener. Pass `{ limit }` to keep only the latest N events in memory. It does not
persist data, send data over the network, write to storage, or install third-party scripts.

## Privacy And Safety

- Do not emit full props, state, DOM nodes, or reactive targets by default.
- Redact or summarize values before exposing them to tooling.
- Keep hooks disabled unless a dev-only listener is installed.
- Do not send data over the network.

## Performance Constraints

- Production builds should not pay for DevTools instrumentation.
- Benchmark commands should run with DevTools disabled.
- Hook payload construction should be lazy or guarded by a listener check.
- Component tree and dependency graph snapshots should be explicit actions, not automatic on every update.

## Phased Roadmap

1. **Event model design**: completed for initial component and scheduler summary events.
2. **Development-only event bus**: internal event bus exists in `src/devtools/events.ts`.
3. **Scheduler flush and dedupe summary**: `scheduler:flush` reports executed jobs, deduped queue attempts, and duration.
4. **Component lifecycle summaries**: component mount/update/unmount summaries emit id and name only.
5. **Component emit summaries**: `component:emit` is emitted with event name and callable handler count only.
6. **Store action summaries**: `store:action` is emitted after action success or error without raw values.
7. **Reactivity trigger summaries**: `reactivity:trigger` is emitted without raw targets, keys, or values.
8. **Renderer element summaries**: `renderer:element` is emitted for element mount/update/unmount without DOM nodes or VNode trees.
9. **Payload stability smoke**: integrated runtime events serialize to JSON-safe payloads with allowed fields only.
10. **Internal recorder boundary**: `createDevtoolsRecorder()` captures serialized event snapshots for examples and experiments.
11. **Example-oriented recorder smoke**: a todo-style interaction validates recorder capture after clearing initial mount noise.
12. **Bounded recorder captures**: `createDevtoolsRecorder({ limit })` keeps recorder memory bounded for examples and experiments.
13. **Public package boundary guard**: package exports tests verify DevTools internals are not available from the package root.
14. **Public DevTools subpath**: `solace/devtools` exposes listener and recorder APIs without internal emit helpers.
15. **Inspector UI or browser extension**: build only after event payloads prove stable in examples.

## Recommendation

Do not implement a DevTools UI yet. The public `solace/devtools` subpath is a low-level integration surface for examples,
tests, and future inspector tooling. Build a browser extension or custom panel only after more payloads prove stable in
real examples.
