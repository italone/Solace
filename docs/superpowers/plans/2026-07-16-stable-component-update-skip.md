# Stable Component Update Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip unnecessary child component updates when a parent rerenders with unchanged child props and children.

**Architecture:** Add a shallow `shouldUpdateComponent()` guard in `src/renderer/diff.ts`. If the guard says the child component VNode is unchanged, carry the existing instance and DOM reference forward without refreshing props or running the component update; otherwise keep the existing update path.

**Tech Stack:** TypeScript, Vitest, jsdom, tinybench, Markdown, Prettier.

---

## File Structure

- Modify `tests/unit/component/component.test.ts`: add a RED test for stable child component update skipping.
- Modify `src/renderer/diff.ts`: add the component update guard and shallow prop comparison helpers.
- Modify `tests/performance/component-update.bench.ts`: add a benchmark for parent updates with many stable child components.
- Modify `docs/performance.md`: record the new component batching follow-up.
- Add `solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md`: record change and validation.
- Modify `solace-project-log/index.md`: add the 2026-07-16 `003` row.

No public API, package export map, scheduler queue semantics, keyed diff behavior, or benchmark thresholds should change.

---

### Task 1: Add The Failing Component Test

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add a stable child skip test**

Add this test near other component update tests:

```ts
it("skips child component updates when parent rerenders with unchanged props", async () => {
  const state = reactive({ count: 0 });
  const container = document.createElement("div");
  const childRender = vi.fn((label: string) => h("span", { "data-child": label }, label));
  const Child = (props: { label: string }) => () => childRender(props.label);
  const Parent = () => () =>
    h("section", null, [
      h("p", null, `parent: ${state.count}`),
      h(Child, { key: "stable", label: "stable" }),
    ]);

  render(h(Parent), container);

  state.count = 1;
  await nextTick();

  expect(container.querySelector("p")?.textContent).toBe("parent: 1");
  expect(container.querySelector("[data-child='stable']")?.textContent).toBe("stable");
  expect(childRender).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/component/component.test.ts
```

Expected: the new test fails because the current `updateComponent()` path reruns the child render after the parent update.

---

### Task 2: Implement Stable Component Update Skip

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Add the update guard**

At the start of `updateComponent(n1, n2)`, after carrying over the instance, add:

```ts
if (!shouldUpdateComponent(n1, n2)) {
  instance.vnode = n2;
  n2.el = n1.el;
  return;
}
```

- [ ] **Step 2: Add shallow comparison helpers**

Add these helpers near `updateComponent()`:

```ts
function shouldUpdateComponent(n1: VNode, n2: VNode): boolean {
  if (n1.children !== n2.children) {
    return true;
  }

  return havePropsChanged(n1.props, n2.props);
}

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

- [ ] **Step 3: Verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0.

---

### Task 3: Add Benchmark Coverage

**Files:**

- Modify: `tests/performance/component-update.bench.ts`

- [ ] **Step 1: Add stable-child benchmark task**

Inside the existing benchmark test, add:

```ts
bench.add("1000 stable child components parent update", async () => {
  const state = reactive({ count: 0 });
  const container = document.createElement("div");
  const Child = (props: { index: number }) => () =>
    h("span", { "data-index": props.index }, `child ${props.index}`);
  const App = () => () =>
    h("div", null, [
      h("p", { "data-parent": "count" }, `parent: ${state.count}`),
      ...Array.from({ length: itemCount }, (_, index) => h(Child, { key: index, index })),
    ]);

  render(h(App), container);
  expect(container.querySelectorAll("span")).toHaveLength(itemCount);

  state.count = 1;
  state.count = 2;
  state.count = 3;

  await nextTick();

  expect(container.querySelector("[data-parent='count']")?.textContent).toBe("parent: 3");
  expect(container.querySelector(`[data-index="${itemCount - 1}"]`)?.textContent).toBe(
    `child ${itemCount - 1}`,
  );
});
```

- [ ] **Step 2: Run component benchmark**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts
```

Expected: exits with code 0 and logs both component update benchmark tasks.

---

### Task 4: Document And Log

**Files:**

- Modify: `docs/performance.md`
- Add: `solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update performance docs**

Update the current conclusion bullet to mention the stable child component update skip and keep additional browser trend samples as the next follow-up.

- [ ] **Step 2: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md` with observed validation rows.

- [ ] **Step 3: Update project log index**

Add a 2026-07-16 `003` row for the stable component update skip.

---

### Task 5: Final Validation

**Files:**

- All changed files

- [ ] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/component/component.test.ts tests/performance/component-update.bench.ts docs/performance.md docs/superpowers/specs/2026-07-16-stable-component-update-skip-design.md docs/superpowers/plans/2026-07-16-stable-component-update-skip.md solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted component tests**

Run:

```bash
pnpm exec vitest run tests/unit/component/component.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run component benchmark**

Run:

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts
```

Expected: exits with code 0.

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
git add src/renderer/diff.ts tests/unit/component/component.test.ts tests/performance/component-update.bench.ts docs/performance.md docs/superpowers/specs/2026-07-16-stable-component-update-skip-design.md docs/superpowers/plans/2026-07-16-stable-component-update-skip.md solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md solace-project-log/index.md
git commit -m "perf: skip stable component updates"
```

Expected: creates a commit after validation passes.
