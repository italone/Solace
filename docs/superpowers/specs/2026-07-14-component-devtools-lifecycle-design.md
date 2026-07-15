# Component DevTools Lifecycle Design

## Context

Solace has an internal DevTools event bus and emits `scheduler:flush` summaries. The next low-risk DevTools signal is
component lifecycle summaries: mount, update, and unmount. These can help future tooling build a component tree
timeline without exposing props, state, DOM nodes, or live component instances.

## Goals

- Emit `component:mount`, `component:update`, and `component:unmount` events through the internal DevTools event bus.
- Include only stable summary fields: numeric component id and component name.
- Keep DevTools APIs internal and out of package root exports.
- Preserve lifecycle hook order and existing component behavior.
- Avoid constructing event payloads when no DevTools listener is registered.

## Non-Goals

- Do not expose props, state, slots, provides, DOM nodes, VNodes, or component instances.
- Do not build a component tree inspector.
- Do not add public APIs or package exports.
- Do not emit async component loader state in this step.

## Design

Add internal fields/helpers in `src/component/component.ts`:

- `devtoolsId: number` on `ComponentInstance`.
- Monotonic ids assigned by `createComponentInstance`.
- `getComponentDevtoolsName(instance)` returning `instance.type.name || "AnonymousComponent"`.

Add helper in `src/renderer/diff.ts`:

```ts
function emitComponentDevtoolsEvent(
  type: "component:mount" | "component:update" | "component:unmount",
  instance: ComponentInstance,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type,
    id: instance.devtoolsId,
    name: getComponentDevtoolsName(instance),
  });
}
```

Emit after lifecycle hooks:

- mount: after `callHooks(instance.mounted)`,
- update: after `callHooks(instance.updated)`,
- unmount: after `callHooks(instance.unmounted)`.

## Testing

Use TDD:

- Add lifecycle test that registers a DevTools listener, mounts a named component, updates reactive state, unmounts,
  and asserts component events in order with the same id.
- Add anonymous component fallback test.
- Filter out `scheduler:flush` events in component tests because updates now also emit scheduler summaries.

## Risks

- Component names inferred from JavaScript function names can vary for anonymous functions. Use a documented fallback.
- Emitting after lifecycle hooks means user lifecycle code runs before DevTools observers see the event; this matches
  "completed lifecycle" semantics.
- Payloads must remain summaries to avoid stabilizing internal runtime structure.
