# Component Emit DevTools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a privacy-minimized `component:emit` DevTools summary whenever a component calls `emit()`.

**Architecture:** Extend the internal DevTools event union and serializer with a `component:emit` summary event. Emit that summary from `src/component/component.ts` only when DevTools listeners exist, using the already resolved handler to count callable handlers without touching emitted args. Update component tests, payload stability tests, docs, and project logs.

**Tech Stack:** TypeScript, Solace component runtime, internal DevTools event bus, Vitest, Markdown, Prettier.

---

## File Structure

- Modify `tests/unit/component/lifecycle.test.ts`: add RED tests for single handler, handler arrays, missing handlers, and no-argument leakage.
- Modify `tests/integration/devtools-payload-stability.test.ts`: add `component:emit` allowed payload keys and an integrated emit event.
- Modify `src/devtools/events.ts`: add the event union member and serializer branch.
- Modify `src/component/component.ts`: import DevTools helpers, count resolved handlers, and emit the guarded summary before invoking handlers.
- Modify `docs/devtools.md`: document `component:emit`, privacy boundary, and roadmap status.
- Add `solace-project-log/solace-entries/2026-07-15-003-component-emit-devtools.md`: record this change after validation.
- Modify `solace-project-log/index.md`: add the `2026-07-15` `003` row after validation.

The workspace is not currently a Git repository, so omit commit steps unless Git is initialized before execution.

---

### Task 1: Add Failing Component Emit Tests

**Files:**

- Modify: `tests/unit/component/lifecycle.test.ts`

- [ ] **Step 1: Add a single-handler summary test**

Add this test after `"emits component events to parent listeners"`:

```ts
it("emits devtools summaries for component emits", () => {
  const events: DevtoolsEvent[] = [];
  const container = document.createElement("div");
  const onChange = vi.fn();
  const Emitter =
    (
      _props: { onChange?: (value: string) => void },
      { emit }: { emit: (event: string, ...args: unknown[]) => void },
    ) =>
    () =>
      h("button", { onClick: () => emit("change", "secret-value") }, "emit");

  onDevtoolsEvent((event) => {
    events.push(event);
  });

  render(h(Emitter, { onChange }), container);
  container.querySelector("button")?.click();

  const emitEvent = events.find((event) => event.type === "component:emit");

  expect(onChange).toHaveBeenCalledWith("secret-value");
  expect(emitEvent).toEqual({
    type: "component:emit",
    id: expect.any(Number),
    name: "Emitter",
    event: "change",
    handlerCount: 1,
  });
  expect(JSON.stringify(emitEvent)).not.toContain("secret-value");
});
```

- [ ] **Step 2: Add an array-handler summary test**

Add this test after `"emits component events to listener arrays"`:

```ts
it("counts callable listener array entries in devtools emit summaries", () => {
  const events: DevtoolsEvent[] = [];
  const container = document.createElement("div");
  const first = vi.fn();
  const second = vi.fn();
  const Emitter =
    (
      _props: { onChange?: Array<unknown> },
      { emit }: { emit: (event: string, ...args: unknown[]) => void },
    ) =>
    () =>
      h("button", { onClick: () => emit("change", "next") }, "emit");

  onDevtoolsEvent((event) => {
    events.push(event);
  });

  render(h(Emitter, { onChange: [first, "ignored", second] }), container);
  container.querySelector("button")?.click();

  const emitEvent = events.find((event) => event.type === "component:emit");

  expect(first).toHaveBeenCalledWith("next");
  expect(second).toHaveBeenCalledWith("next");
  expect(emitEvent).toMatchObject({
    type: "component:emit",
    name: "Emitter",
    event: "change",
    handlerCount: 2,
  });
});
```

- [ ] **Step 3: Add a missing-handler summary test**

Add this test after the array-handler summary test:

```ts
it("emits devtools summaries for component emits without handlers", () => {
  const events: DevtoolsEvent[] = [];
  const container = document.createElement("div");
  const Emitter =
    (_props: object, { emit }: { emit: (event: string, ...args: unknown[]) => void }) =>
    () =>
      h("button", { onClick: () => emit("missing", "not-captured") }, "emit");

  onDevtoolsEvent((event) => {
    events.push(event);
  });

  render(h(Emitter), container);
  container.querySelector("button")?.click();

  const emitEvent = events.find((event) => event.type === "component:emit");

  expect(emitEvent).toEqual({
    type: "component:emit",
    id: expect.any(Number),
    name: "Emitter",
    event: "missing",
    handlerCount: 0,
  });
  expect(JSON.stringify(emitEvent)).not.toContain("not-captured");
});
```

- [ ] **Step 4: Verify RED for component tests**

Run:

```bash
pnpm test -- tests/unit/component/lifecycle.test.ts
```

