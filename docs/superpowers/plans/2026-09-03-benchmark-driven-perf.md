# Benchmark-Driven Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the mid-August jsdom benchmark regression (allocation churn in reactive/render hot paths) with zero behavior change.

**Architecture:** Four independent allocation-level optimizations: (1) flattenChildren flat fast path in vnode creation, (2) trigger()/cleanupEffect de-allocation in the reactivity core, (3) keyed-diff map/array gating + lazy scheduler cause set, (4) investigate-then-fix the unmount delete path. Each task ships with a before/after `pnpm benchmark` comparison; the full test suite gates every commit.

**Tech Stack:** TypeScript, vitest bench (`pnpm benchmark`, tasks in tests/performance/*.bench.ts), existing Solace conventions.

**Baseline (2026-08-18, same machine, latencyMeanMs):** 1000 component initial render 40.2 · 1000 batched reactive update 67.4 · 10000 row create 73.7 · 10000 row local text update 47.1 · 10000 row delete 212.4 · 10000 row keyed reorder 890.0 · mount/unmount loop 10.9.

---

### Task 1: flattenChildren flat fast path

**Files:**

- Modify: `src/vnode/vnode.ts` (flattenChildren, ~lines 133-145)
- Test: `tests/unit/vnode/nested-array-children.test.ts` (existing — must stay green) + a micro test asserting identity for flat input

- [ ] **Step 1: Write failing test** — in the existing nested-array test file (or a new `flatten-identity.test.ts` if cleaner), test observable behavior only: rendering children with no nested arrays produces identical DOM to before (covered by existing suites), plus a unit test that imports createVNode and asserts `createVNode("ul", null, [li, li]).children` is referentially the SAME array passed in when flat (the fast path is observable via identity). Run: `pnpm vitest run tests/unit/vnode` — identity test FAILs.

- [ ] **Step 2: Implement**:

```ts
function flattenChildren(
  children: readonly (VNodeChild | AsyncVNodeChild)[],
): (VNodeChild | AsyncVNodeChild)[] {
  let hasNested = false;
  for (const child of children) {
    if (Array.isArray(child)) {
      hasNested = true;
      break;
    }
  }
  if (!hasNested) {
    return children as (VNodeChild | AsyncVNodeChild)[];
  }

  const flattened: (VNodeChild | AsyncVNodeChild)[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      flattened.push(...flattenChildren(child));
    } else {
      flattened.push(child);
    }
  }
  return flattened;
}
```

Note: check the caller in createVNode — if it currently does `children = flattenChildren(children)` unconditionally, keep that (fast path returns original). If it stores the result in a new field, identity holds.

- [ ] **Step 3: Verify** — `pnpm vitest run tests/unit` all green. `pnpm benchmark` — record `1000 component initial render`, `5000 Fragment child initial render`, `10000 row create` before/after in the report.

- [ ] **Step 4: Commit** — `git commit -m "perf: skip flattenChildren allocation for flat children"`

### Task 2: Effect hot path — trigger() without per-trigger Set copy, cleanupEffect for-loop

**Files:**

- Modify: `src/reactivity/effect.ts` (trigger ~94-140, cleanupEffect ~54-59)
- Test: `tests/unit/reactivity/` existing suites must stay green; add a mutation-during-iteration regression test

- [ ] **Step 1: Write failing/protecting tests first** — add to tests/unit/reactivity (find the trigger/effects suite): an effect that, when run, SUBSCRIBES to a new reactive property (track during run) while another effect in the same dep is also triggered — must behave identically to before (both run; no skip/duplicate); an effect whose run DELETES the dep entry it belongs to (e.g. stopping itself inside the run) — must not throw or skip other effects. These pass BEFORE the change (they guard the copy semantics) and must still pass after.

- [ ] **Step 2: Implement**:
  - `cleanupEffect`: replace `deps.forEach((dep) => { dep.delete(...) })` with a plain for loop over `reactiveEffect.deps`.
  - `trigger()`: replace `const effects = new Set(dep); ... effects.forEach(...)` with direct iteration plus mutation detection:
    ```ts
    const effects: Set<ReactiveEffect> = dep;
    const initialSize = dep.size;
    let index = 0;
    for (const reactiveEffect of dep) {
      if (index >= initialSize) break; // effects added mid-iteration were not subscribed at trigger time
      index += 1;
      if (!reactiveEffect.active) continue;
      ...same body (scheduler/run accounting)...
    }
    ```
    Mid-iteration DELETIONS are safe for Set iteration order (Set iterators tolerate deletes; a deleted-not-yet-visited effect simply doesn't run — same as the copy would produce only if deletion happened before the copy... IMPORTANT: verify semantic equivalence — with the OLD code the snapshot was taken BEFORE any effect ran, so an effect deleted by an earlier effect in the same trigger STILL ran under the old code but may NOT run under direct iteration. Read the old behavior and decide: if "deleted later but snapshot-ran" is load-bearing (test in Step 1 covers it), fall back to: iterate directly, but if ANY mutation is detected (size change at any point) switch to completing the remaining iteration over a copied array captured at start (`const snapshot = initialSize <= dep.size ? null : [...dep]` — simplest correct variant: capture `[...dep]` ONLY when size changed, replaying the not-yet-visited members). Keep the devtools correlation window (set/restore) exactly as-is around the loop.
  - Do not change any public behavior; `runEffects`/`scheduledEffects` counts must match old semantics.

- [ ] **Step 3: Verify** — `pnpm vitest run tests/unit tests/integration` green. `pnpm benchmark` — record `1000 component batched reactive update`, `1000 stable child components parent update`, `10000 row local text update` before/after.

- [ ] **Step 4: Commit** — `git commit -m "perf: iterate trigger dependencies without copying"`

### Task 3: Keyed diff gating + lazy scheduler cause set

**Files:**

- Modify: `src/renderer/children.ts` (keyed diff block ~lines 197-235)
- Modify: `src/scheduler/scheduler.ts` (flushJobs causes Set)
- Test: existing keyed suites must stay green (`tests/unit/renderer/` keyed tests, browser e2e untouched)

- [ ] **Step 1: Tests** — no new behavior; existing keyed/diff suites are the guard. Optionally add one unit test: a fully-unkeyed children patch path exercises without building the key map (observable only via instrumentation counts if available — skip if not cheaply observable).

- [ ] **Step 2: Implement**:
  - children.ts: before building `oldKeyedChildren` and `newIndexToOldIndexMap`, scan `newChildren[newStart..newEnd]` for any `key !== null`. If none, route to the existing unkeyed handling (read how the function already handles unkeyed children — there may be an existing unkeyed branch; if the current code is shared, gate only the Map construction: skip the old-children key scan loop when no new child has keys, since lookups can never hit). Ensure `newIndexToOldIndexMap` is still allocated when needed. Do not change LIS/move logic.
  - scheduler.ts flushJobs: `let causes: Set<number> | null = null; ... if (cause !== undefined) { (causes ??= new Set<number>()).add(cause); }` and emit `distinctCauses: causes?.size ?? 0`.

- [ ] **Step 3: Verify** — `pnpm vitest run tests/unit tests/integration` green. `pnpm benchmark` — record the `10000 row keyed*` family and `10000 row text to keyed list` before/after.

- [ ] **Step 4: Commit** — `git commit -m "perf: gate keyed diff allocations and lazy scheduler cause set"`

### Task 4: Unmount delete path investigation (10000 row delete 212ms)

**Files:**

- Modify: `src/renderer/unmount.ts` (+ wherever profiling points)
- Test: existing unmount suites

- [ ] **Step 1: Profile** — read src/renderer/unmount.ts and the 10000-row delete bench task (tests/performance/). Identify repeated per-node work: parentNode walks, per-node listener teardown, nextSibling scans, container.firstChild patterns in a loop. Use a quick instrumented run (console.time or the bench with --report) if needed. Report findings BEFORE changing code; if no cheap win exists (e.g. cost is jsdom-DOM-bound removeChild), STOP and record the conclusion — shipping nothing here is a valid outcome per the spec.

- [ ] **Step 2 (conditional)**: apply the justified fix (e.g. hoist invariant lookups, batch fragment removal, avoid re-reading node relationships). Zero behavior change.

- [ ] **Step 3: Verify** — full suites green; `pnpm benchmark` `10000 row delete` before/after.

- [ ] **Step 4: Commit** — `git commit -m "perf: <specific fix>"` or no commit with a documented conclusion.

### Task 5: Verification report, docs, changeset, gates

**Files:**

- Modify: `docs/performance.md` (optimization notes)
- Create: `.changeset/benchmark-perf-optimizations.md`
- Modify: `docs/roadmap.md` if a perf claim needs updating

- [ ] **Step 1: Assemble the before/after table** from Tasks 1-4 into the commit message / docs note. Compare against acceptance targets (≥50% recovery of the 08-14 regression: batched update 67.4 → ≤53, initial render 40.2 → ≤30). Record misses honestly.

- [ ] **Step 2: Changeset**:

```markdown
---
"@italone/solace": patch
---

Performance: reduce hot-path allocations — `flattenChildren` returns the original array when children are already flat, `trigger()` iterates dependencies without copying the dep set per trigger, keyed-diff key maps are built only when new children carry keys, the scheduler allocates its devtools cause set lazily, and the unmount delete path was profiled with the applicable fixes applied. No public API changes.
```

(Adjust the unmount sentence to the Task 4 outcome.)

- [ ] **Step 3: Gates** — `pnpm quality` PASS; `pnpm release:check` PASS (includes benchmarks vs budgets).

- [ ] **Step 4: Commit and push** — `git commit -m "docs: benchmark-driven performance optimization notes and changeset"` then `git push`.
