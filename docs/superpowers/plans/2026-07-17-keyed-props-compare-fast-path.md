# Keyed Props Compare Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative renderer props comparison fast path so large keyed child updates avoid unnecessary props scans and prop patching for child-only updates.

**Architecture:** Keep the optimization local to `src/renderer/diff.ts`. Split element patching into `propsChanged` and `childrenChanged`, skip `patchProps()` when only children changed, and rewrite `havePropsChanged()` to use guarded own-property loops with early returns instead of allocating filtered key arrays. Preserve the existing fallback semantics for changed, added, or removed non-key props.

**Tech Stack:** TypeScript, Vitest, jsdom, Tinybench benchmark config, Solace renderer runtime, pnpm, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add the RED unit test proving child-only keyed updates avoid `Object.keys` props scans.
- Modify `src/renderer/diff.ts`: add the conservative fast path and skip `patchProps()` when only children changed.
- Modify `docs/performance.md`: document the keyed props comparison fast path in the renderer follow-up summary.
- Add `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md`: record implementation and validation.
- Modify `solace-project-log/index.md`: add row `015` under `2026-07-17`.

Do not modify `package.json`, Rollup config, public package exports, `src/devtools/index.ts`, or DevTools event payloads.

---

### Task 1: Add The Failing Props Scan Regression Test

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add the RED test**

In `tests/unit/renderer/diff.test.ts`, add this test after `skips element updates for unchanged keyed siblings` and before `emits devtools summaries for element mount, update, and unmount`:

```ts
it("avoids Object.keys props scans for child-only keyed updates", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  const before = [...container.querySelectorAll("li")];
  const objectKeys = vi.spyOn(Object, "keys");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B selected"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );

  const after = [...container.querySelectorAll("li")];

  expect(after).toEqual(before);
  expect(after.map((li) => li.textContent)).toEqual(["A", "B selected", "C"]);
  expect(objectKeys).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused renderer test to verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new test fails because the current `havePropsChanged()` calls `Object.keys()` during the keyed child update.

Acceptable failure shape:

```text
AssertionError: expected "keys" to not be called at all
```

If the command errors because of a test typo, fix only the typo and rerun until the failure is the expected `Object.keys` call assertion.

---

### Task 2: Implement The Minimal Renderer Fast Path

**Files:**

- Modify: `src/renderer/diff.ts`
- Test: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Split element patching into props and children decisions**

In `src/renderer/diff.ts`, replace the current `patchElement()` and `shouldPatchElement()` block:

```ts
function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const el = n1.el as Element;
  n2.el = el;

  if (!shouldPatchElement(n1, n2)) {
    return;
  }

  patchProps(el, n1.props, n2.props);
  patchChildren(n1, n2, el, parentComponent, appProvides);
  emitRendererElementDevtoolsEvent("update", n2.type as string);
}

