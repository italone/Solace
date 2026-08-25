# Typed Component Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in exact component-side slot consumption types while preserving broad JSX and
`h()` slot production and all existing runtime behavior.

**Architecture:** Extend the existing component type metadata with a third `SlotMap` generic and
carry it through component-accepting overloads only for assignability. `ComponentSetupContext`
exposes the exact map to component authors, while VNode children, JSX children, `h()` slot objects,
runtime instances, async components, and other transport boundaries remain broad or erase the map.

**Tech Stack:** TypeScript 5.9, TSX automatic and development runtimes, Vitest, Rollup declarations,
pnpm packed-consumer smoke, Prettier, ESLint

---

## Frozen Scope

This plan implements only typed component-side slot consumption:

- add `ComponentSetupContext<Events, SlotMap>`;
- add `ComponentType<Props, Events, SlotMap>`;
- add `defineComponent<Props, Events, SlotMap>`;
- preserve optional and required modifiers and exact slot function parameters;
- reject unknown slot consumption and incompatible scoped-slot arguments for explicit maps;
- preserve the existing open `Slots` default;
- keep typed emits, typed listeners, and generic JSX props inference working on the same component;
- carry or erase the third generic wherever required for component assignability.

Do not enforce slot maps at JSX or `h()` call sites. Required slots remain component-author
assertions, not caller requirements. Do not change runtime slot normalization, `VNodeSlots`,
`ComponentVNodeChildren`, async component slot typing, Router, SSR/SSG/hydration, SFC/Vite,
DevTools, package exports, version, changelog, Changesets, CI, release commands, npm tags, or Git
release tags. Do not add a package-root slot-map helper export.

## File Map

- `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`: source typed-slot consumption,
  compatibility, producer-boundary, listener, and generic-props contracts.
- `scripts/package-consumer-smoke.mjs`: installed declaration contracts for typed slots and unchanged
  broad producers.
- `src/component/component.ts`: bivariant legacy `Slot`, internal slot-map validation, and generic
  setup context; runtime slot objects remain broad.
- `src/component/define-component.ts`: three-generic declaration API.
- `src/vnode/vnode.ts`: slot-aware component identity, broad children overload, and runtime erasure.
- `src/vnode/h.ts`: accept typed-slot components without narrowing children.
- `src/jsx-types.ts`: extract events from a three-generic component without applying slots to props.
- `src/jsx-runtime.ts`: accept typed-slot components in `jsx` and `jsxs`.
- `src/jsx-dev-runtime.ts`: accept typed-slot components in `jsxDEV`.
- `tests/unit/docs/public-contract-docs.test.ts`: English and Chinese consumer-only slot contract.
- `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`: public typed-slot usage and caveats.
- `solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md`: fresh implementation
  evidence.
- `solace-project-log/index.md`: `2026-08-12` row `005`.

### Task 1: Establish RED source, JSX-dev, and packed slot contracts

**Files:**

- Modify: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Modify: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Add source slot-map fixtures**

In `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`, add `h` to the root value import
and `VNodeChildren` to the root type import:

```ts
import { defineComponent, h, render } from "../../../src";
import type { ComponentEventMap, ComponentSetupContext, VNodeChildren } from "../../../src";
```

Add these finite maps after `CounterEvents`:

```ts
type CounterSlots = {
  header?: () => VNodeChildren;
  default?: (props: { label: string; count?: number }) => VNodeChildren;
};

type RequiredCounterSlots = {
  default: (props: { label: string }) => VNodeChildren;
};

type InvalidCounterSlots = {
  default: string;
};
```

Do not add a string index signature. These aliases prove a finite ordinary object type is accepted.

- [x] **Step 2: Add direct setup-context slot contracts**

Add these functions beside `acceptTypedContext`:

