# Async Component Options Design

## Context

`defineAsyncComponent()` currently accepts a loader function and renders an empty Fragment until the loader resolves. The helper already tracks load errors internally, but users cannot render loading or error states. README now lists async loading/error options as a follow-up extension.

## Scope

Extend `defineAsyncComponent()` to support both existing loader functions and a small options object:

```ts
defineAsyncComponent(loader);

defineAsyncComponent({
  loader,
  loadingComponent: LoadingView,
  errorComponent: ErrorView,
});
```

Only `loadingComponent` and `errorComponent` are included. Delay, timeout, retry, and suspensible behavior remain out of scope.

## Runtime Design

The helper normalizes its input to an options object. Existing function input becomes `{ loader }`.

Rendering rules:

- If the loader has resolved, render the resolved component with current props and default slot children.
- If the loader rejected and `errorComponent` exists, render `errorComponent` with current props and default slot children.
- If the loader rejected and no `errorComponent` exists, render the empty Fragment.
- If loading is pending and `loadingComponent` exists, render `loadingComponent` with current props and default slot children.
- If loading is pending and no `loadingComponent` exists, render the empty Fragment.

The loader still runs once per async component type. Rejection stores the error and schedules the wrapper update so the error component can render.

## Testing

Add component tests for:

- Object options render `loadingComponent` while pending.
- Resolved component replaces `loadingComponent`.
- Rejected loader renders `errorComponent`.
- Existing loader-function API still renders empty pending output and resolved content.
- Loading/error components receive props and default slots through the same path as resolved components.

## Non-Goals

- Delay timers.
- Timeout handling.
- Retry APIs.
- Passing error objects as props.
- Error boundaries or Suspense.
