# Component Update Pending Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce repeated scheduler enqueue attempts for component updates that are already pending in the same tick.

**Architecture:** Keep the change local to the component update path. Add a pending flag to `ComponentInstance`, set it before queueing a component update, and clear it in a `finally` block around the queued update work. Preserve existing scheduler ordering, dedupe behavior, `nextTick()` timing, and component render semantics.

**Tech Stack:** TypeScript, Vitest, jsdom, tinybench, Solace renderer/runtime, pnpm, Prettier.

---

## File Structure

- Modify `tests/unit/component/component.test.ts`: add a regression test that proves repeated synchronous mutations queue each mounted component only once before `nextTick()`.
- Modify `src/component/component.ts`: add the internal pending flag to `ComponentInstance`.
- Modify `src/renderer/diff.ts`: set and clear the pending flag around component update queueing.
- Modify `docs/performance.md`: note that component updates now avoid repeated enqueue attempts while pending.
- Add `solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md`: record implementation and validation.
- Modify `solace-project-log/index.md`: add the `2026-07-20` log row for the implementation.

Do not modify public package exports, scheduler ordering semantics, DevTools payloads, benchmark thresholds, or browser benchmark harnesses.

---

### Task 1: Add The Failing Pending-Guard Regression Test

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add the RED test and the scheduler spy import**

Add this import near the top of `tests/unit/component/component.test.ts`:

```ts
import * as scheduler from "../../../src/scheduler/scheduler";
```

Update the existing `afterEach()` block to restore mocks:

```ts
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
```

Add this test after `it("skips child component updates when parent rerenders with unchanged props", async () => { ... })`:

```ts
it("queues each pending component update only once per tick", async () => {
  const state = reactive({ count: 0 });
  const queueJob = vi.spyOn(scheduler, "queueJob");
  const container = document.createElement("div");
  const childCount = 20;
  const Child = (props: { index: number }) => () =>
    h("span", { "data-index": props.index }, `item ${props.index}: ${state.count}`);
  const Parent = () => () =>
    h(
      "div",
      null,
      Array.from({ length: childCount }, (_, index) => h(Child, { key: index, index })),
    );

  render(h(Parent), container);
  queueJob.mockClear();

  state.count = 1;
  state.count = 2;
  state.count = 3;

  expect(queueJob).toHaveBeenCalledTimes(childCount);

  await nextTick();

  expect(container.querySelector('[data-index="0"]')?.textContent).toBe("item 0: 3");
  expect(container.querySelector(`[data-index="${childCount - 1}"]`)?.textContent).toBe(
    `item ${childCount - 1}: 3`,
  );

  state.count = 4;
  await nextTick();

  expect(queueJob).toHaveBeenCalledTimes(childCount * 2);
});
```

- [ ] **Step 2: Run the component test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: the new test fails because each synchronous mutation still calls `queueJob()` for every component before a flush.

---

### Task 2: Add The Pending Flag And Queue Guard

**Files:**

- Modify: `src/component/component.ts`
- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Add the pending flag to the component instance type and constructor**

In `src/component/component.ts`, extend `ComponentInstance` and `createComponentInstance()` with a boolean flag:

```ts
export interface ComponentInstance {
  vnode: VNode;
  type: ComponentType<never>;
  parent: ComponentInstance | null;
  appProvides: Provides | null;
  props: ComponentProps;
  provides: Provides;
  slots: Slots;
  setupState: Record<string, unknown>;
  subTree: VNode | null;
  devtoolsId: number;
  isMounted: boolean;
  isUnmounted: boolean;
  isUpdateQueued: boolean;
  render: ComponentRender;
  effect: ReactiveEffect<void> | null;
  update: (() => void) | null;
  emit: EmitFn;
  mounted: LifecycleHook[];
  updated: LifecycleHook[];
  unmounted: LifecycleHook[];
}
```

Initialize it in `createComponentInstance()`:

```ts
const instance: ComponentInstance = {
  vnode,
  type: vnode.type as ComponentType,
  parent,
  appProvides,
  props: {},
  provides: new Map(),
  slots: {},
  setupState: {},
  subTree: null,
  devtoolsId: nextComponentDevtoolsId,
  isMounted: false,
  isUnmounted: false,
  isUpdateQueued: false,
  render: () => {
    throw new Error("Component render function called before setup");
  },
  effect: null,
  update: null,
  emit: () => undefined,
  mounted: [],
  updated: [],
  unmounted: [],
};
```

- [ ] **Step 2: Guard the component scheduler callback in the renderer**

In `src/renderer/diff.ts`, update `mountComponent()` so the component scheduler only queues once while pending and clears the flag in a `finally` block when the queued job runs:

