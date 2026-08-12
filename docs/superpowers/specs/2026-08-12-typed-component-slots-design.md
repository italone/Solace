# Typed Component Slots Design

**Date:** 2026-08-12

**Target:** Precise component-side slot consumption through an opt-in slot map

## Goal

Add the first typed-slots slice to Solace's JSX/TSX-first component contract. A component declared
through `defineComponent<Props, Events, SlotMap>` should receive the exact declared slot names and
slot-prop signatures in its setup context. Components without an explicit slot map must retain the
existing permissive `Slots` behavior.

This slice types slot consumption inside a component only. It does not validate slot production at
JSX or `h()` call sites, require callers to provide declared slots, change runtime slot
normalization, or add runtime validation.

## Context

Solace currently exposes one broad slot contract:

```ts
export type SlotProps = Record<string, unknown>;
export type Slot = (props?: SlotProps) => VNodeChildren;

export interface Slots {
  default?: Slot;
  [name: string]: Slot | undefined;
}

export interface ComponentSetupContext<Events extends ComponentEventMap = ComponentEventMap> {
  emit: EmitFn<Events>;
  slots: Slots;
}
```

The runtime already supports default, named, and scoped slots. The broad type correctly models
legacy components, but it cannot reject unknown slot names or infer scoped-slot properties inside a
component. The completed typed emit and typed listener slices establish the compatible pattern:
explicit finite metadata is strict, while omitted metadata keeps the historical open contract.

## Selected Approach

Add a second generic to `ComponentSetupContext` and a third generic to `ComponentType` and
`defineComponent`:

```ts
type PanelSlots = {
  default?: (props: { label: string }) => VNodeChildren;
  header?: () => VNodeChildren;
};

const Panel = defineComponent<object, ComponentEventMap, PanelSlots>(
  (_props, { slots }) => (
    <section>
      <header>{slots.header?.()}</header>
      <main>{slots.default?.({ label: "Details" })}</main>
    </section>
  ),
);
```

The public generic order is deliberately additive:

```ts
ComponentSetupContext<Events, SlotMap>;
ComponentType<Props, Events, SlotMap>;
defineComponent<Props, Events, SlotMap>(component);
```

`Events` remains the second generic, preserving every existing explicit typed-event call. Consumers
that only want typed slots use `ComponentEventMap` for the event position. Reordering or overloading
the generic positions would make the public declaration ambiguous and is outside this slice.

## Slot Map Constraint

An explicit slot map contains only optional or required functions whose return values are
`VNodeChildren`. Its function parameters remain exact, so zero-argument and scoped slots can coexist:

```ts
type SlotMapConstraint<SlotMap extends object> = {
  [Name in keyof SlotMap]: ((...args: never[]) => VNodeChildren) | undefined;
};

interface ComponentSetupContext<
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends SlotMapConstraint<SlotMap> = Slots,
> {
  emit: EmitFn<Events>;
  slots: SlotMap;
}
```

The implementation may use an equivalent self-mapped constraint so concrete type aliases and
interfaces do not need a string index signature. The constraint is internal and must not become a
new package-root helper export.

The existing exported `Slot`, `SlotProps`, and `Slots` names remain unchanged. `Slots` stays the
default open map for compatibility.

## Strict And Permissive Consumption

With an explicit finite slot map, `context.slots` is that exact map:

- declared names retain their optional or required modifier;
- each slot function retains its exact parameter list and return type;
- unknown slot names fail TypeScript checking;
- missing or incompatible scoped-slot arguments fail TypeScript checking;
- zero-argument slots reject unexpected arguments.

Without an explicit slot map, `context.slots` remains the current `Slots` interface. Arbitrary named
slots and `Record<string, unknown>` slot props remain valid.

An explicit empty map is strict and exposes no slots. This mirrors the finite empty event-map rule.

## Required Slot Boundary

A required property in an explicit slot map makes that property non-optional inside the component:

```ts
type RequiredSlots = {
  default: (props: { label: string }) => VNodeChildren;
};
```

