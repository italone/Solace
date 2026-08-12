# Typed Component Listener Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Infer exact JSX component listener names and payload tuples from an explicit
`ComponentEventMap` while preserving permissive listeners for components without an event map.

**Architecture:** Add one internal shared JSX type module that derives canonical listener props from
`ComponentType<Props, Events>`. Direct JSX factory overloads and `JSX.LibraryManagedAttributes` use
the same conditional strict/permissive contract; runtime JSX creation and component emit dispatch do
not change.

**Tech Stack:** TypeScript 5.9, TSX automatic and development runtimes, Vitest, Rollup declarations,
pnpm packed-consumer smoke, Prettier, ESLint

---

## Frozen Scope

This plan implements only component listener inference in JSX:

- explicit event maps derive exact canonical `onXxx` listener names;
- each listener function or function-array item receives the event argument tuple;
- kebab-case events map only to their canonical camelized listener;
- derived event listeners replace conflicting listener declarations in `Props`;
- unrelated callback props declared in `Props` remain valid;
- components without an explicit event map retain arbitrary function or function-array `onXxx`
  attributes;
- direct `jsx`, `jsxs`, `jsxDEV`, automatic JSX, and JSX development mode share the contract.

Do not export the listener helper types. Do not change `h()`, `createVNode()`, runtime emit dispatch,
listener arrays, DevTools payloads, DOM listener typing, typed slots, component brands, package
exports, version, changelog, Changesets, CI, release commands, npm tags, or Git release tags. Event
maps whose keys canonicalize to the same listener prop remain unsupported and must not gain new
runtime or type-level validation in this slice.

## File Map

- `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`: source automatic JSX, direct
  factory, strict listener, collision, kebab mapping, and permissive compatibility contracts.
- `tsconfig.jsxdev.json`: compile the source contract under the real `react-jsxdev` transform.
- `scripts/package-consumer-smoke.mjs`: verify generated installed declarations preserve listener
  inference and negative cases.
- `src/jsx-types.ts`: internal shared JSX child, key, DOM listener, component listener, camelization,
  managed props, and factory implementation types.
- `src/jsx-runtime.ts`: use shared component props and expose `LibraryManagedAttributes` without a
  global broad listener escape hatch.
- `src/jsx-dev-runtime.ts`: use the same shared component props for `jsxDEV`.
- `tests/unit/docs/public-contract-docs.test.ts`: English/Chinese listener documentation contract.
- `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`: opt-in listener inference guidance.
- `solace-project-log/solace-entries/2026-08-12-004-typed-component-listener-inference.md`: fresh
  implementation evidence.
- `solace-project-log/index.md`: `2026-08-12` row `004`.

### Task 1: Establish RED source, JSX-dev, and packed listener contracts

**Files:**

- Modify: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Modify: `tsconfig.jsxdev.json`
- Modify: `scripts/package-consumer-smoke.mjs`

- [ ] **Step 1: Expand the source event and props fixtures**

In `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`, import `jsxs` with `jsx`:

```ts
import { jsx, jsxs } from "../../../src/jsx-runtime";
```

Add a kebab-case event and an explicit props collision/unrelated callback contract:

```ts
type CounterEvents = {
  increment: [count: number];
  reset: [];
  rename: [name: string, source?: "user" | "sync"];
  collect: [label: string, ...values: number[]];
  "value-change": [value: number];
};

type TypedEmitterProps = {
  count: number;
  onIncrement?: (count: string) => unknown;
  onFocus?: (reason: string) => unknown;
};
```

Change the typed component declaration to:

```ts
const TypedEmitter = defineComponent<TypedEmitterProps, CounterEvents>((props, { emit }) => {
```

Add the valid producer call before the negative emit cases:

```ts
emit("value-change", props.count);
```

- [ ] **Step 2: Add positive automatic JSX listener contracts**

Replace the current single `<TypedEmitter ... />` expression with:

```tsx
<TypedEmitter
  count={1}
  onIncrement={(count: number) => incrementCalls.push(count)}
  onReset={() => undefined}
  onRename={(name: string, source?: "user" | "sync") => [name, source]}
  onCollect={(label: string, ...values: number[]) => [label, values]}
  onValueChange={(value: number) => value}
  onFocus={(reason: string) => reason}
/>;
<TypedEmitter
  count={1}
  onIncrement={[
    (count: number) => incrementCalls.push(count),
    (count: number) => incrementCalls.push(count + 1),
  ]}
/>;
```

