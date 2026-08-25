# Typed Emit Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in event-map generic that strictly types component `emit()` calls while preserving the current permissive behavior for components without an event declaration.

**Architecture:** The public event map and generic setup context live with the existing component types. `ComponentType`, `defineComponent`, and public VNode/JSX factory overloads carry the event generic; internal runtime containers erase it with `any` because no runtime event metadata is added. Source TypeScript tests and the packed consumer both define the contract before implementation, while documentation explicitly defers precise JSX listener inference.

**Tech Stack:** TypeScript 5.9, TSX automatic runtime, Vitest, Rollup declarations, pnpm packed-consumer smoke, Prettier, ESLint

---

## Frozen Scope

This plan implements only typed event producers:

- add `ComponentEventMap`;
- make `EmitFn`, `ComponentSetupContext`, and `ComponentType` event-aware;
- support `defineComponent<Props, Events>` without a third required generic;
- preserve the event generic through `h`, `jsx`, `jsxs`, and `jsxDEV` overloads;
- retain permissive defaults for all existing consumers.

Do not add precise `onXxx` listener inference, typed slots, runtime event declarations, runtime event
validation, event metadata, new package exports, or new release behavior. Do not change Router,
SSR/SSG/hydration, SFC/Vite, DevTools events, package version, changelog, Changesets, CI, npm tags, or
Git release tags.

## File Map

- `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`: source-level positive and negative
  TypeScript contract, plus backward-compatible default behavior.
- `scripts/package-consumer-smoke.mjs`: generated packed consumer that verifies built declarations.
- `src/component/component.ts`: event-map, emit, and setup-context public types; runtime dispatch stays
  unchanged.
- `src/component/define-component.ts`: recommended `defineComponent<Props, Events>` declaration API.
- `src/vnode/vnode.ts`: event-aware public component type and VNode overload; internal event erasure.
- `src/vnode/h.ts`: event-aware public `h()` overload only.
- `src/jsx-runtime.ts`: event-aware `jsx()` and `jsxs()` overloads only.
- `src/jsx-dev-runtime.ts`: event-aware `jsxDEV()` overload only.
- `src/index.ts`: export the additive `ComponentEventMap` type from the existing root entry.
- `tests/unit/docs/public-contract-docs.test.ts`: English/Chinese documentation contract.
- `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`: existing component event guidance.
- `solace-project-log/solace-entries/2026-08-12-003-typed-emit-contract.md`: fresh verification evidence.
- `solace-project-log/index.md`: index row for the implementation log.

### Task 1: Define the source and packed-consumer type contract

**Files:**

- Modify: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Modify: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Add the failing source TypeScript contract**

Change the root imports in `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx` to import
`defineComponent` and the new type:

```ts
import { defineComponent, render } from "../../../src";
import type { ComponentEventMap, ComponentSetupContext } from "../../../src";
```

Add this contract before the existing top-level JSX expressions:

```tsx
type CounterEvents = {
  increment: [count: number];
  reset: [];
  rename: [name: string, source?: "user" | "sync"];
  collect: [label: string, ...values: number[]];
};

const eventMap: ComponentEventMap = {} as CounterEvents;
void eventMap;

const TypedEmitter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => {
  emit("increment", props.count);
  emit("reset");
  emit("rename", "Ada");
  emit("rename", "Ada", "user");
  emit("collect", "values", 1, 2, 3);

  // @ts-expect-error typed emit rejects unknown event names
  emit("missing");
  // @ts-expect-error typed emit requires the declared payload
  emit("increment");
  // @ts-expect-error typed emit rejects incompatible payloads
  emit("increment", "1");
  // @ts-expect-error typed emit rejects payloads for zero-argument events
  emit("reset", 1);
  // @ts-expect-error typed emit rejects incompatible optional tuple values
  emit("rename", "Ada", "external");
  // @ts-expect-error typed emit rejects incompatible rest tuple values
  emit("collect", "values", "1");

  return <button>{props.count}</button>;
});

function acceptTypedContext({ emit }: ComponentSetupContext<CounterEvents>): void {
  emit("increment", 1);
  // @ts-expect-error direct setup contexts retain the event map
  emit("increment", "1");
}

acceptTypedContext({ emit: (() => undefined) as never, slots: {} });

const UntypedEmitter = defineComponent((_props: object, { emit }) => {
  emit("legacy-event", Symbol("payload"), 1);
  return <span>legacy</span>;
});

<TypedEmitter count={1} onIncrement={(count: number) => incrementCalls.push(count)} />;
<UntypedEmitter onLegacyEvent={() => undefined} />;
```

This intentionally keeps the listener examples broad. Do not add a negative listener-payload case;
precise JSX listener inference is outside this slice.

- [x] **Step 2: Run source typecheck and verify RED**

Run:

