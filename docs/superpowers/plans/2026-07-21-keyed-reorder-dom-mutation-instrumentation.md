# Keyed Reorder DOM Mutation Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser benchmark diagnostics that count DOM mutations during the keyed reorder update window.

**Architecture:** Keep runtime renderer code unchanged. Add a small benchmark-only DOM mutation counter in `examples/performance-benchmark/src/main.tsx`, include the counts in the keyed reorder result and browser history type, then document the counters as diagnostic data for selecting the next renderer performance slice.

**Tech Stack:** TypeScript, Playwright, Vite production preview, Vitest, Node ESM, Markdown, Prettier.

---

## File Structure

- Modify `examples/performance-benchmark/src/main.tsx`: add `DomMutationCounts`, wrap DOM prototype methods during the measured keyed reorder update only, and include counts in the keyed reorder result.
- Modify `tests/e2e/browser-benchmark.spec.ts`: assert `domMutationCounts` exists for `keyed-reorder` summaries and has the expected stable reorder signal.
- Modify `tests/e2e/browser-benchmark-history.ts`: widen the keyed reorder history type to include `domMutationCounts`.
- Modify `tests/unit/scripts/browser-benchmark-history.test.ts`: prove keyed reorder history append preserves `domMutationCounts`.
- Modify `docs/performance.md`: document the keyed reorder DOM mutation counters and their diagnostic meaning.
- Add `solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md`: record the implementation change.
- Modify `solace-project-log/index.md`: append the implementation row after this plan row.

No changes should be made to `src/renderer/diff.ts`, keyed LIS movement, public API exports, package metadata, release flow, or `.benchmark-history/**`.

---

### Task 1: Add Failing Browser Benchmark Assertions

**Files:**

- Modify: `tests/e2e/browser-benchmark.spec.ts`
- Modify: `tests/e2e/browser-benchmark-history.ts`
- Modify: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [ ] **Step 1: Widen the browser history keyed reorder result type**

In `tests/e2e/browser-benchmark-history.ts`, add this exported type above `BrowserBenchmarkHistoryResult`:

```ts
export type DomMutationCounts = {
  insertBefore: number;
  setAttribute: number;
  removeAttribute: number;
  textContent: number;
  removeChild: number;
};
```

Then change the `keyed-reorder` branch of `BrowserBenchmarkHistoryResult` to:

```ts
  | {
      scenario: "keyed-reorder";
      rows: number;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText: string;
      remainingNodesAfterUnmount: number;
      domMutationCounts: DomMutationCounts;
    };
```

- [ ] **Step 2: Import the counter type in the Playwright benchmark test**

In `tests/e2e/browser-benchmark.spec.ts`, extend the existing import:

```ts
  type BrowserBenchmarkHistoryMetadata,
  type BrowserBenchmarkHistoryResult,
  type BrowserBenchmarkHistorySummary,
  type DomMutationCounts,
} from "./browser-benchmark-history";
```

- [ ] **Step 3: Add assertion helpers**

In `tests/e2e/browser-benchmark.spec.ts`, add this helper near `expectFinitePositive()`:

```ts
function expectDomMutationCounts(counts: DomMutationCounts): void {
  expectNonNegativeInteger(counts.insertBefore);
  expectNonNegativeInteger(counts.setAttribute);
  expectNonNegativeInteger(counts.removeAttribute);
  expectNonNegativeInteger(counts.textContent);
  expectNonNegativeInteger(counts.removeChild);
}

function expectNonNegativeInteger(value: number): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}
```

- [ ] **Step 4: Assert keyed reorder counter signal**

In `expectBrowserBenchmarkResult()`, replace the keyed reorder branch after `expectFinitePositive(result.reorderMs);`
with:

```ts
expectFinitePositive(result.reorderMs);
expect(result.firstRowText).toBe("Row 10000");
expectDomMutationCounts(result.domMutationCounts);
expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
expect(result.domMutationCounts.setAttribute).toBe(0);
expect(result.domMutationCounts.removeAttribute).toBe(0);
expect(result.domMutationCounts.textContent).toBe(0);
expect(result.domMutationCounts.removeChild).toBe(0);
```

- [ ] **Step 5: Add history append coverage**

In `tests/unit/scripts/browser-benchmark-history.test.ts`, update the keyed reorder summary fixture to include:

```ts
  domMutationCounts: {
    insertBefore: 9999,
    setAttribute: 0,
    removeAttribute: 0,
    textContent: 0,
    removeChild: 0,
  },
```

Then add an assertion after parsing the appended record:

```ts
expect(record.summary).toMatchObject({
  scenario: "keyed-reorder",
  reorderMs: 2,
  firstRowText: "Row 10000",
  domMutationCounts: {
    insertBefore: 9999,
    setAttribute: 0,
    removeAttribute: 0,
    textContent: 0,
    removeChild: 0,
  },
});
```