The numeric `onIncrement` proves the derived event listener replaces the conflicting string listener
declared in `TypedEmitterProps`. `onFocus` proves unrelated declared callbacks survive strict mode.

Keep the existing untyped component expression and add a function-array compatibility case:

```tsx
<UntypedEmitter
  onLegacyEvent={(payload: symbol) => payload}
  onOtherEvent={[(value: Date) => value]}
/>;
<Row label="permissive" onAnything={(value: Date) => value} />;
```

- [ ] **Step 3: Add negative automatic JSX listener contracts**

Add these expressions beside the existing TypeScript negative cases:

```tsx
// @ts-expect-error typed listeners reject incompatible event payloads
<TypedEmitter count={1} onIncrement={(count: string) => count} />;

// @ts-expect-error typed listeners reject unknown event listeners
<TypedEmitter count={1} onMissing={() => undefined} />;

// @ts-expect-error zero-argument events reject listeners with required payloads
<TypedEmitter count={1} onReset={(value: number) => value} />;

// @ts-expect-error optional event arguments retain their declared value types
<TypedEmitter count={1} onRename={(name: string, source?: "external") => [name, source]} />;

// @ts-expect-error rest event arguments retain their declared value types
<TypedEmitter count={1} onCollect={(label: string, ...values: string[]) => [label, values]} />;

// @ts-expect-error kebab-case events infer the canonical camelized listener payload
<TypedEmitter count={1} onValueChange={(value: string) => value} />;
```

Use a direct factory call to prove the raw kebab listener prop is not accepted:

```ts
// @ts-expect-error typed kebab-case events only accept canonical camelized listeners
jsx(TypedEmitter, { count: 1, "onValue-change": (value: number) => value });
```

- [ ] **Step 4: Add direct factory strict contracts**

Add positive calls for each factory:

```ts
jsx(TypedEmitter, { count: 1, onIncrement: (count: number) => count });
jsxs(TypedEmitter, {
  count: 1,
  onIncrement: [(count: number) => count],
  children: ["typed"],
});
jsxDEV(TypedEmitter, { count: 1, onValueChange: (value: number) => value });
```

Add direct negative calls:

```ts
// @ts-expect-error direct jsx rejects incompatible typed listener payloads
jsx(TypedEmitter, { count: 1, onIncrement: (count: string) => count });

// @ts-expect-error direct jsxs rejects unknown typed listeners
jsxs(TypedEmitter, { count: 1, onMissing: () => undefined });

// @ts-expect-error direct jsxDEV rejects incompatible typed listener payloads
jsxDEV(TypedEmitter, { count: 1, onValueChange: (value: string) => value });
```

Retain the existing direct non-function listener negatives for permissive components and DOM
elements.

- [ ] **Step 5: Compile the same contract under the JSX development transform**

Change `tsconfig.jsxdev.json` to:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsxdev"
  },
  "include": [
    "examples/basic-counter/src/main.tsx",
    "tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx"
  ]
}
```

This validates automatic `jsxDEV` output instead of relying only on manual `jsxDEV()` calls.

- [ ] **Step 6: Run source typechecks and verify RED**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both commands fail because the current broad component listener index accepts incompatible
payloads and unknown listeners, producing unused `@ts-expect-error` diagnostics. The current
`TypedEmitterProps.onIncrement` string listener may also reject the positive numeric listener before
the event-map-wins rule exists. Fix only mistakes that prevent these intended failures from being
observed.

- [ ] **Step 7: Add packed-consumer listener contracts**

In the generated `main.tsx` inside `scripts/package-consumer-smoke.mjs`, change `ButtonEvents` and the
typed component props to:

```tsx
type ButtonEvents = {
  change: [value: number];
  reset: [];
  "value-change": [value: number];
};

type TypedButtonProps = {
  value: number;
  onChange?: (value: string) => unknown;
  onFocus?: (reason: string) => unknown;
};

const TypedButton = defineComponent<TypedButtonProps, ButtonEvents>((props, { emit }) => {
  emit("change", props.value);
  emit("reset");
  emit("value-change", props.value);

  // @ts-expect-error packaged typed emit rejects unknown events
  emit("missing");
  // @ts-expect-error packaged typed emit rejects incompatible payloads
  emit("change", "1");

  return <button onClick={() => emit("change", props.value)}>{props.value}</button>;
});
```

Add a named import for the direct canonical-listener negative:

```ts
import { jsx as packedJsx } from "@italone/solace/jsx-runtime";
```

Replace the current typed listener expression with:

```tsx
<TypedButton
  value={1}
  onChange={(value: number) => String(value)}
  onValueChange={(value: number) => String(value)}
  onFocus={(reason: string) => reason}
