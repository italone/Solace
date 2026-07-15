# DevTools Recorder Example Smoke Design

## Context

Solace now has an internal DevTools recorder that stores serialized events. The next low-risk step is to validate that
the recorder can support an example-shaped interaction without requiring a public API or modifying example source files.

## Goals

- Add `clear()` to the internal `DevtoolsRecorder` so examples can ignore initial mount noise.
- Add an integration smoke for a todo-style component and store interaction.
- Verify recorder snapshots remain serialized and do not expose raw runtime objects.
- Keep the recorder internal and out of package root exports.

## Non-Goals

- Do not modify example app source files.
- Do not add a public DevTools API or package export.
- Do not add a browser extension, inspector UI, persistence, or network upload.
- Do not expose DOM nodes, VNodes, props, children, state, action args, or raw reactive targets.

## Design

Extend `DevtoolsRecorder`:

```ts
interface DevtoolsRecorder {
  clear(): void;
  snapshot(): DevtoolsEvent[];
  stop(): void;
}
```

The `clear()` method empties the recorder's internal event array without unsubscribing. This lets an example smoke render
an app, clear initial mount events, run one user-style interaction, and inspect only the interaction window.

The smoke test creates a todo-style store and component, renders it, clears the recorder, clicks an add button, awaits
`nextTick()`, and asserts the recorder captured reactivity, store, renderer, component, and scheduler events with
JSON-safe payloads.

## Testing

- Add unit coverage proving `clear()` does not stop the recorder.
- Add `tests/integration/devtools-recorder-example-smoke.test.ts`.
- Run targeted, full, package, e2e, and format gates.

## Risks

- Event ordering reflects the current renderer update flow. If renderer semantics change, update the smoke intentionally.
- The test imports internal modules directly; this is deliberate because the recorder is not public API.
