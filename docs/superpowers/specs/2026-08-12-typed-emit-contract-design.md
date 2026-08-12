# Typed Emit Contract Design

**Date:** 2026-08-12

**Target:** Opt-in component event typing for the JSX/TSX-first public component model

## Goal

Add an incremental TypeScript contract that lets a component declare its emitted event names and
argument tuples. Explicitly typed components must reject unknown event names, missing arguments,
extra arguments, and incompatible payloads inside component setup. Components that do not declare an
event map must retain the current permissive `emit(event, ...args)` behavior.

This is the first JSX/TSX ergonomics slice after the beta.4 contract-stable release. It does not add
typed slots, infer precise JSX `onXxx` listener props, change runtime event dispatch, add a package
entry, or change the package version.

## Context

The runtime already supports component events through `ComponentSetupContext.emit`. Event names are
resolved to `onXxx` props, kebab-case names are camelized, listener arrays are supported, and
DevTools receives payload-free event summaries. The public types are intentionally broad today:

```ts
export type EmitFn = (event: string, ...args: unknown[]) => void;

export interface ComponentSetupContext {
  emit: EmitFn;
  slots: Slots;
}
```

This preserves flexibility but gives explicitly modeled components no help with event spelling or
payload shape. The JSX runtime also accepts any function or function array for any `on${string}`
component prop. Tightening both producer and listener sides at once would make the first slice larger
and harder to keep backward compatible.

## Selected Approach

Use an event map whose keys are event names and whose values are readonly argument tuples:

```ts
type CounterEvents = {
  increment: [count: number];
  reset: [];
  rename: [name: string, source?: "user" | "sync"];
};

const Counter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => {
  emit("increment", props.count);
  emit("reset");
  emit("rename", "Ada", "user");

  return <button>{props.count}</button>;
});
```

The event map is stored in the returned component type. `ComponentSetupContext<Events>` uses the same
map for `emit`, so it also remains usable when a consumer needs to annotate a context directly. Every
new generic has a permissive default, preserving existing source that uses `ComponentSetupContext`,
`ComponentType<Props>`, or inferred `defineComponent(...)` without an explicit event map.

## Alternatives Considered

### Annotate only `ComponentSetupContext<Events>`

This is the smallest local change and can type `emit` inside one function, but the returned component
does not retain the event contract. A later JSX listener inference slice would have no stable type to
inspect. Keep direct context annotation available, but make `defineComponent<Props, Events>` the
recommended declaration path.

### Infer emitted events from `onXxx` props

This avoids an explicit event-map generic, but reverses the ownership relationship: child emit
behavior would depend on optional parent listener props. Event-name camelization, kebab-case names,
optional handlers, and handler arrays also make the inference ambiguous. Do not derive producer
contracts from consumer props.

### Add runtime event declarations

A Vue-style runtime `emits` option could validate events and carry metadata, but it would change the
runtime API and require a broader component definition object. The current problem is TypeScript
ergonomics, so runtime metadata is unnecessary in this slice.

## Public Type Contract

The root package will export these additive types through the existing `.` entry:

```ts
export type ComponentEventMap = Record<string, readonly unknown[]>;

export type EmitFn<Events extends ComponentEventMap = ComponentEventMap> = <
  Event extends keyof Events & string,
>(
  event: Event,
  ...args: Events[Event]
) => void;

export interface ComponentSetupContext<Events extends ComponentEventMap = ComponentEventMap> {
  emit: EmitFn<Events>;
  slots: Slots;
}
```

The exact implementation may use a mapped callable union or an equivalent generic function if
TypeScript requires it to preserve tuple correlation. The observable contract is fixed:

- event keys are strings;
- each event value is a readonly tuple or readonly array of arguments;
- `[]` represents an event with no payload;
- optional and rest tuple elements follow normal TypeScript call rules;
- an explicitly typed map rejects event names outside its keys;
- the default map accepts any string event with any arguments.

`ComponentType` and `defineComponent` become event-aware while keeping defaults:

```ts
export type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
> = (props: Props, context: ComponentSetupContext<Events>) => ComponentRender | VNode;

export function defineComponent<
  Props extends object,
  Events extends ComponentEventMap = ComponentEventMap,
  Result extends ComponentRender | VNode = ComponentRender | VNode,
>(
  component: (props: Props, context: ComponentSetupContext<Events>) => Result,
): ComponentType<Props, Events>;
```

The implementation plan must verify whether generic ordering needs a helper overload to preserve
return-type inference when callers provide `Props` and `Events`. It must not require callers to supply
a third result generic. Existing inferred calls such as `defineComponent((props: { label: string },
context) => ...)` remain valid.

## Internal Type Propagation

The event generic must survive the public component type without changing runtime storage:

- `ComponentType<Props, Events>` carries the setup context type.
- `VNodeType`, component instances, renderer internals, and async component internals may erase the
  event map to the permissive default or `never` where they only invoke runtime functions.
- Internal casts remain implementation details and must not leak a new public deep import.
- `ComponentInstance.emit` stays operationally broad because runtime dispatch accepts dynamic string
  names; strictness belongs to the component's setup context exposed to TypeScript.

This slice does not require runtime inspection of type parameters, emitted event registration, new
DevTools fields, or event-name validation.

## JSX Boundary

The typed event map is retained on `ComponentType` so a later slice can derive listener props such as
`onIncrement?: ((count: number) => unknown) | Array<...>`. That later behavior is explicitly deferred.

For this slice:

- the current generic `on${string}` JSX component attribute remains available;
- listener functions and listener arrays retain their existing accepted shape;
- non-function listener values remain rejected;
- no new mapping between kebab-case event keys and JSX prop casing is designed;
- runtime listener resolution and listener-array dispatch remain unchanged.

