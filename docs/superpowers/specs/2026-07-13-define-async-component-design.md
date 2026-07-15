# Define Async Component Design

## Context

Solace now supports function components, `defineComponent()`, default slots, provide/inject, and component update scheduling. The remaining public API candidate in README is async components. Current component setup is synchronous, but a helper can wrap async loading without changing the renderer.

## Scope

Add a minimal public API:

```ts
const LazyMessage = defineAsyncComponent(() =>
  Promise.resolve((props: { text: string }) => h("p", null, props.text)),
);
```

The helper accepts a loader that resolves to a normal Solace component. Before the loader resolves, the async wrapper renders an empty Fragment. After it resolves, the wrapper triggers its own component update and renders the resolved component with the current props and default slot children.

## Runtime Design

`defineAsyncComponent(loader)` returns a normal `ComponentType<Props>`. The returned wrapper keeps module-scope state for the resolved component and pending load promise, so every mounted instance shares the same loader result.

The wrapper captures the current component instance during setup via `getCurrentInstance()`. Its render function starts the loader once, returns an empty Fragment while pending, and calls `instance.update?.()` after resolution. Because component props and slots are already stable mutable objects, resolved renders can pass the latest props and default slot children to the loaded component.

Loader rejection is intentionally small in this first version: the wrapper records the error, keeps rendering the empty Fragment, and does not retry automatically. Loading components, error components, delay, timeout, and retry hooks remain future extensions.

## Data Flow

1. User calls `defineAsyncComponent(loader)`.
2. Renderer mounts the returned wrapper like any other component.
3. Wrapper render starts `loader()` if no resolved component or pending promise exists.
4. Pending state renders `h(Fragment, null, [])`.
5. Loader resolution stores the component and schedules the wrapper instance update.
6. The next wrapper render returns `h(resolvedComponent, props, slots.default?.() ?? null)`.

## Testing

Add tests that prove:

- Initial pending render leaves the container empty.
- Resolving the loader and awaiting `nextTick()` renders the resolved component.
- Resolved components receive current props.
- Default slot children are forwarded to the resolved component.
- The loader runs once across parent rerenders.

Package and documentation tests should confirm the root API export and packed consumer type usage.

## Non-Goals

- Loading or error component options.
- Delay, timeout, retry, or suspensible behavior.
- Async setup for arbitrary components.
- Renderer-level Promise handling.