```bash
pnpm typecheck
```

Expected: FAIL because `ComponentEventMap` is not exported, `ComponentSetupContext` is not generic,
and current `defineComponent` does not accept `Props, Events`. Confirm that at least one
`@ts-expect-error` is also reported unused under the old permissive `emit` type.

- [x] **Step 3: Add the failing packed-consumer type contract**

In the generated `main.tsx` import at `scripts/package-consumer-smoke.mjs`, add
`ComponentEventMap` to the type-only root import:

```ts
import type {
  AsyncComponentOptions,
  ComponentEventMap,
  ComponentSetupContext,
  HydrationOptions,
  NavigationGuard,
  Plugin,
  RouteComponent,
  RouteLocationRaw,
  RouterHistory,
  StoreContext,
  StoreGetterContext,
} from "@italone/solace";
```

Immediately before the existing `Button`, add:

```tsx
type ButtonEvents = {
  change: [value: number];
  reset: [];
};

const buttonEventMap: ComponentEventMap = {} as ButtonEvents;
void buttonEventMap;

const TypedButton = defineComponent<{ value: number }, ButtonEvents>((props, { emit }) => {
  emit("change", props.value);
  emit("reset");

  // @ts-expect-error packaged typed emit rejects unknown events
  emit("missing");
  // @ts-expect-error packaged typed emit rejects incompatible payloads
  emit("change", "1");

  return <button onClick={() => emit("change", props.value)}>{props.value}</button>;
});
```

Add `<TypedButton value={1} onChange={(value: number) => String(value)} />;` beside the other top-level
type expressions. Do not replace the existing untyped `Button`; it is the backward-compatibility
case.

- [x] **Step 4: Run packed consumer and verify RED**

Run:

```bash
pnpm package:smoke
```

Expected: FAIL in the generated consumer TypeScript check because the packed declaration does not
export `ComponentEventMap` and does not support the typed component signature. The local tarball may
build and install before the expected TypeScript failure.

- [x] **Step 5: Keep the worktree uncommitted for the GREEN implementation**

Do not commit a deliberately failing tree. Confirm only the two approved test-contract files changed:

```bash
git status --short
```

Expected paths:

```text
M scripts/package-consumer-smoke.mjs
M tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx
```

### Task 2: Implement the additive event-map types

**Files:**

- Modify: `src/component/component.ts`
- Modify: `src/component/define-component.ts`
- Modify: `src/vnode/vnode.ts`
- Modify: `src/vnode/h.ts`
- Modify: `src/jsx-runtime.ts`
- Modify: `src/jsx-dev-runtime.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Test: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Add the event map, generic emit, and generic setup context**

Replace the current `EmitFn` and `ComponentSetupContext` declarations in
`src/component/component.ts` with:

```ts
export type ComponentEventMap = Record<string, readonly unknown[]>;

type EventArgs<
  Events extends ComponentEventMap,
  Event extends keyof Events,
> = Events[Event] extends readonly [...infer Args] ? Args : never;

export type EmitFn<Events extends ComponentEventMap = ComponentEventMap> = <
  Event extends keyof Events & string,
>(
  event: Event,
  ...args: EventArgs<Events, Event>
) => void;

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

Leave `ComponentInstance.emit`, the runtime `emit()` function, event-name camelization, listener-array
dispatch, and DevTools summaries unchanged. They continue to use the permissive default `EmitFn`.

- [x] **Step 2: Carry the event type through ComponentType and VNode creation**

Update the type import in `src/vnode/vnode.ts`:

```ts
import type { ComponentEventMap, ComponentSetupContext, Slot } from "../component/component";
```

Replace `ComponentType` with:

```ts
export type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
> = (props: Props, context: ComponentSetupContext<Events>) => ComponentRender | VNode;
```

Erase the event generic only in runtime unions:

```ts
export type VNodeType =
  string | ComponentType<never, any> | AsyncComponentType<never> | FragmentType;
```

Change the synchronous component `createVNode` overload to retain the public generic:

```ts
export function createVNode<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
```

Do not alter `createVNode()` runtime logic.

- [x] **Step 3: Make defineComponent preserve Props and Events**

Replace `src/component/define-component.ts` with:

```ts
import type { ComponentEventMap } from "./component";
import type { ComponentType } from "../vnode/vnode";

export function defineComponent<
  Props extends object,
  Events extends ComponentEventMap = ComponentEventMap,
>(component: ComponentType<Props, Events>): ComponentType<Props, Events> {
  return component;
}
```

This deliberately returns `ComponentType<Props, Events>` instead of exposing a third result generic.
Existing direct-VNode and render-function returns are already part of `ComponentType`.

- [x] **Step 4: Preserve Events in h and JSX factory overloads**

Import `ComponentEventMap` as a type in `src/vnode/h.ts` and change only the synchronous component
overload:

