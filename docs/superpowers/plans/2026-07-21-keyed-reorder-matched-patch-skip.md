# Keyed Reorder Matched Patch Skip Implementation Plan

> Superseded on 2026-07-21 by
> `docs/superpowers/plans/2026-07-21-keyed-reorder-dom-mutation-instrumentation.md`.
> Do not execute this plan as written. Its first RED test was proven invalid because the renderer already skips unchanged
> keyed element updates inside `patchElement()`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip no-op element patch work for matched keyed nodes whose DOM output is provably unchanged during keyed reorder.

**Architecture:** Keep the optimization local to `src/renderer/diff.ts`. Add focused renderer tests first, then add a conservative element-only predicate used by `patch()` before `patchElement()`; the keyed move/LIS path, public APIs, components, Fragments, and benchmark harness remain unchanged.

**Tech Stack:** TypeScript, Solace renderer internals, Vitest, Tinybench, Playwright browser benchmark, Markdown, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add regression tests for stable keyed element reorder skip and unsafe cases that must still patch.
- Modify `src/renderer/diff.ts`: add a conservative matched keyed element no-op predicate and call it before normal element patching.
- Modify `docs/performance.md`: record the optimization after implementation.
- Add `solace-project-log/solace-entries/2026-07-21-003-keyed-reorder-matched-patch-skip-plan.md`: record this plan.
- Modify `solace-project-log/index.md`: append the 2026-07-21 row for this plan.

No changes should be made to keyed LIS movement, anchor selection, DOM insertion order, VNode shape, public exports, JSX runtime, browser benchmark fixture, package metadata, or `.benchmark-history/**`.

---

### Task 1: Add Failing Renderer Coverage

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add stable keyed reorder skip test**

Add this test near the existing keyed reorder tests:

```ts
it("skips no-op element patching for stable keyed reorders", () => {
  const container = document.createElement("div");
  const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
  const removeAttribute = vi.spyOn(Element.prototype, "removeAttribute");

  render(
    h("ul", null, [
      h("li", { key: "a", "data-row": "a" }, "A"),
      h("li", { key: "b", "data-row": "b" }, "B"),
      h("li", { key: "c", "data-row": "c" }, "C"),
    ]),
    container,
  );

  const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));
  setAttribute.mockClear();
  removeAttribute.mockClear();

  render(
    h("ul", null, [
      h("li", { key: "c", "data-row": "c" }, "C"),
      h("li", { key: "b", "data-row": "b" }, "B"),
      h("li", { key: "a", "data-row": "a" }, "A"),
    ]),
    container,
  );

  const after = [...container.querySelectorAll("li")];

  expect(after.map((li) => li.textContent)).toEqual(["C", "B", "A"]);
  expect(after[0]).toBe(before.get("C"));
  expect(after[1]).toBe(before.get("B"));
  expect(after[2]).toBe(before.get("A"));
  expect(setAttribute).not.toHaveBeenCalled();
  expect(removeAttribute).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add changed text safety test**

Add:

```ts
it("still patches changed text in matched keyed reorders", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, "A"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "c" }, "C"),
    ]),
    container,
  );
  const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

  render(
    h("ul", null, [
      h("li", { key: "c" }, "C changed"),
      h("li", { key: "b" }, "B"),
      h("li", { key: "a" }, "A"),
    ]),
    container,
  );

  const after = [...container.querySelectorAll("li")];

  expect(after.map((li) => li.textContent)).toEqual(["C changed", "B", "A"]);
  expect(after[0]).toBe(before.get("C"));
});
```

- [ ] **Step 3: Add changed props and event safety tests**

Add:

```ts
it("still patches changed props in matched keyed reorders", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a", class: "old" }, "A"),
      h("li", { key: "b", class: "old" }, "B"),
    ]),
    container,
  );

  render(
    h("ul", null, [
      h("li", { key: "b", class: "new" }, "B"),
      h("li", { key: "a", class: "old" }, "A"),
    ]),
    container,
  );

  const after = [...container.querySelectorAll("li")];

  expect(after.map((li) => li.textContent)).toEqual(["B", "A"]);
  expect(after[0].className).toBe("new");
  expect(after[1].className).toBe("old");
});