```ts
function acceptTypedSlots({
  emit,
  slots,
}: ComponentSetupContext<CounterEvents, CounterSlots>): void {
  emit("increment", 1);
  slots.header?.();
  slots.default?.({ label: "Details" });
  slots.default?.({ label: "Details", count: 1 });

  // @ts-expect-error explicit slot maps reject unknown slot names
  slots.missing?.();
  // @ts-expect-error zero-argument slots reject scoped props
  slots.header?.({ label: "unexpected" });
  // @ts-expect-error scoped slots retain required props
  slots.default?.();
  // @ts-expect-error scoped slots retain required prop types
  slots.default?.({ label: 1 });
  // @ts-expect-error scoped slots retain optional prop types
  slots.default?.({ label: "Details", count: "1" });
  // @ts-expect-error exact scoped props reject undeclared fields
  slots.default?.({ label: "Details", extra: true });
}

function acceptRequiredSlots({
  slots,
}: ComponentSetupContext<ComponentEventMap, RequiredCounterSlots>): void {
  slots.default({ label: "Required" });
}

function acceptEmptySlots({ slots }: ComponentSetupContext<ComponentEventMap, {}>): void {
  // @ts-expect-error an explicit empty slot map exposes no slots
  slots.default;
}

function acceptPermissiveSlots({ slots }: ComponentSetupContext): void {
  slots.arbitrary?.({ value: Symbol("legacy") });
}

type InvalidSlotContext = ComponentSetupContext<ComponentEventMap, InvalidCounterSlots>;

function rejectInvalidSlots({ slots }: InvalidSlotContext): void {
  // @ts-expect-error invalid slot maps make component-side slots unusable
  slots.default;
}
```

Keep the current `acceptTypedContext()` contract. Create compile-only values without weakening the
slot types:

```ts
acceptTypedSlots({ emit: (() => undefined) as never, slots: {} });
acceptRequiredSlots({ emit: () => undefined, slots: { default: () => null } });
acceptEmptySlots({ emit: () => undefined, slots: {} });
acceptPermissiveSlots({ emit: () => undefined, slots: {} });
void (0 as unknown as InvalidSlotContext);
void rejectInvalidSlots;
```

The `acceptTypedSlots` value intentionally omits optional slots. Do not make required slots optional
to simplify fixture construction.

- [x] **Step 3: Declare a component with typed emits and typed slots together**

Change `TypedEmitter` to use all three generics and consume the valid slots before its existing emit
negative cases:

```tsx
const TypedEmitter = defineComponent<TypedEmitterProps, CounterEvents, CounterSlots>(
  (props, { emit, slots }) => {
    emit("increment", props.count);
    emit("reset");
    emit("rename", "Ada");
    emit("rename", "Ada", "user");
    emit("collect", "values", 1, 2, 3);
    emit("value-change", props.count);
    slots.header?.();
    slots.default?.({ label: "Counter", count: props.count });

    // Keep every existing typed emit @ts-expect-error case here.

    return <button>{props.count}</button>;
  },
);
```

Add a required-slot component that invokes its slot without optional chaining:

```tsx
const RequiredSlotPanel = defineComponent<object, ComponentEventMap, RequiredCounterSlots>(
  (_props, { slots }) => <section>{slots.default({ label: "Required" })}</section>,
);
```

- [x] **Step 4: Lock the consumer-only producer boundary**

Add these valid expressions near the existing top-level JSX and direct factory expressions:

```tsx
<RequiredSlotPanel />;
h(RequiredSlotPanel);
h(RequiredSlotPanel, null, {
  unknownProducerSlot: (props) => <span>{String(props?.value)}</span>,
});
```

The JSX expression deliberately omits the required slot. The `h()` object deliberately uses an
undeclared slot. Both must continue compiling because this phase does not type producers.

Keep all existing `TypedEmitter` listener positive and negative cases. They prove extracting the
third generic does not turn strict listeners permissive.

- [x] **Step 5: Run source typechecks and verify RED**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both fail because `ComponentSetupContext` accepts only one generic, `defineComponent`
accepts at most two explicit generics, and the current broad `slots` type leaves slot-negative
`@ts-expect-error` directives unused. Confirm the errors originate from the new slot contract; fix
only fixture mistakes that obscure those intended failures.

- [x] **Step 6: Add packed-consumer slot contracts**

Add `VNodeChildren` to the generated root type-only import inside
`scripts/package-consumer-smoke.mjs`.

After `ButtonEvents`, add:

```tsx
type ButtonSlots = {
  header?: () => VNodeChildren;
  default?: (props: { label: string; value?: number }) => VNodeChildren;
};

type RequiredButtonSlots = {
  default: (props: { label: string }) => VNodeChildren;
};
```