- [ ] **Step 6: Verify RED**

Run:

```bash
pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts
pnpm benchmark:browser
```

Expected: the unit test typecheck or fixture compilation fails until the benchmark result type and fixture agree, and
`pnpm benchmark:browser` fails because the browser fixture does not yet return `domMutationCounts`.

---

### Task 2: Implement Benchmark-Only DOM Mutation Counting

**Files:**

- Modify: `examples/performance-benchmark/src/main.tsx`
- Modify: `tests/e2e/browser-benchmark.spec.ts`

- [ ] **Step 1: Add the result counter type**

In `examples/performance-benchmark/src/main.tsx`, add this type below `BrowserBenchmarkScenario`:

```ts
type DomMutationCounts = {
  insertBefore: number;
  setAttribute: number;
  removeAttribute: number;
  textContent: number;
  removeChild: number;
};
```

Then add `domMutationCounts: DomMutationCounts;` to the `keyed-reorder` branch of `BrowserBenchmarkResult`.

- [ ] **Step 2: Add the async counter helper**

In `examples/performance-benchmark/src/main.tsx`, add this helper above `runKeyedReorderBenchmark()`:

```ts
async function measureDomMutations<T>(run: () => Promise<T>): Promise<{
  result: T;
  counts: DomMutationCounts;
}> {
  const counts: DomMutationCounts = {
    insertBefore: 0,
    setAttribute: 0,
    removeAttribute: 0,
    textContent: 0,
    removeChild: 0,
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  const originalRemoveChild = Node.prototype.removeChild;
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalRemoveAttribute = Element.prototype.removeAttribute;
  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");

  if (textContentDescriptor?.set === undefined || textContentDescriptor.get === undefined) {
    throw new Error("Unable to instrument Node.textContent");
  }

  Node.prototype.insertBefore = function insertBeforeWithCount<TNode extends Node>(
    this: Node,
    node: TNode,
    child: Node | null,
  ): TNode {
    counts.insertBefore += 1;
    return originalInsertBefore.call(this, node, child) as TNode;
  };

  Node.prototype.removeChild = function removeChildWithCount<TNode extends Node>(
    this: Node,
    child: TNode,
  ): TNode {
    counts.removeChild += 1;
    return originalRemoveChild.call(this, child) as TNode;
  };

  Element.prototype.setAttribute = function setAttributeWithCount(
    this: Element,
    qualifiedName: string,
    value: string,
  ): void {
    counts.setAttribute += 1;
    originalSetAttribute.call(this, qualifiedName, value);
  };

  Element.prototype.removeAttribute = function removeAttributeWithCount(
    this: Element,
    qualifiedName: string,
  ): void {
    counts.removeAttribute += 1;
    originalRemoveAttribute.call(this, qualifiedName);
  };

  Object.defineProperty(Node.prototype, "textContent", {
    configurable: textContentDescriptor.configurable,
    enumerable: textContentDescriptor.enumerable,
    get(this: Node): string | null {
      return textContentDescriptor.get.call(this);
    },
    set(this: Node, value: string | null): void {
      counts.textContent += 1;
      textContentDescriptor.set.call(this, value);
    },
  });

  try {
    return {
      result: await run(),
      counts,
    };
  } finally {
    Node.prototype.insertBefore = originalInsertBefore;
    Node.prototype.removeChild = originalRemoveChild;
    Element.prototype.setAttribute = originalSetAttribute;
    Element.prototype.removeAttribute = originalRemoveAttribute;
    Object.defineProperty(Node.prototype, "textContent", textContentDescriptor);
  }
}
```

- [ ] **Step 3: Count only the keyed reorder update window**

In `runKeyedReorderBenchmark()`, replace the reorder timing block:

```ts
const reorderStart = now();
state.rowOrder = [...state.rowOrder].reverse();
await nextTick();
const reorderedFirstRow = container.querySelector("#rows > div:first-child");
const firstRowText = reorderedFirstRow?.textContent?.trim() ?? "";
const reorderMs = now() - reorderStart;
```

with:

```ts
const reorderStart = now();
const { counts: domMutationCounts } = await measureDomMutations(async () => {
  state.rowOrder = [...state.rowOrder].reverse();
  await nextTick();
});
const reorderedFirstRow = container.querySelector("#rows > div:first-child");
const firstRowText = reorderedFirstRow?.textContent?.trim() ?? "";
const reorderMs = now() - reorderStart;
```

- [ ] **Step 4: Return the counts**

In the keyed reorder `result` object, add:

```ts
    domMutationCounts,
```

- [ ] **Step 5: Verify GREEN for browser benchmark**

Run:

```bash
pnpm benchmark:browser
```

Expected: PASS. The `browser benchmark summary` line for `keyed-reorder` includes `domMutationCounts` with
`insertBefore > 0`, `setAttribute: 0`, `removeAttribute: 0`, `textContent: 0`, and `removeChild: 0`.