/>;
<TypedButton value={1} onChange={[(value: number) => String(value)]} />;

// @ts-expect-error packaged typed listeners reject incompatible payloads
<TypedButton value={1} onChange={(value: string) => value} />;

// @ts-expect-error packaged typed listeners reject unknown listener names
<TypedButton value={1} onMissing={() => undefined} />;

// @ts-expect-error packaged kebab-case events only accept canonical camelized listeners
packedJsx(TypedButton, { value: 1, "onValue-change": (value: number) => value });

<Button label="legacy" onLegacyEvent={(value: symbol) => value} />;
```

- [ ] **Step 8: Run packed consumer and verify RED**

Run:

```bash
pnpm package:smoke
```

Expected: build, pack, and install may succeed, then the generated consumer TypeScript check fails
because the installed declarations still leave strict listeners broad. Confirm the negative listener
`@ts-expect-error` directives are unused or the positive collision case fails for the missing
event-map-wins rule.

- [ ] **Step 9: Keep the RED tree uncommitted**

Run:

```bash
git status --short
git diff --check
```

Expected changed paths:

```text
M scripts/package-consumer-smoke.mjs
M tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx
M tsconfig.jsxdev.json
```

Do not commit the deliberately failing contract.

### Task 2: Implement shared strict/permissive JSX listener inference

**Files:**

- Create: `src/jsx-types.ts`
- Modify: `src/jsx-runtime.ts`
- Modify: `src/jsx-dev-runtime.ts`
- Test: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Test: `scripts/package-consumer-smoke.mjs`
- Test config: `tsconfig.jsxdev.json`

- [ ] **Step 1: Add the internal shared JSX type module**

Create `src/jsx-types.ts`:

```ts
import type { ComponentEventMap } from "./component/component";
import type { ComponentType, VNodeChild, VNodeProps } from "./vnode/vnode";

export type JSXChild = VNodeChild | number | boolean | null | undefined;
export type JSXChildren = JSXChild | JSXChild[];
export type JSXKey = string | number;

type JSXEventHandler = (...args: never[]) => unknown;
type JSXEventHandlerValue = JSXEventHandler | JSXEventHandler[];
type JSXDomEventHandler = (...args: never[]) => unknown;

export type JSXElementProps = VNodeProps & {
  children?: JSXChildren;
} & {
  [EventHandler in `on${string}`]?: JSXDomEventHandler;
};

type AsciiLowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type AsciiDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type AsciiWordCharacter = AsciiLowercaseLetter | Uppercase<AsciiLowercaseLetter> | AsciiDigit | "_";

type CamelizeEventName<Value extends string> =
  Value extends `${infer Head}-${infer Character}${infer Tail}`
    ? Character extends AsciiWordCharacter
      ? `${Head}${Uppercase<Character>}${CamelizeEventName<Tail>}`
      : `${Head}-${CamelizeEventName<`${Character}${Tail}`>}`
    : Value;

type EventListenerKey<Event extends string> = `on${Capitalize<CamelizeEventName<Event>>}`;
type EventArgs<
  Events extends ComponentEventMap,
  Event extends keyof Events,
> = Events[Event] extends readonly [...infer Args] ? Args : never;
type EventListener<Args extends unknown[]> = (...args: Args) => unknown;
type EventListenerValue<Args extends unknown[]> = EventListener<Args> | EventListener<Args>[];

type PermissiveComponentListenerProps = {
  [EventHandler in `on${string}`]?: JSXEventHandlerValue;
};

type StrictComponentListenerProps<Events extends ComponentEventMap> = {
  [Event in keyof Events & string as EventListenerKey<Event>]?: EventListenerValue<
    EventArgs<Events, Event>
  >;
};

type ComponentListenerProps<Events extends ComponentEventMap> = string extends keyof Events
  ? PermissiveComponentListenerProps
  : StrictComponentListenerProps<Events>;

type ComponentPropsWithListeners<
  Props extends object,
  Events extends ComponentEventMap,
> = string extends keyof Events
  ? Props & ComponentListenerProps<Events>
  : Omit<Props, keyof ComponentListenerProps<Events>> & ComponentListenerProps<Events>;

