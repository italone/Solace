# Typed Component Listener Inference Design

**Date:** 2026-08-12

**Target:** Precise JSX listener payloads for components with an explicit event map

## Goal

Complete the consumer side of the opt-in typed emit contract. A component declared through
`defineComponent<Props, Events>` should expose only the JSX listeners derived from `Events`, with
each listener receiving the event's declared argument tuple. Components without an explicit event
map must retain the existing permissive `onXxx` behavior.

This is a JSX/TSX type-only slice. It does not change runtime event dispatch, `h()` props, component
instances, DevTools payloads, package entries, or the package version.

## Context

The producer-side contract now stores `Events` on `ComponentType<Props, Events>` and strictly types
component setup `emit()` calls. JSX component props are still broad:

```ts
type JSXComponentProps<Props extends object> = Props & {
  children?: JSXChildren;
} & {
  [eventHandler in `on${string}`]?: JSXEventHandlerValue;
};
```

The global `JSX.IntrinsicAttributes` interface also accepts every `on${string}` attribute. As a
result, `defineComponent<Props, Events>` retains its event map but JSX does not use it to validate
listener names or payloads.

## Selected Approach

Derive listener props inside the JSX type boundary and apply them through both factory overloads and
`JSX.LibraryManagedAttributes`.

For an explicit event map:

```ts
type CounterEvents = {
  increment: [count: number];
  reset: [];
  "value-change": [value: number];
};
```

the component JSX surface becomes equivalent to:

```ts
type CounterListeners = {
  onIncrement?: ((count: number) => unknown) | Array<(count: number) => unknown>;
  onReset?: (() => unknown) | Array<() => unknown>;
  onValueChange?: ((value: number) => unknown) | Array<(value: number) => unknown>;
};
```

The listener return type remains `unknown` because runtime dispatch ignores listener return values.
Listener arrays retain the existing runtime contract.

## Strict And Permissive Components

The existing default is `ComponentEventMap = Record<string, readonly unknown[]>`. The type system can
distinguish that open map from an explicit finite event map through `string extends keyof Events`:

- when true, keep the existing broad `on${string}` listener contract;
- when false, derive only listeners from the explicit event keys.

This preserves existing components declared without an event generic, including ordinary one-argument
function components used directly in TSX. An explicit empty event map is strict and adds no listener
attributes beyond listeners already declared in `Props`.

## Event Name Mapping

Listener keys follow the runtime `resolveEmitHandler()` path:

- `increment` maps to `onIncrement`;
- `value-change` maps to `onValueChange`;
- the type contract accepts only the canonical camelized listener for a kebab-case event.

The type-level camelization should mirror the runtime's ASCII `-(\w)` replacement, including letters,
digits, and underscore, rather than removing every hyphen unconditionally. Event maps must not declare
two names that canonicalize to the same listener key, such as `value-change` and `valueChange`; such a
map is ambiguous because both runtime events resolve to one prop and is outside this slice's supported
contract.

## Props Collision Rule

For explicitly typed events, derived event listeners own their canonical prop names. JSX props use
the equivalent of:

```ts
Omit<Props, keyof ComponentListenerProps<Events>> & ComponentListenerProps<Events>;
```

If `Props` declares `onIncrement` with a conflicting payload, the listener derived from
`Events.increment` replaces it. Other declared callback props, such as `onFocus`, remain unchanged and
valid even when they start with `on`.

For components using the permissive default event map, keep the current `Props` intersection with the
broad listener index instead of replacing explicitly declared callback props.

## JSX Integration

The implementation should centralize the shared listener types so `jsx`, `jsxs`, and `jsxDEV` use the
same contract.

Two integration points are required:

1. Direct `jsx()` / `jsxs()` / `jsxDEV()` component overloads use
   `JSXComponentProps<Props, Events>`.
2. `JSX.LibraryManagedAttributes<Component, Props>` extracts `Props` and `Events` from
   `ComponentType` and applies the same managed props to automatic TSX expressions.

The broad `on${string}` index must be removed from `JSX.IntrinsicAttributes`; leaving it there would
allow unknown listeners on strict components and bypass the managed contract. `IntrinsicAttributes`
continues to own `key` and `children`. Broad listener compatibility moves to the permissive component
branch of `LibraryManagedAttributes`.

DOM intrinsic element listeners remain unchanged: a DOM `onXxx` value is still one function, not a
function array, and this slice does not add DOM event-object inference.

## Alternatives Considered

### Export `ComponentListenerProps`

