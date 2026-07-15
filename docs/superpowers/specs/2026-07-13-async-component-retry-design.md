# Async Component Retry Design

## Context

`defineAsyncComponent()` already accepts loader functions and object options with
`loadingComponent`, `errorComponent`, `delay`, and `timeout`. README still lists async retry
options as future work. This change adds bounded automatic retry for failed async component loads.

## Scope

Extend `AsyncComponentOptions`:

```ts
defineAsyncComponent({
  loader,
  loadingComponent,
  errorComponent,
  delay: 200,
  timeout: 3000,
  retry: 2,
  retryDelay: 100,
});
```

`retry` is the number of extra attempts after the first failed loader attempt. `retryDelay` is the
wait before each retry and defaults to `0`.

## Runtime Design

Defaults:

- `retry` defaults to `0`, preserving current single-attempt behavior.
- `retryDelay` defaults to `0`.
- `delay` and `timeout` keep their current meanings and apply per attempt.

Failure handling:

- Loader rejection and timeout both count as failed attempts.
- If retries remain, the wrapper schedules another loader attempt after `retryDelay`.
- The wrapper stays in the loading path while retrying and does not render `errorComponent` until
  retries are exhausted.
- If a retry resolves successfully, the resolved component renders normally.
- If all attempts fail, the last failure becomes `loadError` and renders `errorComponent` when
  provided.
- Late resolution or rejection from an earlier timed-out attempt is ignored through an attempt id.

Rendering order stays:

1. Resolved component.
2. Error component or empty Fragment.
3. Loading component if visible.
4. Empty Fragment.

## Testing

Use Vitest to prove:

- A rejected loader retries after `retryDelay`.
- A later successful retry renders the resolved component instead of the error component.
- Exhausted retries render the error component.
- Timeout can trigger a retry, and a later attempt can resolve.
- Omitting `retry` keeps the current single-attempt rejection behavior.

## Non-Goals

- Manual retry UI.
- Exponential backoff.
- Passing retry metadata or error objects into `errorComponent`.
- Aborting user loader promises.
- Suspense integration.