export type JSXComponentProps<
  Props extends object,
  Events extends ComponentEventMap,
> = ComponentPropsWithListeners<Props, Events> & {
  children?: JSXChildren;
};

export type JSXManagedComponentProps<Component, Props> =
  Component extends ComponentType<infer OwnProps, infer Events>
    ? JSXComponentProps<OwnProps, Events>
    : Props extends object
      ? JSXComponentProps<Props, ComponentEventMap>
      : Props;

export type JSXProps =
  JSXElementProps | JSXComponentProps<object, ComponentEventMap> | { children?: JSXChildren };
```

Keep the existing `normalizeChildren()` runtime function in `src/jsx-runtime.ts`. Moving it would
require runtime imports in this type-only helper and create an unnecessary dependency boundary.

The ASCII character union and recursive mapping match runtime `-(\w)`. Do not replace them with a
shorter rule that removes all hyphens or uppercases punctuation.

- [ ] **Step 2: Replace duplicated runtime-local JSX types**

In `src/jsx-runtime.ts`, remove the local declarations for `JSXChild`, `JSXChildren`, `JSXKey`,
`JSXEventHandler`, `JSXEventHandlerValue`, `JSXDomEventHandler`, `JSXElementProps`, and
`JSXComponentProps`.

Import the shared types:

```ts
import type {
  JSXChildren,
  JSXComponentProps,
  JSXElementProps,
  JSXKey,
  JSXManagedComponentProps,
  JSXProps,
} from "./jsx-types";
```

Remove the now-unused `VNodeProps` import from `./vnode/vnode`. Keep `VNodeChild` only if the existing
`normalizeChildren()` implementation still needs it after formatting.

Change the synchronous component overloads to:

```ts
export function jsx<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;

export function jsxs<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;
```

Delete the local `JSXProps` alias and keep `createJsxVNode()` and `normalizeChildren()` behavior
unchanged.

- [ ] **Step 3: Add LibraryManagedAttributes and close the global escape hatch**

In the exported `JSX` namespace in `src/jsx-runtime.ts`, add:

```ts
export type LibraryManagedAttributes<Component, Props> = JSXManagedComponentProps<Component, Props>;
```

Change `IntrinsicAttributes` to:

```ts
export interface IntrinsicAttributes {
  children?: JSXChildren;
  key?: JSXKey;
}
```

Removing the broad `on${string}` index is mandatory. The permissive branch in
`JSXManagedComponentProps` now owns legacy component listener compatibility, while intrinsic DOM
listeners remain in `IntrinsicElements` through `JSXElementProps`.

- [ ] **Step 4: Reuse the shared types in the development runtime**

In `src/jsx-dev-runtime.ts`, remove all local JSX child/key/handler/element/component/props aliases and
import:

```ts
import type { JSXComponentProps, JSXElementProps, JSXKey, JSXProps } from "./jsx-types";
```

Remove unused `VNodeChild` and `VNodeProps` imports. Change the component overload to:

```ts
export function jsxDEV<Props extends object, Events extends ComponentEventMap>(
  type: ComponentType<Props, Events>,
  props?: JSXComponentProps<Props, Events> | null,
  key?: JSXKey,
): VNode;
```

Keep the runtime delegation to `jsx()` unchanged.

- [ ] **Step 5: Run normal and development typechecks GREEN**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both pass. Every strict-listener `@ts-expect-error` must be consumed, positive collision and
unrelated callback cases must compile, and untyped/ordinary components must remain permissive. If
automatic JSX still accepts `onMissing`, first verify the broad index is absent from
`IntrinsicAttributes`; do not weaken strict props to make the negative pass.

- [ ] **Step 6: Run focused runtime and type-contract tests**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts
```

Expected: both files pass with the existing runtime test inventory. Listener function dispatch,
arrays, kebab-case resolution, and DevTools summaries remain unchanged.

- [ ] **Step 7: Verify generated declarations and installed consumer**

Run serially:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: package tests pass and the installed temporary consumer accepts valid typed listeners while
consuming all listener `@ts-expect-error` cases. Inspect generated declarations if either command
loses `LibraryManagedAttributes`; do not add a new package export.

- [ ] **Step 8: Commit the listener contract**

Run:

```bash
git diff --check
git status --short
git add src/jsx-types.ts src/jsx-runtime.ts src/jsx-dev-runtime.ts \
  tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  tsconfig.jsxdev.json scripts/package-consumer-smoke.mjs
git commit -m "feat: infer typed component listeners"
```