```ts
export function h<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: Props | null,
  children?: ComponentVNodeChildren,
): VNode;
```

In `src/jsx-runtime.ts`, import `ComponentEventMap` and change the `jsx` and `jsxs` component
overloads to:

```ts
export function jsx<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props> | null,
  key?: JSXKey,
): VNode;

export function jsxs<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props> | null,
  key?: JSXKey,
): VNode;
```

In `src/jsx-dev-runtime.ts`, import `ComponentEventMap` and change the component overload to:

```ts
export function jsxDEV<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props> | null,
  key?: JSXKey,
): VNode;
```

Do not change `createJsxVNode`, JSX child normalization, `JSXComponentProps`, `IntrinsicAttributes`, or
runtime casts. Precise listener inference remains deferred.

- [x] **Step 5: Export ComponentEventMap from the existing root entry**

Change the component type export in `src/index.ts` to:

```ts
export type {
  ComponentEventMap,
  ComponentSetupContext,
  EmitFn,
  Slot,
  SlotProps,
  Slots,
} from "./component/component";
```

Do not modify `package.json` exports; this is an additive type on the existing root entry.

- [x] **Step 6: Run typecheck and resolve only event-propagation errors**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If TypeScript reports internal assignability at a runtime container, erase `Events`
there with `any`; do not weaken `EmitFn<Events>`, remove a negative test, or add broad listener
inference. If the error occurs in a public `h`/JSX overload, preserve the `Events` generic instead of
erasing it.

- [x] **Step 7: Run focused runtime and type-contract tests**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts
```

Expected: both files pass; existing listener functions, listener arrays, kebab-case resolution, and
DevTools summaries remain unchanged.

- [x] **Step 8: Verify generated declarations and packed consumer GREEN**

Run:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: the package test inventory passes and the packed TypeScript consumer accepts valid typed
events while consuming every new `@ts-expect-error` case.

- [x] **Step 9: Commit the type contract**

```bash
git add src/component/component.ts src/component/define-component.ts src/vnode/vnode.ts src/vnode/h.ts src/jsx-runtime.ts src/jsx-dev-runtime.ts src/index.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx scripts/package-consumer-smoke.mjs
git commit -m "feat: add typed component emit contract"
```

### Task 3: Document the opt-in producer boundary

**Files:**

- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`

- [x] **Step 1: Add a failing documentation contract**

In the existing `keeps release gates and deferred beta boundaries aligned` test in
`tests/unit/docs/public-contract-docs.test.ts`, add these assertions after the current documentation
reads and before the final compatibility assertions:

```ts
for (const doc of [api, packageUsage]) {
  expect(doc).toContain("ComponentEventMap");
  expect(doc).toContain("defineComponent<Props, Events>");
  expect(doc).toContain("permissive by default");
  expect(doc).toContain("does not infer precise `onXxx` listener payloads");
}

expect(apiZh).toContain("ComponentEventMap");
expect(apiZh).toContain("defineComponent<Props, Events>");
expect(apiZh).toContain("默认保持宽松");
expect(apiZh).toContain("不会推导精确的 `onXxx` listener payload");
```

- [x] **Step 2: Run the documentation test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: FAIL because the three documents do not yet contain the typed emit contract.

- [x] **Step 3: Update the English API component section**

After the existing event-name resolution paragraph in `docs/api.md`, add:

````markdown
Event typing is opt-in through `ComponentEventMap` and `defineComponent<Props, Events>`. Each event
maps to its argument tuple:

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap } from "@italone/solace";

type CounterEvents = {
  increment: [count: number];
  reset: [];
};

const Counter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => (
  <button onClick={() => emit("increment", props.count)}>{props.count}</button>
));
```
````

Components without an explicit event map remain permissive by default. This contract types the event
producer at compile time and does not add runtime validation. This slice does not infer precise
`onXxx` listener payloads; component listeners retain the existing function-or-function-array JSX
contract.

````

Keep the existing runtime camelization paragraph and `defineComponent(component)` section.

- [x] **Step 4: Update the Chinese API component section**

After the corresponding event-name paragraph in `docs/api.zh-CN.md`, add:

```markdown
事件类型可以通过 `ComponentEventMap` 和 `defineComponent<Props, Events>` 显式启用。每个事件
映射到自己的参数 tuple：

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap } from "@italone/solace";

type CounterEvents = {
  increment: [count: number];
  reset: [];
};

const Counter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => (
  <button onClick={() => emit("increment", props.count)}>{props.count}</button>
));
````

未显式声明事件映射的组件默认保持宽松。这个契约只在编译期约束事件生产者，不增加运行时
校验。本切片不会推导精确的 `onXxx` listener payload；组件 listener 继续使用现有的函数或
函数数组 JSX 契约。

````