Expected: fails with TypeScript or assertion errors because `component:emit` is not yet part of `DevtoolsEvent` and no summary is emitted.

---

### Task 2: Add Failing Payload Stability Coverage

**Files:**

- Modify: `tests/integration/devtools-payload-stability.test.ts`

- [ ] **Step 1: Add allowed keys for `component:emit`**

In `allowedKeysByType`, add this entry after `component:unmount`:

```ts
  "component:emit": ["event", "handlerCount", "id", "name", "type"],
```

- [ ] **Step 2: Update the integrated component to emit an event**

Replace:

```ts
const Counter = () => () => h("button", null, `count: ${store.state.count}`);
```

with:

```ts
const onChange = () => undefined;
const Counter =
  (_props: { onChange?: () => void }, { emit }: { emit: (event: string) => void }) =>
  () =>
    h("button", { onClick: () => emit("change") }, `count: ${store.state.count}`);
```

- [ ] **Step 3: Render the component with a handler and click it**

Replace:

```ts
render(h(Counter), container);
```

with:

```ts
render(h(Counter, { onChange }), container);
container.querySelector("button")?.click();
```

- [ ] **Step 4: Update expected integrated event order**

Replace the expected event type array with:

```ts
expect(events.map((event) => event.type)).toEqual([
  "renderer:element",
  "component:mount",
  "component:emit",
  "reactivity:trigger",
  "store:action",
  "renderer:element",
  "component:update",
  "scheduler:flush",
  "renderer:element",
  "component:unmount",
  "renderer:element",
]);
```

- [ ] **Step 5: Verify RED for payload stability**

Run:

```bash
pnpm test -- tests/integration/devtools-payload-stability.test.ts
```

Expected: fails because `component:emit` is not yet emitted or serialized.

---

### Task 3: Implement The DevTools Event Type And Serializer

**Files:**

- Modify: `src/devtools/events.ts`

- [ ] **Step 1: Add the event union member**

Add this union member after `component:unmount`:

```ts
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
```

- [ ] **Step 2: Add serializer handling**

Add this `switch` branch after the component lifecycle branch:

```ts
    case "component:emit":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        event: event.event,
        handlerCount: event.handlerCount,
      };
```

- [ ] **Step 3: Run TypeScript to expose remaining runtime work**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0; this step ensures the event type and serializer branch compile before runtime wiring.

---

### Task 4: Emit Guarded Component Emit Summaries

**Files:**

- Modify: `src/component/component.ts`

- [ ] **Step 1: Import DevTools helpers**

At the top of `src/component/component.ts`, add:

```ts
import { emitDevtoolsEvent, hasDevtoolsListeners } from "../devtools/events";
```

- [ ] **Step 2: Emit the summary after resolving the handler**

In `emit(instance, event, ...args)`, after:

```ts
const handler = resolveEmitHandler(instance.vnode.props, event);
```

add:

```ts
emitComponentEmitDevtoolsEvent(instance, event, handler);
```

- [ ] **Step 3: Add helper functions before `resolveEmitHandler`**

Add these helpers after `emit()` and before `resolveEmitHandler()`:

```ts
function emitComponentEmitDevtoolsEvent(
  instance: ComponentInstance,
  event: string,
  handler: unknown,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type: "component:emit",
    id: instance.devtoolsId,
    name: getComponentDevtoolsName(instance),
    event,
    handlerCount: countEmitHandlers(handler),
  });
}

function countEmitHandlers(handler: unknown): number {
  if (typeof handler === "function") {
    return 1;
  }

  if (Array.isArray(handler)) {
    return handler.filter((item) => typeof item === "function").length;
  }

  return 0;
}
```

- [ ] **Step 4: Verify component tests are GREEN**

Run:

```bash
pnpm test -- tests/unit/component/lifecycle.test.ts
```

Expected: exits with code 0 and includes the new component emit summary tests.

- [ ] **Step 5: Verify payload stability is GREEN**

Run:

```bash
pnpm test -- tests/integration/devtools-payload-stability.test.ts
```

Expected: exits with code 0 and verifies `component:emit` exposes only allowed scalar fields.

---

### Task 5: Update DevTools Documentation

**Files:**

- Modify: `docs/devtools.md`

- [ ] **Step 1: Update candidate capability notes**

In the Candidate Capabilities table, replace the Components note with:

```md
Component lifecycle and emit summaries are emitted by the internal event bus
```

- [ ] **Step 2: Update the event union docs**

In the documented `DevtoolsEvent` union, add this member after `component:unmount`:

```ts
  | { type: "component:emit"; id: number; name: string; event: string; handlerCount: number }
```

- [ ] **Step 3: Add emit privacy wording**

After the documented event union code block, add:

