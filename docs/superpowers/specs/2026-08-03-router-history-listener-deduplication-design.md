# Router History Listener Deduplication Design

## Goal

Stabilize the existing browser history adapter contract so each listener is notified once per
location change, even when browsers emit more than one native event for the same hash navigation.

## Scope

This design applies only to the existing `createWebHistory()` and `createWebHashHistory()` adapters.
It does not add memory history, route names, aliases, route props, scroll behavior, SSR integration,
or any new public Router API.

## Public Contract

`RouterHistory` keeps its existing shape:

```ts
interface RouterHistory {
  location(): string;
  push(path: string): void;
  replace(path: string): void;
  listen(listener: () => void): () => void;
  back(): void;
  forward(): void;
}
```

For a listener registered through `listen()`:

- The adapter calls the listener when its normalized `location()` value changes because of a native
  browser history event.
- A second native event reporting the same normalized location does not invoke the listener again.
- Each listener maintains independent last-notified location state.
- Calling the returned cleanup function stops future callbacks and remains safe when called more
  than once.

`push()` and `replace()` retain their current behavior: they update browser state and do not invoke
registered listeners directly.

## Rationale

`createWebHashHistory()` subscribes to both `popstate` and `hashchange`. A browser back/forward
operation can dispatch both events for one location change. The Router already treats repeated
locations as no-ops, but direct consumers of the documented history adapter would still receive
duplicate callbacks. The adapter contract should protect all consumers at its boundary.

The same location-based rule applies to `createWebHistory()` so both adapters expose one coherent
listener contract. It also prevents repeated `popstate` events with unchanged path and query from
causing redundant router settlement.

## Design

`listen()` captures the normalized location returned by the adapter when registration begins. Each
native event handler reads the location again and compares it with the captured value.

When the location is unchanged, the handler returns without calling the listener. When it changed,
the handler stores the new value before invoking the listener. Storing first makes a synchronous
second event for the same location a no-op.

The web adapter keeps its single `popstate` subscription. The hash adapter keeps both `popstate` and
`hashchange` subscriptions; their shared handler performs the location comparison. Cleanup removes
the exact listeners currently registered and is naturally idempotent through
`removeEventListener()`.

No router-level logic, types, exports, or documentation API signatures change.

## Error Handling

The adapters do not catch listener exceptions. This preserves existing browser event behavior and
does not introduce an error-reporting channel into the beta contract.

## Testing

Unit tests in `tests/unit/router/history.test.ts` will verify:

1. Web history reports a `popstate` after the URL changes and ignores a repeated `popstate` for the
   same location.
2. Hash history reports one callback when `popstate` and `hashchange` are dispatched for the same
   changed hash location.
3. Hash history reports a later distinct location after the earlier duplicate pair.
4. Cleanup suppresses future callbacks after either adapter's listener is removed.

Existing read, push, replace, hash normalization, and cleanup coverage remains in place.

## Documentation

Update English and Simplified Chinese API documentation to state that history listeners are
location-based and suppress duplicate native events for an unchanged normalized location.

Update English and Simplified Chinese project status documentation to record the stabilized listener
contract and retain the deferred Router scope unchanged.