function shouldPatchElement(n1: VNode, n2: VNode): boolean {
  return havePropsChanged(n1.props, n2.props) || haveElementChildrenChanged(n1, n2);
}
```

with:

```ts
function patchElement(
  n1: VNode,
  n2: VNode,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  const el = n1.el as Element;
  n2.el = el;

  const propsChanged = havePropsChanged(n1.props, n2.props);
  const childrenChanged = haveElementChildrenChanged(n1, n2);

  if (!propsChanged && !childrenChanged) {
    return;
  }

  if (propsChanged) {
    patchProps(el, n1.props, n2.props);
  }

  if (childrenChanged) {
    patchChildren(n1, n2, el, parentComponent, appProvides);
  }

  emitRendererElementDevtoolsEvent("update", n2.type as string);
}
```

- [ ] **Step 2: Replace `havePropsChanged()` with guarded early-return loops**

In `src/renderer/diff.ts`, replace the current `havePropsChanged()` implementation:

```ts
function havePropsChanged(oldProps: VNodeProps | null, newProps: VNodeProps | null): boolean {
  const previousProps = oldProps ?? {};
  const nextProps = newProps ?? {};
  const previousKeys = Object.keys(previousProps).filter((key) => key !== "key");
  const nextKeys = Object.keys(nextProps).filter((key) => key !== "key");

  if (previousKeys.length !== nextKeys.length) {
    return true;
  }

  return nextKeys.some((key) => previousProps[key] !== nextProps[key]);
}
```

with:

```ts
function havePropsChanged(oldProps: VNodeProps | null, newProps: VNodeProps | null): boolean {
  if (oldProps === newProps) {
    return false;
  }

  if (oldProps === null) {
    return hasPatchableProps(newProps);
  }

  if (newProps === null) {
    return hasPatchableProps(oldProps);
  }

  for (const key in oldProps) {
    if (!hasOwnProp(oldProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(newProps, key) || oldProps[key] !== newProps[key]) {
      return true;
    }
  }

  for (const key in newProps) {
    if (!hasOwnProp(newProps, key) || key === "key") {
      continue;
    }

    if (!hasOwnProp(oldProps, key)) {
      return true;
    }
  }

  return false;
}

function hasPatchableProps(props: VNodeProps | null): boolean {
  if (props === null) {
    return false;
  }

  for (const key in props) {
    if (hasOwnProp(props, key) && key !== "key") {
      return true;
    }
  }

  return false;
}

function hasOwnProp(props: VNodeProps, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}
```

- [ ] **Step 3: Run the focused renderer test to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0. The renderer test count should increase by one.

- [ ] **Step 4: Confirm existing non-key prop and event behavior still passes**

Read the output from Step 3 and confirm the existing tests named:

- `patches props on the same element type`
- `emits devtools summaries for element mount, update, and unmount`

are included in the passing file. If either fails, fix the implementation, not the tests.

---

### Task 3: Update Performance Docs And Implementation Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update the renderer follow-up summary in `docs/performance.md`**

In the `Latest Local Benchmark Run` conclusion paragraph, replace this sentence fragment:

```md
skip stable child component updates when parent rerenders do not change child props or children, and skip
unchanged keyed element sibling patches during local list updates.
```

with:

```md
skip stable child component updates when parent rerenders do not change child props or children, skip
unchanged keyed element sibling patches during local list updates, and avoid prop patching plus `Object.keys`
props scans for keyed child-only updates.
```

Keep the rest of the paragraph unchanged.

- [ ] **Step 2: Add the implementation log**

Create `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md`:

```md
# 2026-07-17-015：优化 keyed props compare fast path

## 基本信息

- 日期：2026-07-17
- 类型：renderer performance / unit test / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 renderer element patch 增加 props comparison 快速路径：child-only keyed update 不再执行无意义的 prop patching，也避免在 key-only props 场景中调用 `Object.keys()` 扫描 props。

## 变动原因

最新 browser benchmark trend 显示 10,000 行 large-list selected-row update 是当前有基准支撑的优化方向。相比继续扩展 Fragment 或 component batching，本次切片只收紧 renderer props comparison 和 child-only update 路径，风险更低。

## 影响范围

- 影响模块：renderer diff、renderer 单元测试、性能文档、项目日志。
- 行为变化：无 public API 变化；changed/added/removed non-key props 仍按原语义 patch。
- 风险等级：中低；主要风险是误判 props 未变化，已用现有 props/event 测试和新增 key-only child update 测试覆盖。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                               |
| ----------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `src/renderer/diff.ts`                                                              | 修改 | 增加 props comparison fast path 和 child-only skip |
| `tests/unit/renderer/diff.test.ts`                                                  | 修改 | 增加 key-only child update props scan 回归测试     |
| `docs/performance.md`                                                               | 修改 | 记录本次 renderer 性能优化                         |
| `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md` | 新增 | 记录本次变更                                       |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-17 日志索引                           |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果       |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 待最终验证 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 待最终验证 |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 待最终验证 |
| Tests                  | `pnpm test`                                                                                     | 待最终验证 |
| Typecheck              | `pnpm typecheck`                                                                                | 待最终验证 |
| Lint                   | `pnpm lint`                                                                                     | 待最终验证 |
| Build                  | `pnpm build`                                                                                    | 待最终验证 |
| 格式检查               | `pnpm format:check`                                                                             | 待最终验证 |
| Diff whitespace        | `git diff --check`                                                                              | 待最终验证 |
| Private boundary       | `package.json`                                                                                  | 待最终验证 |

## 后续动作

- 后续 renderer 性能优化继续以 benchmark 和 narrow TDD regression 为入口；不要在没有稳定性信号的情况下扩大 keyed diff 重写范围。
```

- [ ] **Step 3: Add the project log index row**

In `solace-project-log/index.md`, add row `015` under `2026-07-17`:

```md
| 015 | 优化 keyed props compare fast path | renderer diff、单元测试、性能文档、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md) |
```

---

### Task 4: Validate And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted renderer and benchmark validation**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Run full default test suite**

Run:

```bash
pnpm test
```

Expected: exits with code 0. Test count should increase by one compared with the current baseline of 23 files / 174 tests.

- [ ] **Step 4: Run static and build checks**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 5: Skip package checks unless public package boundaries changed**

If `package.json`, `rollup.config.mjs`, `src/devtools/index.ts`, package exports tests, or public entry points changed, run:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: both commands exit with code 0.

If none of those files changed, skip this step and record that package checks were not required because public package boundaries were unchanged.

- [ ] **Step 6: Update the project log validation table**

Replace each `待最终验证` in `solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md` with observed command results. Include the final `pnpm test` file/test counts.

- [ ] **Step 7: Commit**

Run:

```bash
git status --short --branch
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-015-keyed-props-compare-fast-path.md
git commit -m "perf: optimize keyed props comparison"
```

Expected: commit succeeds. Do not push.