Change `TypedButton` to `defineComponent<TypedButtonProps, ButtonEvents, ButtonSlots>` and consume:

```tsx
slots.header?.();
slots.default?.({ label: "Packed", value: props.value });

// @ts-expect-error packaged typed slots reject unknown names
slots.missing?.();
// @ts-expect-error packaged typed slots retain required scoped props
slots.default?.();
// @ts-expect-error packaged typed slots retain scoped prop types
slots.default?.({ label: 1 });
```

Add a required component and broad producer cases:

```tsx
const RequiredPackedPanel = defineComponent<object, ComponentEventMap, RequiredButtonSlots>(
  (_props, { slots }) => <section>{slots.default({ label: "Packed" })}</section>,
);

<RequiredPackedPanel />;
h(RequiredPackedPanel);
h(RequiredPackedPanel, null, {
  unknownProducerSlot: (props) => <span>{String(props?.value)}</span>,
});
```

Keep the existing typed listener, generic component, DOM, router, SSR, SFC, and runtime smoke
contracts unchanged.

- [x] **Step 7: Run packed consumer and verify RED**

Run:

```bash
pnpm package:smoke
```

Expected: build, pack, and install may succeed, then generated consumer typecheck fails because the
installed declarations lack the slot generics. Confirm new negative directives are unused or the
three-generic declarations fail.

- [x] **Step 8: Keep the RED contract uncommitted**

Run:

```bash
git status --short
git diff --check
```

Expected changed paths:

```text
M scripts/package-consumer-smoke.mjs
M tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx
```

Do not commit the deliberately failing contract.

### Task 2: Implement the additive slot-map type propagation

**Files:**

- Modify: `src/component/component.ts`
- Modify: `src/component/define-component.ts`
- Modify: `src/vnode/vnode.ts`
- Modify: `src/vnode/h.ts`
- Modify: `src/jsx-types.ts`
- Modify: `src/jsx-runtime.ts`
- Modify: `src/jsx-dev-runtime.ts`
- Test: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Test: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Add bivariant legacy slots and property-level map validation**

In `src/component/component.ts`, replace the existing `Slot` alias with the equivalent bivariant
method form, add internal validation helpers after `Slots`, and replace the setup context declaration:

```ts
export type Slot = {
  bivarianceHack(props?: SlotProps): VNodeChildren;
}["bivarianceHack"];

type DefinedSlot<Value> = Value extends undefined ? never : Value;
type InvalidSlotNames<SlotMap extends object> = {
  [Name in keyof SlotMap]-?: DefinedSlot<SlotMap[Name]> extends (
    ...args: infer _Args
  ) => infer Result
    ? [Result] extends [VNodeChildren]
      ? never
      : Name
    : Name;
}[keyof SlotMap];
type ValidatedSlots<SlotMap extends object> = [InvalidSlotNames<SlotMap>] extends [never]
  ? SlotMap
  : never;

export interface ComponentSetupContext<
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Slots,
> {
  emit: EmitFn<Events>;
  slots: ValidatedSlots<SlotMap>;
}
```

The public `Slot` call signature stays `(props?: SlotProps) => VNodeChildren`; the method form changes
only parameter variance so narrower scoped slots remain assignable through existing bare
`ComponentType` transports. `infer _Args` checks that a member is callable without imposing one
shared parameter tuple, and `[Result]` prevents distributive union-return failures. Keep `SlotProps`,
`Slots`, `ComponentInstance.slots`, `initSlots()`, and all runtime functions unchanged. Do not export
the validation helpers.

- [x] **Step 2: Carry the slot map through `ComponentType` and erase it at runtime boundaries**

In `src/vnode/vnode.ts`, import `Slots`, then change the component type:

```ts
export type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Slots,
> = (props: Props, context: ComponentSetupContext<Events, SlotMap>) => ComponentRender | VNode;
```

Change the component member of `VNodeType` to erase both public metadata maps:

```ts
ComponentType<never, any, any> | string | AsyncComponentType<never> | FragmentType;
```

Add `SlotMap` to the component `createVNode()` overload while keeping broad children:

```ts
export function createVNode<
  Props extends object,
  Events extends ComponentEventMap,
  SlotMap extends object,
>(
  type: ComponentType<Props, Events, SlotMap>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
```

