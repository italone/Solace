# Fragment Batch Mount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce parent-container DOM insertions for initial Fragment mounts whose top-level children are plain elements.

**Architecture:** Add a guarded batch path in `mountFragment()` that mounts all-element Fragment children into a `DocumentFragment` and inserts that fragment into the real container once. Keep mixed Fragment children on the existing per-child path so component lifecycle timing and keyed diff behavior do not change.

**Tech Stack:** TypeScript, Vitest, jsdom DOM APIs, tinybench, Markdown, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add a focused RED test for parent-container insertion count during root Fragment mount.
- Modify `src/renderer/diff.ts`: widen renderer container types where needed and add the all-element Fragment batch path.
- Modify `docs/performance.md`: record this optimization as the current renderer/performance follow-up.
- Add `solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md`: record implementation and validation.
- Modify `solace-project-log/index.md`: add the 2026-07-16 `002` row.

No public API, package export map, DevTools payload shape, keyed diff semantics, scheduler behavior, or benchmark thresholds should change.

---

### Task 1: Add The Failing Renderer Test

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Import `Fragment`**

Change the renderer import to include `Fragment`:

```ts
import { Fragment, h, render } from "../../../src/index";
```

- [ ] **Step 2: Add the parent insertion-count test**

Add this test near the existing child diff tests:

```ts
it("batches root Fragment element insertion into the parent container", () => {
  const container = document.createElement("div");
  const insertBefore = vi.spyOn(container, "insertBefore");

  render(
    h(Fragment, null, [
      h("span", { key: "a" }, "A"),
      h("span", { key: "b" }, "B"),
      h("span", { key: "c" }, "C"),
    ]),
    container,
  );

  expect([...container.querySelectorAll("span")].map((span) => span.textContent)).toEqual([
    "A",
    "B",
    "C",
  ]);
  expect(insertBefore).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: the new test fails because the current Fragment mount path inserts each child directly into the parent, so the parent `insertBefore` spy is called three times.

---

### Task 2: Implement Fragment Batch Mount

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Widen insert-only renderer container types**

Change the `container` parameter type from `Element` to `Node` for helpers that only need node insertion, removal, or text operations:

```ts
export function patch(
  n1: VNode | null,
  n2: VNode,
  container: Node,
  anchor: Node | null = null,
  parentComponent: ComponentInstance | null = null,
  appProvides: Provides | null = parentComponent?.appProvides ?? null,
): void {
```

Apply the same `Node` container type to `mountFragment()`, `mountElement()`, `mountComponent()`, `patchChildren()`,
`mountChildren()`, `patchArrayChildren()`, `patchUnkeyedChildren()`, and `patchKeyedChildren()`.

- [ ] **Step 2: Add the batch mount guard**

Add this helper near the Fragment helpers:

```ts
function canBatchMountFragment(children: VNode[]): boolean {
  return (
    children.length > 0 && children.every((child) => Boolean(child.shapeFlag & ShapeFlags.ELEMENT))
  );
}
```

- [ ] **Step 3: Batch all-element Fragment initial mounts**

Update `mountFragment()` so all-element Fragment children mount into a `DocumentFragment` first:

```ts
function mountFragment(
  vnode: VNode,
  container: Node,
  anchor: Node | null,
  parentComponent: ComponentInstance | null,
  appProvides: Provides | null,
): void {
  if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    const children = vnode.children as VNode[];

    if (canBatchMountFragment(children)) {
      const fragment = document.createDocumentFragment();
      for (const child of children) {
        patch(null, child, fragment, null, parentComponent, appProvides);
      }
      insert(fragment, container, anchor);
      vnode.el = getFragmentRoot(vnode);
      return;
    }

    for (const child of children) {
      patch(null, child, container, anchor, parentComponent, appProvides);
    }
  }

  vnode.el = getFragmentRoot(vnode);
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0 and the Fragment insertion-count test passes.

---

### Task 3: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

In `docs/performance.md`, update the current conclusion bullet from:

```md
- Next optimization work should focus on keyed diff efficiency, Fragment edge cases, and component update batching under larger trees.
```

to:

```md
- The latest renderer follow-up batches all-element Fragment initial mounts through a `DocumentFragment`; next optimization work should focus on component update batching under larger trees and additional browser trend samples.
```

- [ ] **Step 2: Add the project log entry**

Create `solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md` with the observed validation rows after final checks.

- [ ] **Step 3: Update the project log index**

Add this row after `001` in the `2026-07-16` section:

```md
| 002 | 优化 Fragment 初始挂载批量插入 | renderer diff、Fragment benchmark、单元测试、性能文档、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/performance.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-16-002-fragment-batch-mount.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [ ] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-16-fragment-batch-mount-design.md docs/superpowers/plans/2026-07-16-fragment-batch-mount.md solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted renderer tests**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run Fragment benchmark**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/fragment.bench.ts
```

Expected: exits with code 0 and logs the three Fragment benchmark tasks.

- [ ] **Step 4: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 7: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 8: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/performance.md docs/superpowers/specs/2026-07-16-fragment-batch-mount-design.md docs/superpowers/plans/2026-07-16-fragment-batch-mount.md solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md solace-project-log/index.md
git commit -m "perf: batch fragment element mounts"
```

Expected: creates a commit after validation passes.