- [x] **Step 5: Update package usage with the packed-consumer form**

Replace the current component-event example in `docs/package-usage.md` with the same typed counter
shape and add this paragraph immediately after it:

```markdown
`ComponentEventMap` is opt-in: components with no explicit event map remain permissive by default.
It constrains the component's `emit()` calls at compile time and does not add runtime validation. It
does not infer precise `onXxx` listener payloads in this slice; component handlers remain a function
or an array of functions, matching runtime dispatch.
````

Keep the existing DOM-handler sentence.

- [x] **Step 6: Run documentation and focused contract tests GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx
```

Expected: both files pass.

- [x] **Step 7: Commit documentation**

```bash
git add tests/unit/docs/public-contract-docs.test.ts docs/api.md docs/api.zh-CN.md docs/package-usage.md
git commit -m "docs: explain typed component emits"
```

### Task 4: Run final validation and record evidence

**Files:**

- Create: `solace-project-log/solace-entries/2026-08-12-003-typed-emit-contract.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Run the complete local quality gate**

Run:

```bash
pnpm quality
```

Expected: format, build, runtime typecheck, JSX dev typecheck, lint, complete Vitest inventory, and
package tests all pass. Record the fresh Vitest file/test totals and package test totals from this
exact execution.

- [x] **Step 2: Re-run the packed consumer and focused contract**

Run:

```bash
pnpm package:smoke
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts
```

Expected: packed consumer passes and all three focused files pass. Record the fresh focused counts.

- [x] **Step 3: Verify the frozen public/release scope**

Run:

```bash
node -p "require('./package.json').version"
git diff c650077..HEAD --name-only
git diff c650077..HEAD -- package.json CHANGELOG.md .changeset .github/workflows/ci.yml
git diff --check
git status --short --branch
```

Expected:

- version remains `0.1.0-beta.4`;
- no output for package metadata, changelog, Changesets, or CI diff;
- changed implementation files are limited to the approved type, test, consumer-smoke, documentation,
  plan, and project-log paths;
- diff check passes.

- [x] **Step 4: Write the project-log evidence**

Create `solace-project-log/solace-entries/2026-08-12-003-typed-emit-contract.md`:

```markdown
# 2026-08-12-003：增加 typed emit contract

## 基本信息

- 日期：2026-08-12
- 类型：JSX/TSX ergonomics / public types / tests / docs
- 状态：已完成

## 变动摘要

新增 opt-in `ComponentEventMap`、generic `EmitFn`、`ComponentSetupContext` 和
`ComponentType`，并支持 `defineComponent<Props, Events>`。显式事件映射会在编译期约束事件名
和参数 tuple；未声明映射的组件继续保持宽松。运行时 emit、listener arrays、kebab-case
解析和 DevTools summaries 未改变，精确 JSX `onXxx` listener inference 继续 deferred。

## 验证记录

| 验证项        | 命令                                                                                                                                                                      | 结果                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Focused tests | `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts` | 通过；3 个 test files、18 个 tests                                         |
| Typecheck     | `pnpm typecheck`                                                                                                                                                          | 通过；正反向 typed emit contract 生效                                      |
| Package tests | `pnpm test:package`                                                                                                                                                       | 通过；1 个 test file、16 个 tests                                          |
| Packed smoke  | `pnpm package:smoke`                                                                                                                                                      | 通过；生成声明保留 typed emit contract                                     |
| Quality       | `pnpm quality`                                                                                                                                                            | 通过；72 个 test files、644 个 tests，package tests 为 1 个文件、16 个测试 |

## 边界

- package version、exports、Router、SSR/SSG/hydration、SFC/Vite、DevTools、CI 和 release commands 未改变。
- 本切片不提供 typed slots 或精确 JSX listener payload inference。
```

The counts above match the current inventory because this plan adds type expressions and assertions
inside existing tests without adding an `it()` block. Before saving the log, replace them with the
fresh command output if the inventory changed during implementation. Add index row `003` under
`2026-08-12` pointing to the new entry.

- [x] **Step 5: Format and verify the evidence files**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md solace-project-log/solace-entries/2026-08-12-003-typed-emit-contract.md
pnpm format:check
git diff --check
```

Expected: formatting and diff checks pass.

- [x] **Step 6: Commit evidence**

```bash
git add solace-project-log/index.md solace-project-log/solace-entries/2026-08-12-003-typed-emit-contract.md
git commit -m "docs: record typed emit contract"
```

- [x] **Step 7: Final no-publish status review**

Run:

```bash
git status --short --branch
git log --oneline c650077..HEAD
node -p "require('./package.json').version"
```

Expected: clean worktree, local implementation commits listed, and version `0.1.0-beta.4`. Do not
push, tag, publish, or alter npm dist-tags without a separate explicit maintainer decision.
