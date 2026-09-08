# Keyed Reorder Move-Batch O(n²) Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the O(n²) `unshift`-based collection in `patchKeyedChildren`'s move phase that makes jsdom `10000 row keyed reorder` cost ~890ms.

**Architecture:** `src/renderer/children.ts` collects moved existing DOM nodes while iterating new children backwards, then flushes them as a DocumentFragment batch. Collection uses `Array.unshift` (O(k) each → O(n²) for full reverses). Change collection to `push` and append to the fragment in reverse iteration order; `anchorNode` after a batch flush becomes the array's last element (the front-most node). No public API, DOM result, or devtools instrumentation counter changes.

**Tech Stack:** TypeScript, Vitest (unit + bench), pnpm scripts.

---

### Task 1: Capture same-session baseline (evidence before change)

**Files:** none modified. Artifact: numbers recorded in the task conversation / later pasted into `docs/performance.md`.

- [ ] **Step 1: Run the keyed-reorder bench task and record the mean**

```bash
cd /Users/alone/Desktop/TEST/Solace
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts -t "10000 row keyed reorder"
```

Expected: task completes, `latency.mean` ≈ 700–950ms (history shows 890ms; ±5% noise). Write the number down — this is baseline A.

- [ ] **Step 2: Optional CPU-profile confirmation**

```bash
NODE_OPTIONS=--cpu-prof pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts -t "10000 row keyed reorder"
ls *.cpuprofile
```

Inspect the largest `.cpuprofile` in Chrome DevTools → Performance → Load profile. Confirm significant self-time in `Array.prototype.unshift` / array element copying under `patchKeyedChildren`. If the profile instead shows jsdom DOM operations dominating (>50% of self-time), STOP and report — per spec, do not optimize a DOM-bound scenario (precedent: 10000 row delete, 2026-09-03). Delete the `.cpuprofile` files afterwards; do not commit them.

### Task 2: Lock multi-batch move ordering with a regression test

**Files:**
- Modify: `tests/unit/renderer/diff.test.ts` (add one `it` block after the "records keyed full reverse move-path counters" test, ~line 390)

- [ ] **Step 1: Write the test**

This locks the multi-node batch path (5 moved nodes + 1 stable head child, forcing a single large batch and the post-flush anchor update) — the exact paths the fix touches. It must PASS against current code (behavior lock, not new behavior):

```ts
  it("preserves order across multiple moved batches with stable separators", () => {
    const container = document.createElement("div");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "e" }, "E"),
        h("li", { key: "f" }, "F"),
      ]),
      container,
    );

    const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

    // Full reversal: one child is LIS-stable, the other five form one moved batch.
    render(
      h("ul", null, [
        h("li", { key: "f" }, "F"),
        h("li", { key: "e" }, "E"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "a" }, "A"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["F", "E", "D", "C", "B", "A"]);
    for (const text of ["F", "E", "D", "C", "B", "A"]) {
      expect(before.get(text)?.isConnected).toBe(true);
    }
    expect(after[0]).toBe(before.get("F"));
    expect(after[3]).toBe(before.get("C"));
    expect(after[5]).toBe(before.get("A"));
  });
```

- [ ] **Step 2: Run it and verify PASS against current code**

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts -t "multiple moved batches"
```

Expected: PASS (this is a behavior lock; if it fails, the assumption about current behavior is wrong — STOP and investigate before any change).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/renderer/diff.test.ts
git commit -m "test: lock multi-batch keyed move ordering"
```

### Task 3: Replace unshift collection with push + reverse append

**Files:**
- Modify: `src/renderer/children.ts:262-286` (flushMovedExistingBatch) and `src/renderer/children.ts:337` (collection site)

- [ ] **Step 1: Edit `flushMovedExistingBatch`**

Replace the existing function body (lines 262–286) with:

```ts
  function flushMovedExistingBatch(): void {
    if (movedExistingBatch.length === 0) {
      return;
    }

    if (movedExistingBatch.length === 1) {
      const [node] = movedExistingBatch;
      insert(node, container, anchorNode);
      anchorNode = node;
      movedExistingBatch.length = 0;
      return;
    }

    if (shouldRecordMovePath) {
      recordKeyedReorderMovedExistingBatch();
    }

    const fragment = document.createDocumentFragment();
    // Collected back-to-front via push, so append in reverse for DOM order.
    for (let index = movedExistingBatch.length - 1; index >= 0; index -= 1) {
      fragment.appendChild(movedExistingBatch[index]);
    }
    insert(fragment, container, anchorNode);
    anchorNode = movedExistingBatch[movedExistingBatch.length - 1];
    movedExistingBatch.length = 0;
  }
```

- [ ] **Step 2: Change the collection site**

At `src/renderer/children.ts:337`, replace:

```ts
    movedExistingBatch.unshift(childEl);
```

with:

```ts
    movedExistingBatch.push(childEl);
```

- [ ] **Step 3: Run the renderer unit tests**

```bash
pnpm exec vitest run tests/unit/renderer/
```

Expected: all PASS, including the full-reverse counter test (`movedExistingChildren: 3, movedExistingBatches: 1` — instrumentation semantics unchanged) and the new multi-batch test.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/children.ts
git commit -m "perf: collect keyed move batches with push instead of unshift"
```

### Task 4: Same-session A-B verification

- [ ] **Step 1: Re-run the bench task (baseline B, same session/machine state as Task 1)**

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts -t "10000 row keyed reorder"
```

Expected: mean materially below baseline A (target >30% drop). If within noise (±5%), the hotspot assumption was wrong — report honestly, do not force further optimization.

- [ ] **Step 2: Verify no regression on the other list-diff scenarios**

```bash
pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts
```

Expected: all tasks complete; no scenario materially slower than the history values recorded in `release/performance-history.json` / `.benchmark-history/jsdom.jsonl` (same-session comparison only).

- [ ] **Step 3: Full quality gate**

```bash
pnpm quality
```

Expected: exit 0.

### Task 5: Changeset, performance notes, final commit

**Files:**
- Create: `.changeset/keyed-reorder-move-batch-push.md`
- Modify: `docs/performance.md`

- [ ] **Step 1: Write the changeset**

```markdown
---
"@italone/solace": patch
---

Collect keyed reorder move batches with array push instead of unshift, removing quadratic collection cost for full-list reversals.
```

- [ ] **Step 2: Append a note to `docs/performance.md`**

Add a short entry recording: the 2026-09-08 same-session A-B numbers (baseline A → B with exact means), the ±5% noise caveat, that cross-day comparisons are invalid, and that no other scenario changed beyond noise. Match the format of the existing 2026-09-03 entries in that file.

- [ ] **Step 3: Commit**

```bash
git add .changeset/keyed-reorder-move-batch-push.md docs/performance.md
git commit -m "docs: record keyed reorder move-batch optimization evidence"
```