Keeping producer typing and listener inference separate limits the public blast radius and provides a
clear rollback boundary if TypeScript inference proves unstable.

## Type Error Behavior

All new failures are compile-time TypeScript errors. Explicit event maps must reject:

```ts
emit("missing");
emit("increment");
emit("increment", "1");
emit("reset", 1);
emit("rename", "Ada", "invalid-source");
```

The implementation does not add runtime exceptions for these calls. JavaScript consumers and code
that intentionally uses the permissive default retain the current behavior.

## Test Strategy

Follow TDD with TypeScript contract tests before production type changes.

### Source Contract

Extend `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx` with:

- a `CounterEvents` map containing zero-, one-, and multi-argument events;
- valid `emit` calls for every tuple shape;
- `@ts-expect-error` cases for unknown names, missing arguments, extra arguments, and incompatible
  payloads;
- an untyped component that still emits an arbitrary event and payload;
- a direct `ComponentSetupContext<CounterEvents>` annotation proving the public type works without
  `defineComponent`.

Run `pnpm typecheck` before implementation and verify that it fails because the new generic public
contract does not exist. After implementation it must pass with every `@ts-expect-error` consumed.

### Runtime Regression

Retain the existing Vitest coverage for listener functions, listener arrays, kebab-case event names,
and DevTools summaries. No new runtime behavior test is required solely for erased types, but the
focused renderer/component tests must remain green.

### Packed Consumer Contract

Update `scripts/package-consumer-smoke.mjs` so its generated TypeScript consumer imports
`ComponentEventMap`, declares a typed component through the built package, exercises valid event
tuples, and includes at least unknown-event and wrong-payload `@ts-expect-error` cases. This proves
the Rollup-generated declarations retain the event map instead of only validating source aliases.

Run `pnpm test:package` and `pnpm package:smoke` after the source typecheck is green.

## Documentation

Update the existing component API and package-usage documents:

- `docs/api.md` and `docs/api.zh-CN.md`;
- `docs/package-usage.md`.

The repository does not currently have a `docs/package-usage.zh-CN.md`; this slice must not create a
partial new guide solely for typed emit. The Chinese API guide owns the matching Chinese usage
example.

Documentation must:

- show `defineComponent<Props, Events>` with tuple event maps;
- explain the permissive default for undeclared events;
- distinguish compile-time producer typing from runtime dispatch;
- state that precise JSX listener inference is not part of this slice;
- avoid describing Solace as React-compatible or changing its JSX/TSX-first independent identity.

README, Router, SSR/SSG, SFC, DevTools, compatibility, version, changelog, Changesets, and release
documents remain unchanged unless a test reveals an existing direct contradiction.

## Validation

Minimum focused validation:

```bash
pnpm typecheck
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts
pnpm test:package
pnpm package:smoke
```

Final slice validation:

```bash
pnpm quality
pnpm format:check
git diff --check
```

`pnpm release:check` is not required for this type-only implementation checkpoint because no release
is being prepared. It becomes mandatory before a later version or publication decision. Browser E2E,
benchmarks, registry smoke, npm publish, Git tag changes, and dist-tag changes are outside this slice.

## Files and Boundaries

Expected implementation files:

- modify `src/component/component.ts`;
- modify `src/component/define-component.ts`;
- modify `src/vnode/vnode.ts`;
- modify `src/index.ts`;
- modify `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`;
- modify `scripts/package-consumer-smoke.mjs`;
- modify the three existing API and package-usage documents;
- add the implementation plan and project-log evidence required by the repository workflow.

Files may be narrowed during planning if TypeScript propagation does not require every expected
source file. Explicitly unchanged:

- JSX runtime dispatch and child normalization;
- component runtime event resolution and listener arrays;
- package exports and protected entry count;
- Router, SSR/SSG/hydration, SFC/Vite, and DevTools behavior;
- package version, changelog, Changesets, npm dist-tags, and Git release tags;
- CI and release command composition.

## Acceptance Criteria

- `defineComponent<Props, Events>` supports readonly tuple event maps without a required third
  generic.
- Explicitly typed components accept correct zero-, one-, optional-, rest-, and multi-argument event
  calls.
- Explicitly typed components reject unknown event names, missing/extra arguments, and incompatible
  payloads during TypeScript checking.
- Existing components with no event map retain permissive emit calls and current JSX listener
  behavior.
- `ComponentEventMap`, generic `EmitFn`, generic `ComponentSetupContext`, and event-aware
  `ComponentType` are available from the existing root package type surface.
- Generated package declarations preserve the contract in a packed consumer.
- Runtime event dispatch, listener arrays, kebab-case resolution, and DevTools summaries do not
  change.
- English API/package-usage documentation and the Chinese API documentation describe the opt-in
  boundary accurately.
- Focused validation, package validation, packed smoke, quality, formatting, and diff checks pass.
- No version, export, release, tag, dist-tag, CI, Router, SSR, SFC, or DevTools scope expansion occurs.

## Risks

The primary risk is losing the event map while converting a function into `ComponentType` or while
generating declarations. Source type tests plus packed-consumer checks cover both boundaries. The
second risk is accidentally making the default event map restrictive; an explicit legacy-compatible
test protects untyped components. The third risk is generic ordering degrading `defineComponent`
return inference; the design requires callers to provide only `Props` and `Events`, and the plan must
test this exact syntax before implementation. The final risk is prematurely tightening JSX listener
props; that work remains a separate design and must not be inferred from this event-producer slice.