---

### Task 3: Document And Log The Instrumentation

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

In `docs/performance.md`, under the browser production benchmark section, add:

```md
The keyed reorder browser result also includes `domMutationCounts`, measured only during the reorder update window.
These counters are diagnostic context for choosing the next renderer performance slice. They are not timing thresholds.
For the current stable reverse reorder fixture, `insertBefore` should be greater than zero, while `setAttribute`,
`removeAttribute`, `textContent`, and `removeChild` should remain zero.
```

- [ ] **Step 2: Add implementation log**

Create `solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md`:

```md
# 2026-07-21-006：补充 keyed reorder DOM mutation instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance instrumentation / project log
- 状态：已完成

## 变动摘要

在 Chromium browser keyed reorder benchmark 中补充 `domMutationCounts`，只统计 reorder update window 内的
`insertBefore`、`setAttribute`、`removeAttribute`、`textContent` 与 `removeChild` 调用次数。

## 变动原因

上一版 matched patch skip 计划被验证为不可执行：现有 `patchElement()` 已经具备稳定 element no-op 早退。新的切片先
记录真实 DOM mutation 信号，再决定后续优化 keyed diff bookkeeping、DOM move 路径，还是 props / children patch 重复成本。

## 影响范围

- 影响模块：browser benchmark fixture、browser benchmark history type、性能文档、项目日志。
- 行为变化：无 renderer runtime 行为变化；新增 benchmark 诊断字段。
- 风险等级：低；DOM prototype patching 只在 benchmark reorder update window 内生效，并在 `finally` 中恢复。

## 涉及文件

| 文件                                                                                             | 动作 | 说明                            |
| ------------------------------------------------------------------------------------------------ | ---- | ------------------------------- |
| `examples/performance-benchmark/src/main.tsx`                                                    | 修改 | 统计 keyed reorder DOM mutation |
| `tests/e2e/browser-benchmark.spec.ts`                                                            | 修改 | 校验 benchmark counter shape    |
| `tests/e2e/browser-benchmark-history.ts`                                                         | 修改 | 扩展 keyed reorder history type |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                                           | 修改 | 覆盖 history counter 持久化     |
| `docs/performance.md`                                                                            | 修改 | 记录 counter 诊断语义           |
| `solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md` | 新增 | 记录本次实现变更                |
| `solace-project-log/index.md`                                                                    | 修改 | 追加 2026-07-21 日志索引        |

## 验证记录

| 验证项                  | 命令或方式                                                             | 结果                                        |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| Browser history unit    | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts` | 通过                                        |
| Browser benchmark       | `pnpm benchmark:browser`                                               | 通过，`keyed-reorder` summary 包含 counters |
| Browser history summary | `pnpm benchmark:history -- --json`                                     | 通过，timing metrics 仍正常汇总             |
| Typecheck               | `pnpm typecheck`                                                       | 通过                                        |
| Lint                    | `pnpm lint`                                                            | 通过                                        |
| Build                   | `pnpm build`                                                           | 通过                                        |
| Format check            | `pnpm format:check`                                                    | 通过                                        |
| Diff whitespace         | `git diff --check`                                                     | 通过                                        |

## 后续动作

- 基于 `domMutationCounts` 的最新 browser records 选择下一轮 renderer 性能切片。如果 prop/text counters 为零，优先
  研究 keyed diff bookkeeping 或 move path；如果它们不为零，再设计 patch 重复成本优化。
```

- [ ] **Step 3: Update the log index**

Append this row in the `2026-07-21` table in `solace-project-log/index.md` after the plan row for this design:

```md
| 006 | 补充 keyed reorder DOM mutation instrumentation | browser benchmark、performance instrumentation、项目日志 | `examples/performance-benchmark/src/main.tsx`, `tests/e2e/browser-benchmark.spec.ts`, `tests/e2e/browser-benchmark-history.ts`, `tests/unit/scripts/browser-benchmark-history.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md) |
```

- [ ] **Step 4: Run documentation checks**

Run:

```bash
pnpm format:check
git diff --check
```

Expected: both commands pass.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add examples/performance-benchmark/src/main.tsx tests/e2e/browser-benchmark.spec.ts tests/e2e/browser-benchmark-history.ts tests/unit/scripts/browser-benchmark-history.test.ts docs/performance.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-21-006-keyed-reorder-dom-mutation-instrumentation.md
git commit -m "test: instrument browser keyed reorder mutations"
```

---

## Self-Review

- Spec coverage: Tasks cover benchmark result shape, browser assertions, history persistence, docs, log, and verification.
- Scope: Runtime renderer behavior is explicitly out of scope; implementation stays in browser benchmark and docs.
- TDD: Task 1 creates failing assertions before benchmark fixture implementation.
- Risk controls: DOM prototype patches are scoped to the measured reorder update and restored in `finally`.