Do not make `VNode`, `VNodeSlots`, `ComponentVNodeChildren`, or `AsyncComponentType` generic. Do not
change emitted runtime code.

- [x] **Step 3: Add the `defineComponent` three-generic overload**

In `src/component/define-component.ts`, import `Slots`. Change the explicit
metadata overload to:

```ts
export function defineComponent<
  Props extends object,
  Events extends ComponentEventMap,
  SlotMap extends object = Slots,
>(component: ComponentType<Props, Events, SlotMap>): ComponentType<Props, Events, SlotMap>;
```

Keep the first overload that preserves an exact direct/render-function result for untyped
components, and keep the identity implementation unchanged. The default third generic ensures every
existing `defineComponent<Props, Events>` call remains source compatible.

- [x] **Step 4: Accept typed-slot components through `h()` without typing producers**

In `src/vnode/h.ts`, add the third generic to the component overload:

```ts
export function h<Props extends object, Events extends ComponentEventMap, SlotMap extends object>(
  type: ComponentType<Props, Events, SlotMap>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
```

The `children` parameter must remain `ComponentVNodeChildren`. Do not derive it from `SlotMap`.

- [x] **Step 5: Preserve listener extraction while ignoring the slot map**

In `src/jsx-types.ts`, change only the component match inside `JSXManagedComponentProps`:

```ts
export type JSXManagedComponentProps<Component, Props> = Props extends object
  ? Component extends ComponentType<never, infer Events, infer _SlotMap>
    ? JSXComponentProps<Props, Events>
    : JSXComponentProps<Props, ComponentEventMap>
  : Props;
```

This preserves TypeScript's instantiated `Props`, extracts the event map, and ignores slots after
matching. Keep the existing generic-function regression and strict listener negatives. Do not add
slot properties to `JSXComponentProps`.

- [x] **Step 6: Accept typed-slot components in all JSX factory overloads**

In `src/jsx-runtime.ts`, change both component overloads:

```ts
export function jsx<Props extends object, Events extends ComponentEventMap, SlotMap extends object>(
  type: ComponentType<Props, Events, SlotMap>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;

export function jsxs<
  Props extends object,
  Events extends ComponentEventMap,
  SlotMap extends object,
>(
  type: ComponentType<Props, Events, SlotMap>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;
```

In `src/jsx-dev-runtime.ts`, make the equivalent `jsxDEV()` overload change. Keep the implementation
delegation, `JSXProps`, children normalization, and runtime imports unchanged.

- [x] **Step 7: Update internal component erasure only where compilation requires it**

Run the source typecheck:

```bash
pnpm typecheck
```

The bivariant legacy `Slot` should keep typed-slot components assignable to existing bare
`ComponentType` surfaces. If `ComponentInstance.type` or another already-erased internal position
still needs explicit erasure, use:

```ts
type: ComponentType<never, any, any>;
```

Do not edit Router, SSR, async components, application roots, runtime instances, or VNode data to
carry slot maps. Changes outside the seven implementation files listed for Task 2 require controller
review against the design before proceeding.

- [x] **Step 8: Run source and runtime regression checks GREEN**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  tests/unit/component/component.test.ts
```

Expected: both typechecks pass and both test files pass. Existing default, named, scoped, updated,
and omitted slot runtime tests must remain unchanged and green.

- [x] **Step 9: Verify generated declarations and installed consumption**

Run serially:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: package tests pass; the installed consumer retains typed emit/listener/generic-props
contracts, accepts typed slot consumption, rejects invalid slot consumption, and still accepts broad
JSX and `h()` slot producers. Inspect emitted declarations if the consumer loses the third generic;
do not add a package export.

- [x] **Step 10: Verify type-only scope and commit**

Run:

```bash
pnpm exec prettier --check src/component/component.ts src/component/define-component.ts \
  src/vnode/vnode.ts src/vnode/h.ts src/jsx-types.ts src/jsx-runtime.ts \
  src/jsx-dev-runtime.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  scripts/package-consumer-smoke.mjs
pnpm lint
git diff --check
git diff 3c21106..HEAD -- package.json src/component/async-component.ts src/router src/server \
  src/renderer .github/workflows/ci.yml