```ts
function mountComponent(
  vnode: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const instance = createComponentInstance(vnode, parentComponent, appProvides);
  vnode.component = instance;

  setupComponent(instance);

  const componentUpdate = (): void => {
    try {
      if (instance.isUnmounted) {
        return;
      }

      if (!instance.isMounted) {
        const subTree = instance.render();
        instance.subTree = subTree;
        patch(null, subTree, container, anchor, instance, instance.appProvides);
        vnode.el = subTree.el;
        instance.isMounted = true;
        callHooks(instance.mounted);
        emitComponentDevtoolsEvent("component:mount", instance);
        return;
      }

      const nextTree = instance.render();
      const previousTree = instance.subTree;

      patch(previousTree, nextTree, container, anchor, instance, instance.appProvides);

      instance.subTree = nextTree;
      instance.vnode.el = nextTree.el;
      callHooks(instance.updated);
      emitComponentDevtoolsEvent("component:update", instance);
    } finally {
      instance.isUpdateQueued = false;
    }
  };
  const queueComponentUpdate = (): void => {
    if (instance.update === null || instance.isUpdateQueued) {
      return;
    }

    instance.isUpdateQueued = true;
    queueJob(instance.update);
  };
  const reactiveEffect = new ReactiveEffect(componentUpdate, queueComponentUpdate);

  instance.effect = reactiveEffect;
  instance.update = reactiveEffect.run.bind(reactiveEffect);
  instance.update();
}
```

- [ ] **Step 3: Run the component test to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0, and the new test passes with the existing component suite.

---

### Task 3: Update Performance Docs And Project Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update the performance note**

In `docs/performance.md`, add a short sentence near the current renderer follow-up summary that says the component update path now avoids repeated enqueue attempts while a component update is already pending.

Use wording like:

```md
The current component update path also avoids repeated enqueue attempts while a component update is already pending.
```

Keep the existing browser-trend and renderer summary text intact.

- [ ] **Step 2: Add the implementation log entry**

Create `solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md` with the same structure as the other 2026-07-20 log entries:

```md
# 2026-07-20-003：设计 component update pending guard

## 基本信息

- 日期：2026-07-20
- 类型：performance implementation / component scheduler / project log
- 状态：已完成

## 变动摘要

实现 component update pending guard，减少同一 tick 内重复的 component update enqueue attempt。

## 影响范围

- 影响模块：component update path、scheduler enqueue pressure、component benchmark、性能文档、项目日志。

## 涉及文件

| 文件                                                                                 | 动作 | 说明                                 |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------ |
| `src/component/component.ts`                                                         | 修改 | 增加 component instance pending flag |
| `src/renderer/diff.ts`                                                               | 修改 | 组件 update queue guard              |
| `tests/unit/component/component.test.ts`                                             | 修改 | 覆盖 pending guard 行为              |
| `docs/performance.md`                                                                | 修改 | 记录 component batching 跟进         |
| `solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md` | 新增 | 记录本次变更                         |
| `solace-project-log/index.md`                                                        | 修改 | 追加 2026-07-20 日志索引             |

## 验证记录

| 验证项                   | 命令或方式                                                                                             | 结果 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---- |
| Targeted component tests | `pnpm vitest run tests/unit/component/component.test.ts`                                               | 通过 |
| Component benchmark      | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts` | 通过 |
| Format check             | `pnpm format:check`                                                                                    | 通过 |
| Diff whitespace          | `git diff --check`                                                                                     | 通过 |
```

- [ ] **Step 3: Add the log index row**

Add a `2026-07-20` row to `solace-project-log/index.md`:

```md
| 003 | 设计 component update pending guard | performance 设计、component scheduler、项目日志 | `docs/superpowers/specs/2026-07-20-component-update-pending-guard-design.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-20-003-component-update-pending-guard.md) |
```

---

### Task 4: Final Validation And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/component/component.ts src/renderer/diff.ts tests/unit/component/component.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-component-update-pending-guard-design.md docs/superpowers/plans/2026-07-20-component-update-pending-guard.md solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run the focused component test**

Run:

```bash
pnpm vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run the component benchmark**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts
```

Expected: exits with code 0 and logs both component update benchmark tasks.

- [ ] **Step 4: Run the full validation set**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/component/component.ts src/renderer/diff.ts tests/unit/component/component.test.ts docs/performance.md docs/superpowers/specs/2026-07-20-component-update-pending-guard-design.md docs/superpowers/plans/2026-07-20-component-update-pending-guard.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-20-003-component-update-pending-guard.md
git commit -m "perf: add component update pending guard"
```

Expected: one focused commit with the runtime change, benchmark validation, and documentation/log updates.