The commit must contain only the six approved paths. No runtime component file, root export,
`package.json`, release file, or built `dist` artifact belongs in this commit.

### Task 3: Document the opt-in listener inference boundary

**Files:**

- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`

- [ ] **Step 1: Update the failing documentation contract**

In `tests/unit/docs/public-contract-docs.test.ts`, replace the English assertion:

```ts
expect(doc).toContain("does not infer precise `onXxx` listener payloads");
```

with:

```ts
expect(doc).toContain("explicit event maps infer precise `onXxx` listener payloads");
expect(doc).toContain("canonical camelized listener");
expect(doc).toContain("function or an array of functions");
```

Replace the Chinese assertion:

```ts
expect(apiZh).toContain("不会推导精确的 `onXxx` listener payload");
```

with:

```ts
expect(apiZh).toContain("显式事件映射会推导精确的 `onXxx` listener payload");
expect(apiZh).toContain("规范的 camelized listener");
expect(apiZh).toContain("函数或函数数组");
```

Retain all current assertions for `ComponentEventMap`, `defineComponent<Props, Events>`, permissive
defaults, compile-time behavior, no runtime validation, and generic component signatures.

- [ ] **Step 2: Run the documentation test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
```

Expected: fail because the current docs still say precise listener inference is deferred.

- [ ] **Step 3: Update the English API event contract**

In `docs/api.md`, extend `CounterEvents` and the example:

```tsx
type CounterEvents = {
  increment: [count: number];
  reset: [];
  "value-change": [value: number];
};

const Counter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => (
  <button onClick={() => emit("increment", props.count)}>{props.count}</button>
));

const App = () => (
  <Counter
    count={1}
    onIncrement={(count: number) => console.log(count)}
    onValueChange={(value: number) => console.log(value)}
  />
);
```

Replace the current deferred-listener paragraph with:

```markdown
Components without an explicit event map remain permissive by default. This contract types events at
compile time and does not add runtime validation. Explicit event maps infer precise `onXxx` listener
payloads in JSX: listeners accept a function or an array of functions whose arguments match the event
tuple. Kebab-case events expose only their canonical camelized listener, so `value-change` maps to
`onValueChange`. This JSX inference does not change the existing broad `h()` props contract.
```

- [ ] **Step 4: Update the Chinese API event contract**

In `docs/api.zh-CN.md`, use the same `CounterEvents`, `Counter`, and `App` code. Replace the deferred
paragraph with:

```markdown
未显式声明事件映射的组件默认保持宽松。这个契约只在编译期约束事件，不增加运行时校验。
显式事件映射会推导精确的 `onXxx` listener payload：listener 可以是函数或函数数组，参数与
事件 tuple 一致。kebab-case 事件只暴露规范的 camelized listener，因此 `value-change` 映射到
`onValueChange`。这个 JSX 推导不会改变 `h()` 现有的宽松 props 契约。
```

- [ ] **Step 5: Update package usage**

In `docs/package-usage.md`, add `"value-change"` and `onValueChange` to the existing counter example,
then replace the deferred paragraph with:

```markdown
`ComponentEventMap` is opt-in: components with no explicit event map remain permissive by default.
It constrains the component's `emit()` calls at compile time and does not add runtime validation.
Explicit event maps infer precise `onXxx` listener payloads in JSX. Each listener accepts a function
or an array of functions whose arguments match the event tuple; kebab-case events expose only their
canonical camelized listener. This inference does not change the existing broad `h()` props contract.
```

- [ ] **Step 6: Run documentation GREEN and formatting checks**

Run:

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts
pnpm exec prettier --check tests/unit/docs/public-contract-docs.test.ts \
  docs/api.md docs/api.zh-CN.md docs/package-usage.md
git diff --check
```

Expected: all pass. Check that no document claims runtime validation, strict listeners for untyped
components, typed `h()` listeners, or React compatibility.

- [ ] **Step 7: Commit documentation**

Run:

```bash
git add tests/unit/docs/public-contract-docs.test.ts docs/api.md docs/api.zh-CN.md \
  docs/package-usage.md
git commit -m "docs: explain typed component listeners"
```

### Task 4: Run final gates and record fresh evidence

**Files:**

- Create: `solace-project-log/solace-entries/2026-08-12-004-typed-component-listener-inference.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Run the complete quality gate**

Run:

```bash
pnpm quality
```

