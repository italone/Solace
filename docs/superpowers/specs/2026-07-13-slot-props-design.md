# Slot Props Design

## Context

Solace components support default slots and named slots through slot functions. Each slot currently
has the type `() => VNodeChildren`, so child components can render a slot but cannot pass scoped data
back to the slot function in a typed way.

## Scope

Allow slot functions to receive a single optional props object:

```ts
h(List, null, {
  item: (props) => h("li", null, String(props?.value)),
});
```

Inside `List`, a component can pass slot props when invoking the slot:

```ts
slots.item?.({ value: "Ada" });
```

Existing no-argument slot calls remain valid:

```ts
slots.default?.();
```

## Runtime Design

Types:

- Add `SlotProps = Record<string, unknown>`.
- Change `Slot` to `(props?: SlotProps) => VNodeChildren`.
- Keep `Slots` as a string-keyed dictionary of optional slots.
- Keep `VNodeSlots` as a string-keyed slot dictionary, now using the updated `Slot` signature.

Runtime:

- No new renderer behavior is required. JavaScript already allows calling a function with an
  argument.
- `initSlots()` continues copying slot functions into `instance.slots`.
- Existing default and named slot behavior remains unchanged.

## Testing

Use component unit tests to prove:

- A named slot receives props from the child component.
- A default slot receives props from the child component.
- Slot props update when the child component rerenders with new reactive data.
- Existing no-argument slots continue to render.

Package smoke should compile a consumer using slot props so packed public types are validated.

## Non-Goals

- Strongly typed generic slot contracts per component.
- Multiple slot arguments.
- JSX-specific scoped slot syntax.
- Runtime validation of slot props.