```md
`component:emit` summaries include the component id, component name, emitted event name, and callable handler count only.
They do not include emitted arguments, raw props, handler functions, component instances, VNodes, DOM nodes, or user
content.
```

- [ ] **Step 4: Update the roadmap**

In the Phased Roadmap, insert this item after component lifecycle summaries:

```md
5. **Component emit summaries**: `component:emit` is emitted with event name and callable handler count only.
```

Then renumber the remaining roadmap items.

- [ ] **Step 5: Format DevTools docs**

Run:

```bash
pnpm exec prettier --write docs/devtools.md
```

Expected: exits with code 0.

---

### Task 6: Add Project Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-15-003-component-emit-devtools.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add project log entry after validation commands have run**

Create `solace-project-log/solace-entries/2026-07-15-003-component-emit-devtools.md` with this structure, replacing validation rows with observed command results from Task 7:

```md
# 2026-07-15-003：接入 component emit DevTools summary

## 基本信息

- 日期：2026-07-15
- 类型：DevTools runtime hook / component emit / payload stability / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `component:emit` DevTools summary。组件调用 `emit()` 时，DevTools listener 可观察 component id、component name、event name 和 callable handler count。payload 不包含 emitted args、props、handler 函数、VNode、DOM 或组件实例。

## 变动原因

DevTools 已有 component lifecycle、scheduler、store、reactivity、renderer 和 public subpath。组件 emits 已在 DevTools 候选能力中列为有用信号，本次补齐最小 summary payload，同时保持隐私和 runtime 边界。

## 影响范围

- 影响模块：component emit runtime、DevTools event union、DevTools serializer、component 单元测试、payload stability 集成测试、DevTools 文档、项目日志。
- 行为变化：存在 DevTools listener 时，component emit 会额外派发 `component:emit` summary；无 listener 时不做额外 summary work。
- 风险等级：中；涉及 component emit 热路径，但通过 listener guard 避免默认开销。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                 |
| ----------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `src/component/component.ts`                                                  | 修改 | emit 时派发 guarded DevTools summary |
| `src/devtools/events.ts`                                                      | 修改 | 新增 `component:emit` 类型和序列化   |
| `tests/unit/component/lifecycle.test.ts`                                      | 修改 | 覆盖 emit summary 和 handler count   |
| `tests/integration/devtools-payload-stability.test.ts`                        | 修改 | 验证 payload allowed fields          |
| `docs/devtools.md`                                                            | 修改 | 记录 component emit summary 边界     |
| `docs/superpowers/specs/2026-07-15-component-emit-devtools-design.md`         | 新增 | 记录设计                             |
| `docs/superpowers/plans/2026-07-15-component-emit-devtools.md`                | 新增 | 记录实施计划                         |
| `solace-project-log/index.md`                                                 | 修改 | 追加 2026-07-15 日志索引             |
| `solace-project-log/solace-entries/2026-07-15-003-component-emit-devtools.md` | 新增 | 记录本次变更                         |

## 验证记录

| 验证项            | 命令或方式                                                                                                 | 结果 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| Targeted tests    | `pnpm test -- tests/unit/component/lifecycle.test.ts tests/integration/devtools-payload-stability.test.ts` | 通过 |
| Tests             | `pnpm test`                                                                                                | 通过 |
| Typecheck         | `pnpm typecheck`                                                                                           | 通过 |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                                                                    | 通过 |
| Lint              | `pnpm lint`                                                                                                | 通过 |
| Build             | `pnpm build`                                                                                               | 通过 |
| 格式检查          | `pnpm format:check`                                                                                        | 通过 |

## 后续动作

- 后续扩展 component DevTools payload 时继续避免 emitted args、props 和 handler 函数泄露。
- 可继续评估 renderer diff count 或 scheduler stale job summary。
```

- [ ] **Step 2: Add log index row**

Under `## 2026-07-15` in `solace-project-log/index.md`, add this row after `002`:

```md
| 003 | 接入 component emit DevTools summary | component emit、DevTools payload、文档、项目日志 | `src/component/component.ts`, `src/devtools/events.ts`, `tests/unit/component/lifecycle.test.ts`, `tests/integration/devtools-payload-stability.test.ts`, `docs/devtools.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-003-component-emit-devtools.md) |
```

- [ ] **Step 3: Format log files**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md solace-project-log/solace-entries/2026-07-15-003-component-emit-devtools.md docs/superpowers/plans/2026-07-15-component-emit-devtools.md
```

Expected: exits with code 0.

---

### Task 7: Final Validation

**Files:**

- All touched files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test -- tests/unit/component/lifecycle.test.ts tests/integration/devtools-payload-stability.test.ts
```

Expected: exits with code 0.

- [ ] **Step 2: Run default tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 3: Run TypeScript checks**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both commands exit with code 0.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 5: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 6: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
