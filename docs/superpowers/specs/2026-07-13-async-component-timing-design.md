# Async Component Timing Options Design

## Context

`defineAsyncComponent()` supports loader functions and object options with `loadingComponent` and `errorComponent`. README still lists async `delay`, `timeout`, and `retry` as future options. This change adds `delay` and `timeout` while keeping retry out of scope.

## Scope

Extend `AsyncComponentOptions`:

```ts
defineAsyncComponent({
  loader,
  loadingComponent,
  errorComponent,
  delay: 200,
  timeout: 3000,
});
```

`delay` controls when `loadingComponent` becomes visible. `timeout` converts a still-pending loader into an error state.

## Runtime Design

Defaults:

- `delay` defaults to `0`, preserving immediate loading behavior.
- `timeout` is disabled when omitted.

State:

- `isLoadingVisible` starts as `delay <= 0`.
- A delay timer sets `isLoadingVisible = true` and schedules the wrapper update.
- A timeout timer sets `loadError` and schedules the wrapper update only if the loader is still pending.
- Resolve/reject clears both timers.
- If timeout happens first, late resolve is ignored and does not replace the error state.

Rendering order stays:

1. Resolved component.
2. Error component or empty Fragment.
3. Loading component if visible.
4. Empty Fragment.

## Testing

Use Vitest fake timers to prove:

- Loading is hidden before `delay` and shown after `delay`.
- Loader resolving before `delay` renders the resolved component without showing loading.
- Timeout renders `errorComponent`.
- Late resolve after timeout does not replace the error view.
- Existing no-delay behavior remains covered by current tests.

## Non-Goals

- Retry options.
- Passing timeout error objects into error components.
- Suspense integration.
- Abort/cancellation of user loader promises.
