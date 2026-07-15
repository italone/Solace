# DevTools Event Bus Design

## Context

`docs/devtools.md` recommends that Solace's first DevTools implementation step should be a minimal
development-only event model. The runtime currently has no DevTools hook module.

## Goals

- Add an internal DevTools event bus module.
- Keep it out of package root exports.
- Support listener registration, unsubscription, listener presence checks, and event emission.
- Ensure listener errors do not prevent later listeners from receiving the same event.
- Avoid connecting runtime modules to the bus in this step.

## Non-Goals

- Do not emit component, scheduler, renderer, reactivity, or store events yet.
- Do not add a public DevTools API.
- Do not build a UI, browser extension, Vite plugin, or overlay.
- Do not expose live internal component instances.

## API Shape

Internal module: `src/devtools/events.ts`

```ts
export type DevtoolsEvent =
  | { type: "component:mount"; id: number; name: string }
  | { type: "component:update"; id: number; name: string }
  | { type: "component:unmount"; id: number; name: string }
  | { type: "scheduler:flush"; queuedJobs: number; durationMs: number };

export type DevtoolsEventListener = (event: DevtoolsEvent) => void;

export function onDevtoolsEvent(listener: DevtoolsEventListener): () => void;
export function emitDevtoolsEvent(event: DevtoolsEvent): void;
export function hasDevtoolsListeners(): boolean;
export function clearDevtoolsListeners(): void;
```

`clearDevtoolsListeners` is internal test/support utility for deterministic cleanup; it should not be exported from
the package root.

## Error Handling

`emitDevtoolsEvent` should catch listener errors, continue notifying remaining listeners, and report each error via
`console.error`. This prevents one broken DevTools consumer from disabling all other instrumentation.

## Testing

Use TDD:

- Write tests that fail because `src/devtools/events.ts` does not exist.
- Implement the minimal module.
- Verify no-listener emission is safe.
- Verify listeners receive events in registration order.
- Verify unsubscribe removes a listener and updates `hasDevtoolsListeners`.
- Verify one throwing listener is reported and does not block later listeners.

## Documentation

Update `docs/devtools.md` so phase 2 records that the internal event bus now exists, while runtime hook integration
remains future work.
