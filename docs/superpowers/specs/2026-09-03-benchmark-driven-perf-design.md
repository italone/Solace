# Benchmark-Driven Performance Optimization Design

Date: 2026-09-03
Status: approved (conversation)

## Purpose

Benchmark history shows a real mid-August regression: jsdom suites jumped ~2× on 2026-08-14
(e.g. 1000-row initial render 20→40ms, batched reactive update 39→67ms) and browser
keyed-reorder shapes regressed up to +106% (reverse). No targeted perf work has ever been done.
This is the first benchmark-driven optimization pass, focused on allocation churn in the
reactive/render hot paths.

## Changes

### 1. Effect hot path (src/reactivity/effect.ts)

- `trigger()` no longer copies the dependency set (`new Set(dep)`) on every trigger. Iterate
  the dep collection directly with a for loop; snapshot the collection reference/length before
  iterating and fall back to a copied iteration if effects mutate subscriptions mid-iteration
  (detectable by reference/length change). Semantics must remain identical to the copy-based
  iteration.
- `cleanupEffect` replaces its `forEach` closure with a plain for loop.

### 2. flattenChildren flat fast path (src/vnode/vnode.ts)

Single scan of the children array for any nested array; if none, return the original array
(zero allocation). Nested case runs the existing recursive flattening unchanged.

### 3. Keyed diff allocations (src/renderer/children.ts)

- Build the `oldKeyedChildren` key map and `newIndexToOldIndexMap` only when at least one new
  child carries a key; fully unkeyed subtrees skip both allocations (existing unkeyed path).
- Prefer per-slot assignment over whole-array `.fill(0)` where it measurably helps (minor).

### 4. Scheduler + unmount path

- `flushJobs`: the per-flush `causes` Set is allocated lazily, only when a job actually
  carries a cause.
- `10000 row delete` (~240ms, flat since July): profile the remove path in
  `src/renderer/unmount.ts` (repeated parentNode walks, per-node listener teardown) and apply
  batched optimizations the profile justifies. This item is investigate-then-fix: if profiling
  shows no cheap win, report the numbers honestly and ship only the other items.

## Validation

- Per fix: jsdom benchmark (`pnpm benchmark`) before/after comparison on the affected tasks;
  full unit + integration suites must stay green (zero behavior change is a hard constraint).
- After all fixes: one browser benchmark run recorded through the normal daily evidence flow
  (`benchmark:browser` + history evidence).
- Acceptance target: recover ≥50% of the 2026-08-14 regression on the affected jsdom tasks
  (e.g. batched reactive update 67ms → ≤53ms, 1000-row initial render 40ms → ≤30ms). Items
  that miss the target are recorded with before/after numbers and a conclusion, not silently
  claimed.

## Contract impact

Patch bump: internal optimizations only, no public API changes. `docs/performance.md` notes
and changeset updated together.

## Out of scope

Scheduler algorithm redesign, keyed-diff algorithm replacement (LIS stays), lazy component
preloading, SSR path changes, and benchmark budget tightening.