it("still replaces event props in matched keyed reorders", () => {
  const container = document.createElement("div");
  const oldClick = vi.fn();
  const newClick = vi.fn();

  render(
    h("ul", null, [h("li", { key: "a", onClick: oldClick }, "A"), h("li", { key: "b" }, "B")]),
    container,
  );

  render(
    h("ul", null, [h("li", { key: "b" }, "B"), h("li", { key: "a", onClick: newClick }, "A")]),
    container,
  );

  const moved = [...container.querySelectorAll("li")][1];
  moved.dispatchEvent(new MouseEvent("click"));

  expect(oldClick).not.toHaveBeenCalled();
  expect(newClick).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Add array children safety test**

Add:

```ts
it("still diffs nested array children in matched keyed reorders", () => {
  const container = document.createElement("div");

  render(
    h("ul", null, [
      h("li", { key: "a" }, [h("span", { key: "a-label" }, "A")]),
      h("li", { key: "b" }, [h("span", { key: "b-label" }, "B")]),
    ]),
    container,
  );

  render(
    h("ul", null, [
      h("li", { key: "b" }, [h("span", { key: "b-label" }, "B changed")]),
      h("li", { key: "a" }, [h("span", { key: "a-label" }, "A")]),
    ]),
    container,
  );

  expect([...container.querySelectorAll("span")].map((span) => span.textContent)).toEqual([
    "B changed",
    "A",
  ]);
});
```

- [ ] **Step 5: Verify RED**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: the stable keyed reorder skip test fails because the current matched element path still calls `setAttribute`
for unchanged `data-row` props. The safety tests should pass or fail only because the first new assertion is not yet
implemented.

---

### Task 2: Implement Conservative No-Op Element Patch Skip

**Files:**

- Modify: `src/renderer/diff.ts`
- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add the early return in `patch()`**

Inside the element branch in `patch()`, before `patchElement(n1, n2, ...)`, add:

```ts
if (isNoopElementPatch(n1, n2)) {
  n2.el = n1.el;
  return;
}
```

The surrounding branch should keep the existing mount behavior for `n1 === null`.

- [ ] **Step 2: Add the no-op predicate helpers**

Add these helpers near `patchElement()` and the existing props/children comparison helpers:

```ts
function isNoopElementPatch(n1: VNode, n2: VNode): boolean {
  if (!(n1.shapeFlag & ShapeFlags.ELEMENT) || !(n2.shapeFlag & ShapeFlags.ELEMENT)) {
    return false;
  }

  if (!isSameVNodeType(n1, n2)) {
    return false;
  }

  return !havePropsChanged(n1.props, n2.props) && !haveElementChildrenChanged(n1, n2);
}
```

This intentionally reuses `havePropsChanged()` and `haveElementChildrenChanged()` so changed text, changed props, event
props, and nested array children keep the existing behavior. Do not alter keyed LIS logic or move code.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: all renderer diff tests pass, including the new stable skip and safety tests.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts
git commit -m "perf: skip no-op keyed element patches"
```

---

### Task 3: Benchmark And Document Implementation

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-21-004-keyed-reorder-matched-patch-skip.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Run focused benchmark validation**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
pnpm benchmark:browser
pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json
```

Expected: benchmark commands exit with code 0. Treat timings as trend context only; do not add thresholds.

- [ ] **Step 2: Update performance docs**

In `docs/performance.md`, update the renderer conclusion paragraph so it mentions:

```md
The keyed reorder path also skips no-op element patch work for matched keyed element nodes when props and children are
provably unchanged, while leaving keyed LIS movement and changed-node patching intact.
```

If a browser benchmark sample was recorded to local ignored history, update only trend tables backed by the summary CLI.
Do not commit `.benchmark-history/**`.

- [ ] **Step 3: Add implementation log and index row**

Create `solace-project-log/solace-entries/2026-07-21-004-keyed-reorder-matched-patch-skip.md` with:

```md
# 2026-07-21-004：实现 keyed reorder matched patch skip

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance / keyed reorder / project log
- 状态：已完成

## 变动摘要

实现 matched keyed element no-op patch skip。renderer 在确认 matched element VNode 的 type、key、props 和
children 均不会改变 DOM 输出时，直接复用旧 DOM `el` 并跳过 `patchElement()`。
```

Also append a `2026-07-21` row `004` to `solace-project-log/index.md`.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add docs/performance.md solace-project-log/solace-entries/2026-07-21-004-keyed-reorder-matched-patch-skip.md solace-project-log/index.md
git commit -m "docs: record keyed reorder patch skip"
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [ ] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-21-keyed-reorder-matched-patch-skip-design.md docs/superpowers/plans/2026-07-21-keyed-reorder-matched-patch-skip.md solace-project-log/solace-entries/2026-07-21-003-keyed-reorder-matched-patch-skip-plan.md solace-project-log/solace-entries/2026-07-21-004-keyed-reorder-matched-patch-skip.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run focused renderer tests**

Run:

```bash
pnpm vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run list diff benchmark smoke**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
```

Expected: exits with code 0.

- [ ] **Step 4: Run browser benchmark smoke**

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and prints `large-list` and `keyed-reorder` browser benchmark summaries.

- [ ] **Step 5: Run static quality gates**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Confirm ignored history stays uncommitted**

Run:

```bash
git check-ignore -v .benchmark-history/browser.jsonl
git status --short
```

Expected: `.benchmark-history/browser.jsonl` is ignored by `.gitignore`, and no `.benchmark-history/**` file appears in
the status output.

---

## Coverage Check

- Stable matched keyed element skip: Task 1 and Task 2 cover no-op rows and DOM node reuse.
- Changed text, props, events, and nested children: Task 1 safety tests keep the predicate conservative.
- No keyed LIS or move-order changes: Task 2 keeps implementation before `patchElement()` only and does not touch
  `patchKeyedChildren()` movement logic.
- Benchmark and documentation: Task 3 and Task 4 validate jsdom/browser benchmarks and update project docs/logs.