```

Expected: checks pass and the frozen paths produce no diff. Then commit only the approved type and
contract files:

```bash
git add src/component/component.ts src/component/define-component.ts src/vnode/vnode.ts \
  src/vnode/h.ts src/jsx-types.ts src/jsx-runtime.ts src/jsx-dev-runtime.ts \
  tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  scripts/package-consumer-smoke.mjs
git commit -m "feat: add typed component slot contract"
```

### Task 3: Document the consumer-only typed-slot boundary

**Files:**

- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`

- [x] **Step 1: Update the documentation contract first**

In `tests/unit/docs/public-contract-docs.test.ts`, retain all typed emit/listener assertions and add
these English assertions for both `api` and `packageUsage`:

```ts
expect(doc).toContain("defineComponent<Props, Events, SlotMap>");
expect(doc).toContain("explicit slot maps type component-side slot consumption");
expect(doc).toContain("required slots are component-author assertions");
expect(doc).toContain("not enforced at JSX or `h()` call sites");
```

Add these Chinese API assertions:

```ts
expect(apiZh).toContain("defineComponent<Props, Events, SlotMap>");
expect(apiZh).toContain("显式 slot map 只约束组件内部的 slot 消费");
expect(apiZh).toContain("required slot 是组件作者断言");
expect(apiZh).toContain("不会在 JSX 或 `h()` 调用端强制执行");
```

Replace the current `ComponentSetupContext<Events>` assertions for `api` and `apiZh` with:

```ts
expect(doc).toContain("ComponentSetupContext<Events, SlotMap>");
```

Keep the existing `ComponentType<` assertions. Existing typed-event sections may continue showing
`defineComponent<Props, Events>` while the new slot section shows all three generics.

- [x] **Step 2: Run the documentation contract and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: one test fails because current documents do not describe typed slots or the producer
caveat.

- [x] **Step 3: Add the English API example and boundary**

In the component section of `docs/api.md`, import `VNodeChildren` with the existing public types and
add this example after the broad slot example:

```tsx
type PanelSlots = {
  header?: () => VNodeChildren;
  default?: (props: { label: string }) => VNodeChildren;
};

const TypedPanel = defineComponent<object, ComponentEventMap, PanelSlots>((_props, { slots }) => (
  <section>
    <header>{slots.header?.()}</header>
    <main>{slots.default?.({ label: "Details" })}</main>
  </section>
));
```

Add this exact boundary paragraph:

```markdown
Typed slots are opt-in through `defineComponent<Props, Events, SlotMap>`. Explicit slot maps type
component-side slot consumption: declared default, named, and scoped slots retain their exact
signatures, while components without a slot map remain permissive. Required slots are
component-author assertions in this phase and are not enforced at JSX or `h()` call sites. JSX
children, `h()` slot objects, async slot producers, and runtime validation remain unchanged.
```

Ensure the exact lowercase phrase `explicit slot maps type component-side slot consumption` appears
verbatim, using a preceding semicolon if needed.

- [x] **Step 4: Add the Chinese API example and boundary**

Use the same `PanelSlots` and `TypedPanel` code in `docs/api.zh-CN.md`. Add:

```markdown
typed slots 通过 `defineComponent<Props, Events, SlotMap>` 显式启用。显式 slot map 只约束组件内部的
slot 消费：声明的 default、named 和 scoped slots 会保留精确签名，未声明 slot map 的组件继续
保持宽松。required slot 是组件作者断言，本阶段不会在 JSX 或 `h()` 调用端强制执行。JSX
children、`h()` slot objects、async slot producers 与 runtime validation 均保持不变。
```

- [x] **Step 5: Update package usage with the same public boundary**

Add the English typed `PanelSlots` example to the existing component-slot section of
`docs/package-usage.md`. Include the same four exact English phrases asserted by the docs test. Do
not describe required slots as caller-enforced and do not imply named-slot JSX syntax exists.

- [x] **Step 6: Run docs GREEN and formatting checks**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
pnpm exec prettier --check tests/unit/docs/public-contract-docs.test.ts \
  docs/api.md docs/api.zh-CN.md docs/package-usage.md
git diff --check
```

Expected: all pass. Confirm no document claims runtime validation, producer enforcement, async slot
typing, React compatibility, or a new helper export.

- [x] **Step 7: Commit documentation**

```bash
git add tests/unit/docs/public-contract-docs.test.ts docs/api.md docs/api.zh-CN.md \
  docs/package-usage.md
