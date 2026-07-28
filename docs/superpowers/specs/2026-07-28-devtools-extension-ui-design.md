# DevTools Extension UI Design

## Goal

Design a browser DevTools extension UI on top of the existing `@italone/solace/devtools` listener and
recorder APIs, without changing runtime event payloads in the same phase.

This work starts only after SSR/SSG/hydration boundaries are stable enough that the UI will not need
to guess about server-rendered trees, hydration mismatches, or style collection state.

## Current Baseline

Solace currently exposes a low-level public DevTools subpath:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
```

The public event surface contains small serializable summaries for:

- Component lifecycle.
- Component emits.
- Scheduler flushes.
- Reactivity triggers.
- Renderer element operations.
- Store actions.

The runtime does not expose raw props, state, DOM nodes, VNodes, reactive targets, action arguments,
action results, stack traces, or user content.

## Non-Goals

- No runtime event payload changes in the same task as extension UI scaffolding.
- No automatic telemetry.
- No network transport.
- No persistent project data storage.
- No dependency on private `src/**` or `dist/**` module paths.
- No SSR/SSG/hydration event visualization until those events are explicitly designed.

## Extension Architecture

Use a three-layer extension model:

1. **Page bridge**: subscribes to `@italone/solace/devtools` in the inspected page and forwards
   serialized events.
2. **DevTools panel**: renders the UI, applies filters, and owns local panel state.
3. **Session recorder**: stores an in-memory bounded event timeline for the active inspection
   session.

The bridge should forward only the serialized public `DevtoolsEvent` shape. It must not reach into
Solace internals or inspect component instances directly.

## Initial UI

The first panel should be operational rather than decorative:

- Timeline list with event type, timestamp, and compact summary.
- Filters for component, scheduler, reactivity, renderer, and store events.
- Clear button for the current capture window.
- Pause/resume capture toggle.
- Event detail pane that shows the serialized payload exactly as received.
- Recorder limit control for bounded memory usage.

No dependency graph, component tree explorer, flame chart, or hydration visualizer should be added
until the underlying event contract exists.

## Privacy And Safety

- Display only fields already present in `DevtoolsEvent`.
- Do not infer hidden values by reading DOM text, component props, store state, or reactive targets.
- Keep capture local to the inspected browser session.
- Do not persist events unless a separate storage design is approved.

## SSR/SSG/Hydration Dependency

The extension UI should not model SSR/SSG/hydration yet. Before adding hydration panels, the runtime
needs a separate event contract for:

- Hydration start/end.
- Hydration mismatch diagnostics.
- Server-collected style reuse.
- Client style dedupe conflicts.

Those events should be designed and covered by payload stability tests before the extension consumes
them.

## Testing Strategy

Design-only phase:

- Format docs with Prettier.
- Run `git diff --check`.
- Keep public API gates unchanged.

Future implementation phase:

- Unit test panel reducers and filters.
- Integration test the bridge with `createDevtoolsRecorder()`.
- Browser e2e smoke for opening the panel against an example app.
- Package boundary tests must continue to prove DevTools internals are private.

## Acceptance Criteria

- The extension UI is explicitly sequenced after SSR/SSG/hydration boundary stabilization.
- The UI consumes only `@italone/solace/devtools`.
- Runtime event payloads remain unchanged.
- Privacy limits remain visible in the UI design.
- Initial UI scope is limited to timeline, filters, pause/resume, clear, details, and recorder limit.