This would let consumers reuse the derived listener object type directly, but it would add a new root
public type before there is demonstrated non-JSX demand. Keep the helper internal to the JSX type
implementation.

### Brand Components With Listener Metadata

A branded component could make explicit and default event maps easier to distinguish, but it would
change the function component type identity and propagate metadata through Router, SSR, async
components, and other runtime containers. The existing `ComponentType<Props, Events>` already carries
enough compile-time information.

### Keep All Listeners Broad

Editor hints alone would avoid new errors, but unknown listener names and incompatible payloads would
still compile. That would not complete the typed consumer contract.

## Type Error Behavior

For a component with `increment: [count: number]` and `"value-change": [value: number]`, TypeScript
must reject:

```tsx
<Counter onIncrement={(count: string) => count} />;
<Counter onMissing={() => undefined} />;
<Counter onValueChange={(value: string) => value} />;
```

It must accept:

```tsx
<Counter onIncrement={(count: number) => count} />;
<Counter onIncrement={[(count: number) => count]} />;
<Counter onValueChange={(value: number) => value} />;
```

An untyped component continues to accept arbitrary function or function-array `onXxx` attributes.
Non-function listener values remain rejected for both strict and permissive components.

## Test Strategy

Follow TDD with source and packed-consumer TypeScript contracts before changing JSX types.

### Source Contract

Extend the existing JSX public contract test to cover:

- correct zero-, one-, optional-, and rest-argument listeners;
- listener function arrays;
- incompatible listener payloads;
- unknown listeners on an explicitly typed component;
- canonical kebab-case-to-camelized listener names;
- the event-map-wins collision rule;
- unrelated `onXxx` props declared in `Props`;
- permissive legacy and ordinary function components.

Run both normal and JSX development typechecks because automatic `jsx` and `jsxDEV` modes must share
the contract.

### Packed Consumer Contract

Extend `scripts/package-consumer-smoke.mjs` with positive and `@ts-expect-error` listener cases against
the installed tarball. This verifies that generated `jsx-runtime.d.ts` and
`jsx-dev-runtime.d.ts` preserve `LibraryManagedAttributes` and the factory overloads.

### Runtime Regression

Keep existing lifecycle coverage for listener functions, listener arrays, and kebab-case resolution.
No new runtime behavior is introduced.

## Documentation

Update the existing English API, Chinese API, and package usage documents. Replace the current
statement that precise `onXxx` payload inference is deferred with the new opt-in behavior, while
retaining these qualifications:

- strict listener inference requires an explicit event map;
- undeclared components remain permissive;
- runtime validation is still absent;
- `h()` retains its existing props contract;
- listener arrays remain supported.

README, project positioning, Router, SSR/SSG/hydration, SFC, DevTools, compatibility, release, and
version documents remain unchanged unless an existing sentence directly contradicts the new public
contract.

## Validation

Minimum focused validation:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts
pnpm test:package
pnpm package:smoke
```

Final slice validation:

```bash
pnpm quality
pnpm package:smoke
git diff --check
```

`pnpm release:check`, browser E2E, benchmarks, registry smoke, npm publish, Git tags, and npm dist-tags
remain outside this type-only slice.

## Acceptance Criteria

- Explicit `defineComponent<Props, Events>` components infer canonical JSX listener names and exact
  tuple payloads.
- Listener functions and arrays both use the event tuple.
- Unknown listeners and incompatible payloads fail TypeScript checking on strict components.
- Kebab-case events map only to canonical camelized JSX listeners.
- Derived event listeners replace conflicting listener declarations in `Props`; unrelated declared
  callbacks remain valid.
- Components without an explicit event map retain arbitrary function or function-array `onXxx`
  attributes.
- Direct factories, automatic JSX, and JSX development mode share the same contract in source and
  packed declarations.
- DOM listener behavior and all runtime component event behavior remain unchanged.
- English and Chinese documentation describe the opt-in boundary accurately.
- Package version, exports, CI, release commands, Router, SSR, SFC, and DevTools remain unchanged.

## Risks

The primary risk is leaving the broad `IntrinsicAttributes` listener index in place and silently
bypassing strict listeners. Source negative tests must prove unknown listeners fail. The second risk
is making ordinary or untyped function components strict; explicit legacy cases protect that branch.
The third risk is type-level camelization drifting from runtime handler resolution; kebab-case source
and runtime tests cover the supported mapping. The fourth risk is generated declarations losing
`LibraryManagedAttributes`; the installed tarball consumer protects that boundary.