This is a component-author assertion in the first phase. JSX and `h()` producers remain broad, so a
caller is not yet required to supply the slot. Omitting a required slot can therefore still fail at
runtime if the component invokes it directly. Public examples should prefer optional slots until a
separate producer-validation design closes that gap.

This limitation must be documented rather than hidden behind runtime fallback behavior or a wider
implementation.

## Type Propagation

`ComponentType<Props, Events, SlotMap>` carries slot metadata in its setup-context parameter. The
runtime continues to erase concrete metadata at storage boundaries, just as it already erases event
maps:

- `ComponentInstance.slots` remains the existing broad `Slots` object;
- `initSlots()` and `isVNodeSlots()` remain unchanged;
- VNode runtime data and shape flags remain unchanged;
- component setup still receives the same runtime object;
- no slot names or prop schemas are stored at runtime.

Internal component-erasure positions may use the same narrowly scoped type erasure already used for
events. This must not make Router, SSR, async components, DevTools, or application roots aware of
slot maps.

Every overload or transport union that accepts `ComponentType` must remain assignable from a
typed-slot component. Where the signature preserves component metadata, it should infer and forward
the third generic. Where the runtime intentionally erases metadata, it should erase the third generic
alongside the event map. In particular:

- `createVNode()` and `h()` component overloads infer `SlotMap` only to accept the component; their
  `children` parameter remains broad `ComponentVNodeChildren`;
- `jsx()`, `jsxs()`, and `jsxDEV()` infer `SlotMap` only to keep the component assignable; their props
  continue to depend on `Props` and `Events`, not slots;
- `VNodeType` and component-instance storage erase the slot map so runtime containers do not become
  generic;
- Router, SSR, application, and async-component public signatures keep their existing broad
  `ComponentType` surface.

## JSX And Listener Compatibility

The third component generic must not regress the completed listener contract. JSX type extraction
continues to preserve TypeScript's instantiated `Props`, extracts `Events` for listener management,
and ignores the inferred slot map after using it to match the component. Slot metadata does not
change JSX props in this phase. Matching a component against `ComponentType` with the default broad
`Slots` generic would be incorrect because function-parameter variance can make an exact slot map
incompatible with that default and silently select the permissive JSX fallback.

The following behavior remains unchanged:

- JSX children become the runtime `default` slot;
- JSX does not require or validate declared slots;
- direct `jsx()`, `jsxs()`, and `jsxDEV()` props keep their current listener contract;
- ordinary and generic function-component props inference remains intact;
- `h()` component children remain `ComponentVNodeChildren`;
- named and scoped slot objects passed to `h()` remain broad.

## Runtime Behavior

There is no runtime implementation in this slice. Existing tests already cover:

- default slot rendering and omission;
- named slot rendering and updates;
- default and named scoped-slot props;
- slot props changing across component rerenders;
- async components forwarding current slot children.

Those tests remain regression coverage. The type change must not alter emitted JavaScript or runtime
slot dispatch.

## Alternatives Considered

### Type Consumers And Producers Together

Propagating `SlotMap` into `VNodeSlots`, `ComponentVNodeChildren`, `createVNode()`, `h()`, JSX
children, and async components would provide end-to-end enforcement. It would also cross most
component transport boundaries at once and force an immediate policy for required JSX children,
named-slot JSX syntax, async wrappers, and generic component inference. That is too broad for the
next contract-hardening slice.

### Add A Separate `defineSlots()` Helper

A setup helper could infer slots without extending `ComponentType`, but Solace has no setup macro
model and the helper would need ambient current-component state or a compile transform. It would add
runtime/API surface without improving package-boundary component metadata.

### Keep Slots Permanently Broad

This preserves compatibility but leaves named and scoped slot consumption as unchecked
`Record<string, unknown>` access. It would make the typed component contract asymmetric after emits
and listeners became opt-in strict.

## Type Error Behavior

For:

```ts
type PanelSlots = {
  header?: () => VNodeChildren;
  default?: (props: { label: string; count?: number }) => VNodeChildren;
};
```

TypeScript must accept:

```ts
slots.header?.();
slots.default?.({ label: "Details" });
slots.default?.({ label: "Details", count: 1 });
```

It must reject:

```ts
slots.missing?.();
slots.header?.({ label: "unexpected" });
slots.default?.();
slots.default?.({ label: 1 });
slots.default?.({ label: "Details", count: "1" });
```

A component using the default context must continue accepting arbitrary slot names and broad slot
props.

## Test Strategy

Follow TDD with source and installed-package TypeScript contracts before changing public types.

### Source Contract

Extend the existing JSX public contract type file or add a focused component public-contract type
file if that keeps failure causes clearer. Cover:

- exact default and named slot access;
- zero-argument, required-prop, and optional-prop slots;
- unknown slot names;
- missing, extra, and incompatible slot props;
- an explicit empty slot map;
- direct `ComponentSetupContext<Events, SlotMap>` usage;
- `defineComponent<Props, Events, SlotMap>` preserving typed emits and typed slots together;
- an untyped component retaining arbitrary named slots and broad props;
- ordinary and generic function-component JSX inference remaining unchanged;
- existing strict listener names and payloads remaining unchanged.

Compile the contract under both `react-jsx` and `react-jsxdev`.

### Packed Consumer Contract

Extend `scripts/package-consumer-smoke.mjs` with the same positive and `@ts-expect-error` slot
consumption cases against the installed tarball. This proves the third `ComponentType` generic and
the second `ComponentSetupContext` generic survive declaration generation without changing package
exports.

### Runtime Regression

Run the focused component slot tests together with the type contract. No new runtime assertions are
required unless the type refactor unexpectedly needs a runtime edit, which would require revisiting
this design.

## Documentation

Update the existing English API, Chinese API, and package usage documents. Explain:

- typed slots are opt-in through the third `defineComponent` generic;
- explicit maps type component-side consumption only;
- undeclared components retain permissive slots;
- optional, named, and scoped slots retain exact signatures;
- required slots are author assertions and are not yet enforced at call sites;
- JSX children, `h()` slot objects, runtime validation, and async producer typing remain unchanged.

README, project positioning, Router, SSR/SSG/hydration, SFC, DevTools, compatibility, release, and
version documents remain unchanged unless an existing sentence directly contradicts this contract.

## Validation

Minimum focused validation:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  tests/unit/component/component.test.ts
pnpm test:package
pnpm package:smoke
```

Final slice validation:

```bash
pnpm quality
pnpm package:smoke
git diff --check
```

`pnpm release:check`, browser E2E, benchmarks, registry smoke, npm publish, Git tags, and npm
dist-tags remain outside this type-only slice.

## Acceptance Criteria

- `ComponentSetupContext<Events, SlotMap>` exposes exact declared slot names and signatures.
- `ComponentType<Props, Events, SlotMap>` and `defineComponent<Props, Events, SlotMap>` preserve the
  slot map in public declarations.
- Explicit slot maps reject unknown consumption and incompatible scoped-slot arguments.
- Optional and required slot modifiers are preserved inside the component.
- Components without an explicit slot map retain the current permissive `Slots` contract.
- Typed emits and typed JSX listeners continue to work on the same component.
- Ordinary and generic function-component JSX props inference remains unchanged.
- JSX and `h()` slot producers remain broad and do not enforce required slots in this phase.
- Runtime slot normalization, async components, VNodes, Router, SSR, SFC, and DevTools remain
  unchanged.
- English and Chinese documentation describe the consumer-only boundary and required-slot caveat.
- Package version, exports, CI, Changesets, and release commands remain unchanged.

## Risks

The primary risk is accidentally treating required slots as caller-enforced when producer typing is
deferred. Tests and documentation must keep that boundary explicit. The second risk is regressing
typed listeners or generic JSX props while adding a third `ComponentType` generic. Existing listener
and generic-component contracts must stay in the typecheck and packed smoke. The third risk is
forcing explicit slot maps to declare a string index signature; the constraint must validate each
declared key without widening finite maps. The fourth risk is leaking slot metadata into runtime or
async component transport, which would expand this type-only slice.
