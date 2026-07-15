# DevTools Recorder Boundary Design

## Context

Solace now has internal DevTools event summaries and a serializer that locks payload shape. The next step is a small
internal integration boundary that examples or experiments can use to observe events without turning DevTools into public
package API.

## Goals

- Add an internal `createDevtoolsRecorder()` helper in `src/devtools/events.ts`.
- Store serialized `DevtoolsEvent` payloads only.
- Expose `snapshot()` as a copy of collected events.
- Expose `stop()` to unsubscribe from the event bus.
- Keep the recorder internal and out of package root exports.

## Non-Goals

- Do not add package root exports or package export map entries.
- Do not add a browser extension, inspector UI, or public DevTools API.
- Do not persist, upload, or globally expose recorded events.
- Do not record raw event objects with extra fields.

## Design

Add:

```ts
export interface DevtoolsRecorder {
  snapshot(): DevtoolsEvent[];
  stop(): void;
}

export function createDevtoolsRecorder(): DevtoolsRecorder;
```

The recorder calls `onDevtoolsEvent()`, pushes `serializeDevtoolsEvent(event)` into an internal array, returns a shallow
copy from `snapshot()`, and uses the unsubscribe callback as `stop()`.

## Testing

- Add event bus unit coverage for recorder collection.
- Verify injected extra fields are stripped through serialization.
- Verify mutating a `snapshot()` result does not mutate recorder state.
- Verify `stop()` removes the listener and later events are ignored.

## Risks

- The helper is exported from the internal module for tests and future examples, but not from package root. Package export
  tests continue to guard the public API boundary.
