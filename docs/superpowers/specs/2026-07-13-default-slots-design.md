# Default Slots Design

## Context

Solace function components already receive props and an emit-capable setup context. VNodes also already preserve children as `VNodeChildren`, but component children are not exposed to component setup code. This leaves component composition awkward because wrapper components cannot render caller-provided content.

## Scope

Add minimal default slot support to the existing function component contract:

```ts
const Panel =
  (_props, { slots }) =>
  () =>
    h("section", null, slots.default?.() ?? null);

render(h(Panel, null, h("span", null, "content")), container);
```

This design intentionally supports only a default slot. Named slots and slot props remain out of scope for this change.

## Runtime Design

`ComponentSetupContext` gains a `slots` property. `slots.default` is present only when the component VNode has non-null children. Calling it returns the component VNode's normalized `children` value. The renderer keeps ownership of how returned `VNodeChildren` are patched through normal render output.

The component instance stores normalized slots so setup functions and render functions can read stable context state. On component VNode updates, props and slots are both refreshed from the next VNode before rerendering.

## Data Flow

1. `h(Component, props, children)` creates a component VNode with existing children normalization.
2. `setupComponent(instance)` initializes props and slots from the current VNode.
3. The component setup context exposes `{ emit, slots }`.
4. The component returns a VNode or render function that may call `slots.default?.()`.
5. `updateComponentProps(instance, nextVNode)` also refreshes slots so changed children appear in the next render.

## Testing

Add component tests that prove:

- A component can render default slot children.
- A component without children can use a fallback when `slots.default` is absent.
- Slot children update when a component VNode is patched with new children.

Validation commands:

- `pnpm test tests/unit/component/component.test.ts`
- `pnpm typecheck`
- `pnpm quality`
- `pnpm format:check`

## Non-Goals

- Named slots.
- Slot props.
- Compiler syntax for slots.
- Async component loading.