git commit -m "docs: explain typed component slots"
```

### Task 4: Run final gates and record fresh evidence

**Files:**

- Create: `solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Run the complete quality gate**

Run:

```bash
pnpm quality
```

Expected: formatting, builds, both typechecks, lint, full Vitest, and package tests pass. Record the
fresh main and package file/test totals from this exact run; do not copy prior log counts without
checking the output.

- [x] **Step 2: Re-run packed and focused contracts**

Run serially:

```bash
pnpm package:smoke
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts \
  tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  tests/unit/component/component.test.ts
```

Expected: the packed consumer passes and all three files pass. Record fresh focused totals.

- [x] **Step 3: Verify frozen public and release scope**

Run:

```bash
node -p "require('./package.json').version"
git diff 3c21106..HEAD --name-only
git diff 3c21106..HEAD -- package.json CHANGELOG.md .changeset \
  .github/workflows/ci.yml src/component/async-component.ts src/router src/server src/renderer
git diff --check
git status --short --branch
```

Expected:

- version remains `0.1.0-beta.4`;
- frozen paths produce no diff;
- changed paths are limited to approved component types, overloads, contracts, docs, and log files;
- worktree is clean before evidence files are written.

- [x] **Step 4: Write the implementation evidence**

Create `solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md` with:

```markdown
# 2026-08-12-005：增加 typed component slots

## 基本信息

- 日期：2026-08-12
- 类型：JSX/TSX ergonomics / public types / tests / docs
- 状态：已完成

## 变动摘要

显式 slot map 现在会为组件 setup context 提供精确的 default、named 和 scoped slot 消费类型，
同时保留 optional/required 修饰符。未声明 slot map 的组件继续使用 permissive `Slots`。

本切片只约束组件内部消费。JSX children、`h()` slot objects、async slot producers、runtime
slot normalization、VNode data、Router、SSR、SFC 与 DevTools 均未改变。required slot 仍是组件
作者断言，不是调用端保证。

## 验证记录

| 验证项        | 命令                                                                                                                                                                      | 结果                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Focused       | `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/component.test.ts` | 通过；3 个 test files、51 个 tests    |
| Typechecks    | `pnpm quality`                                                                                                                                                            | 通过；normal 与 JSX-dev contract 生效 |
| Package tests | `pnpm quality`                                                                                                                                                            | 通过；1 个 test file、16 个 tests     |
| Packed smoke  | `pnpm package:smoke`                                                                                                                                                      | 通过；安装后声明保留 slot contract    |
| Quality       | `pnpm quality`                                                                                                                                                            | 通过；主测试为 72 files、644 tests    |

## 边界

- package version、exports、CI 与 release commands 未改变。
- 不包含 producer-side slot validation、async slot typing 或 runtime validation。
- 未运行或声称 `pnpm release:check`。
```

The counts above are the current expected inventory because this slice adds compile-time expressions
without adding `it()` blocks. Replace them with the actual fresh output if any inventory changes.
Add row `005` under `2026-08-12` in `solace-project-log/index.md`:

```markdown
| 005 | 增加 typed component slots | JSX/TSX ergonomics、public types、tests、docs | `src/component/**`, `src/vnode/**`, `src/jsx*-runtime.ts`, `tests/**`, `scripts/package-consumer-smoke.mjs`, `docs/**`, `solace-project-log/**` | [查看](./solace-entries/2026-08-12-005-typed-component-slots.md) |
```

- [x] **Step 5: Format, verify, and commit evidence**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md \
  solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md
rg -n "TBD|TODO" \
  solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md
pnpm format:check
git diff --check
```

Expected: the marker scan produces no output and all checks pass. Then commit:

```bash
git add solace-project-log/index.md \
  solace-project-log/solace-entries/2026-08-12-005-typed-component-slots.md
git commit -m "docs: record typed component slots"
```

- [x] **Step 6: Final no-publish review**

Run:

```bash
git status --short --branch
git log --oneline 3c21106..HEAD
node -p "require('./package.json').version"
```

Expected: clean worktree, local typed-slot commits listed, and version `0.1.0-beta.4`. Do not push,
tag, publish, alter npm dist-tags, or run a release workflow without a separate explicit maintainer
decision.