Expected: formatting, build, normal typecheck, Operations Console build, JSX development typecheck,
lint, complete Vitest inventory, and package tests all pass. Record fresh main test and package test
file/test totals from this exact run.

- [ ] **Step 2: Re-run the installed consumer and focused contract**

Run serially:

```bash
pnpm package:smoke
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts \
  tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx \
  tests/unit/component/lifecycle.test.ts
```

Expected: packed consumer passes and all three focused files pass. Record fresh focused totals.

- [ ] **Step 3: Verify the frozen public and release scope**

Run:

```bash
node -p "require('./package.json').version"
git diff e6adb16..HEAD --name-only
git diff e6adb16..HEAD -- package.json CHANGELOG.md .changeset .github/workflows/ci.yml
git diff --check
git status --short --branch
```

Expected:

- version remains `0.1.0-beta.4`;
- package metadata, changelog, Changesets, and CI diff produce no output;
- changed paths are limited to the approved JSX types, contracts, docs, and project-log files;
- worktree is clean before evidence files are written.

- [ ] **Step 4: Write the implementation evidence**

Create `solace-project-log/solace-entries/2026-08-12-004-typed-component-listener-inference.md`:

```markdown
# 2026-08-12-004：增加 typed component listener inference

## 基本信息

- 日期：2026-08-12
- 类型：JSX/TSX ergonomics / public types / tests / docs
- 状态：已完成

## 变动摘要

显式 `ComponentEventMap` 现在会在 JSX 中推导规范的 `onXxx` listener 名称和精确参数 tuple，
支持单个函数与函数数组。kebab-case 事件只映射到 canonical camelized listener；事件映射派生
类型会覆盖 Props 中的同名 listener，其他显式 callback props 保留。未声明事件映射的组件继续
保持宽松 listener 契约。

本切片只改变 JSX 类型。`h()`、runtime emit、listener dispatch、DevTools payload 和 package
exports 未改变。

## 验证记录

| 验证项        | 命令                                                                                                                                                                      | 结果                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Focused       | `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx tests/unit/component/lifecycle.test.ts` | 通过；3 个 test files、18 个 tests         |
| Typechecks    | `pnpm typecheck`、`pnpm typecheck:jsxdev`                                                                                                                                 | 通过；normal 与 JSX-dev contract 均生效    |
| Package tests | `pnpm test:package`                                                                                                                                                       | 通过；1 个 test file、16 个 tests          |
| Packed smoke  | `pnpm package:smoke`                                                                                                                                                      | 通过；安装后声明保留精确 listener contract |
| Quality       | `pnpm quality`                                                                                                                                                            | 通过；主测试为 72 个 files、644 个 tests   |

## 边界

- package version、exports、Router、SSR/SSG/hydration、SFC/Vite、DevTools、CI 与 release commands
  未改变。
- 不包含 typed slots、runtime event validation 或 `h()` listener inference。
- 未运行或声称 `pnpm release:check`。
```

The counts above are the current inventory because this slice adds type expressions inside existing
test files without adding new `it()` blocks. Replace them with the fresh command output if the
inventory changes during implementation.

Add row `004` under `2026-08-12` in `solace-project-log/index.md`:

```markdown
| 004 | 增加 typed component listener inference | JSX/TSX ergonomics、public types、tests、docs | `src/jsx-types.ts`, `src/jsx*-runtime.ts`, `tests/**`, `scripts/package-consumer-smoke.mjs`, `docs/**`, `solace-project-log/**` | [查看](./solace-entries/2026-08-12-004-typed-component-listener-inference.md) |
```

- [ ] **Step 5: Format and verify evidence**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md \
  solace-project-log/solace-entries/2026-08-12-004-typed-component-listener-inference.md
pnpm format:check
git diff --check
```

Expected: all pass. Confirm that the recorded counts match the fresh commands and that the log does
not claim `release:check` ran.

- [ ] **Step 6: Commit evidence**

Run:

```bash
git add solace-project-log/index.md \
  solace-project-log/solace-entries/2026-08-12-004-typed-component-listener-inference.md
git commit -m "docs: record typed component listeners"
```

- [ ] **Step 7: Final no-publish review**

Run:

```bash
git status --short --branch
git log --oneline e6adb16..HEAD
node -p "require('./package.json').version"
```

Expected: clean worktree, local listener implementation commits listed, and version
`0.1.0-beta.4`. Do not push, tag, publish, alter npm dist-tags, or run the release publish workflow
without a separate explicit maintainer decision.
