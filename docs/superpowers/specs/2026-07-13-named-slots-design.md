# Named Slots Design

## Context

Solace components already receive `slots.default?.()` through `ComponentSetupContext`. README still
lists named slots and slot props as future component capabilities. This change adds named slots only,
using the same slot function model that default slots already use.

## Scope

Support component children passed as a slot function map:

```ts
h(Panel, null, {
  header: () => h("h1", null, "Title"),
  default: () => h("p", null, "Body"),
  footer: () => h("small", null, "Meta"),
});
```

Inside `Panel`, the setup context exposes:

```ts
slots.header?.();
slots.default?.();
slots.footer?.();
```

Plain component children continue to become `slots.default`, preserving the existing default slot
contract.

## Runtime Design

Types:

- `Slot` remains `() => VNodeChildren`.
- `Slots` becomes a string-keyed dictionary of optional `Slot` functions.
- Add a `VNodeSlots` type for component children that are named slot maps.
- Component `h()` and `createVNode()` overloads accept `VNodeChildren | VNodeSlots` for component
  children.

Runtime:

- `createVNode()` preserves slot objects when the vnode type is a component.
- Element and Fragment children keep existing string/array/VNode normalization behavior.
- `initSlots()` clears stale slot keys on each update.
- When children are a slot map, `initSlots()` copies each function-valued entry into
  `instance.slots`.
- When children are plain children, `initSlots()` keeps creating only `slots.default`.

## Testing

Use component unit tests to prove:

- A component can render multiple named slots.
- Missing named slots are omitted cleanly.
- Named slots update when component children change.
- Plain children still populate `slots.default`.

Package smoke should compile a consumer using a named slot map so the packed public types are
validated.

## Non-Goals

- Slot props.
- JSX-specific named slot syntax.
- Scoped slot fallback helpers.
- Runtime warnings for non-function slot map entries.
