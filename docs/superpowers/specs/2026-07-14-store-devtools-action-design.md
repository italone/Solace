# Store DevTools Action Summary Design

## Context

Solace now has an internal DevTools event bus with scheduler flush summaries and component lifecycle summaries. The next
low-risk store signal is an action summary emitted after a store action finishes. This gives future tooling an action
timeline without exposing state, arguments, return values, or thrown error objects.

## Goals

- Emit a `store:action` event through the internal DevTools event bus for store action success and error outcomes.
- Include only stable summary fields: action `name`, `status`, and `durationMs`.
- Preserve the existing action return value and thrown error behavior.
- Avoid constructing event payloads or reading the timer when no DevTools listener is registered.
- Keep DevTools APIs internal and out of package root exports.

## Non-Goals

- Do not expose state, getters, action arguments, return values, or thrown errors.
- Do not add a public DevTools API.
- Do not emit getter recomputation or state path changes in this step.
- Do not support asynchronous action completion tracking yet; promise-returning actions are summarized when the action
  function returns the promise.

## Design

Extend `DevtoolsEvent` in `src/devtools/events.ts`:

```ts
{
  type: "store:action";
  name: string;
  status: "success" | "error";
  durationMs: number;
}
```

Wrap store actions in `src/store/store.ts`. If `hasDevtoolsListeners()` is false, run the action exactly as before. If a
listener exists, capture `performance.now()`, call the action, emit `status: "success"` after a normal return, or emit
`status: "error"` before rethrowing.

## Testing

- Add store unit coverage for a successful action summary.
- Add store unit coverage for a failed action summary and verify the original error is still thrown.
- Assert summary payloads do not contain args, result, error, or state fields.

## Risks

- Async actions currently report the time to return the promise, not to settle it. This matches the existing synchronous
  action contract and avoids changing return semantics.
- Action names are object keys and should remain serializable strings.
