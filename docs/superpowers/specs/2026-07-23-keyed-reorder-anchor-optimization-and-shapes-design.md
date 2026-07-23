# Keyed Reorder Anchor Optimization and Shape Matrix Design

## Context

Solace `@italone/solace@0.0.1` has move-path instrumentation showing that the 10,000-row full reverse reorder fixture performs 9,999 `insertBefore` calls and 9,999 move-loop `getAnchor()` lookups. Each moved node currently recomputes its anchor by reading `newChildren[index + 1].el`. Because the move loop already processes children from right to left, the anchor can be maintained as a running value instead of being looked up repeatedly.

## Goal

Reduce move-loop anchor lookup cost to zero by tracking the anchor node explicitly while preserving all DOM ordering semantics. At the same time, expand the browser benchmark from a single reverse reorder fixture to a comprehensive keyed reorder shape matrix so we can confirm the optimization helps across realistic distributions, not just the pathological full-reverse case.

## Non-Goals

- Do not change DOM insertion order, LIS algorithm, keyed diff behavior, or public APIs.
- Do not add timing thresholds or fail release checks based on the new shapes.
- Do not commit `.benchmark-history/**`.
- Do not optimize mount/remove branches beyond anchor tracking.
- Do not expose persistent public profiling APIs.

## Proposed Approach

### Anchor Tracking

Refactor the keyed move/mount loop in `patchKeyedChildren()` to maintain an `anchorNode` variable initialized once at the right boundary of the middle segment. The loop walks from `newEnd` down to `newStart`; after each placement, the placed node's DOM element becomes the new anchor for the next iteration to the left.

Rules:

- Initialization: `anchorNode = getAnchor(newChildren, newEnd + 1)`.
- New node mount (single): use `anchorNode`, then set `anchorNode = newChildren[index].el`.
- New node mount (batched): use `anchorNode`, then set `anchorNode = newChildren[runStart].el`.
- Stable skip: `newChildren[index].el` is already in place; set `anchorNode = newChildren[index].el`.
- Existing node move: use `anchorNode`, then `insert(...)` and set `anchorNode = newChildren[index].el`.
- Empty `childEl`: do not update `anchorNode`.

This is semantically equivalent to the current `getAnchor(newChildren, index + 1)` because the next iteration to the left always needs the rightmost already-placed DOM node as its anchor.

### Shape Matrix

Extend the browser benchmark keyed-reorder scenario to support multiple shapes. Each shape is a deterministic transform applied to the initial `rowOrder` array. The benchmark runs each shape and logs a separate summary with the same result shape plus a new `shape` field.

Shapes:

| Shape            | Description                            | Expected LIS | Expected moves |
| ---------------- | -------------------------------------- | ------------ | -------------- |
| `reverse`        | Full reverse (existing)                | 1            | 9,999          |
| `sorted`         | Identity, no change                    | 10,000       | 0              |
| `swap-neighbors` | Swap every adjacent pair               | 5,000        | 5,000          |
| `shuffle`        | Fisher-Yates random                    | varies       | ~9,999         |
| `shift-window`   | Move a window of 100 rows to the front | ~9,900       | ~100           |

`shuffle` must use a seeded random number generator so the browser benchmark is deterministic across runs. The Playwright spec will assert qualitative move-path shape values rather than exact anchor counts.

### Result Shape

`BrowserBenchmarkHistoryResult` keyed-reorder branch gains an optional `shape` field. Existing reverse fixtures continue to report `shape: "reverse"` by default. History summary grouping will use `(scenario, shape)` as the key.

## Alternatives Considered

### Precompute All Anchors

Rejected. It requires an extra O(n) array allocation and a separate traversal. The running-anchor approach is zero-allocation and naturally fits the existing reverse loop.

### Optimize Only Reverse

Rejected. Reducing anchor lookups is a general win; the shape matrix will quantify the benefit for stable, random, and windowed reorders.

### Separate Anchor Helper

Rejected as over-abstract. The loop is small enough that an inline `anchorNode` variable is clearer than a new helper with its own state contract.

## Behavioral Requirements

- Default renderer behavior must be unchanged when instrumentation is not enabled.
- `domMutationCounts.insertBefore` for reverse must remain 9,999.
- `movePathCounts.anchorLookups` for reverse must become 0 after the optimization.
- Browser benchmark result shape for `large-list` must remain unchanged.
- Each keyed-reorder shape must produce correct DOM order and pass assertions.
- Existing unit tests for keyed diff must continue to pass.
- Seeded `shuffle` must produce the same order for the same seed across runs.

## Test Plan

### Renderer Unit Tests

Add a test in `tests/unit/renderer/diff.test.ts` that enables move-path instrumentation, runs a full reverse keyed reorder, and asserts:

- DOM order is reversed.
- `movePathCounts.movedExistingChildren` is 3 for a 4-element fixture.
- `movePathCounts.anchorLookups` is 0.

Add similar small-fixture tests for `sorted`, `swap-neighbors`, and `shift-window` shapes to assert shape-specific LIS and move counts, and anchor lookups of 0.

### Browser Benchmark Tests

- Update `tests/e2e/browser-benchmark-history.ts` to add `shape` to the keyed-reorder result type.
- Update `tests/unit/scripts/browser-benchmark-history.test.ts` to include `shape: "reverse"` in the fixture and assert JSONL preservation.
- Update `tests/e2e/browser-benchmark.spec.ts` to iterate over all shapes, assert each shape's `firstRowText`, and assert qualitative `movePathCounts` values. For `sorted`, `movedExistingChildren` must be 0. For `reverse`, `movedExistingChildren` must be 9,999 and `anchorLookups` must be 0.

### Fixture

Modify `examples/performance-benchmark/src/main.tsx` to expose a shape parameter and implement each transform. Use a seeded PRNG for `shuffle`.

## Documentation And Logging

- Update `docs/performance.md` with the new shape matrix, seeded shuffle note, and latest-window results after running a fresh five-sample benchmark for each shape.
- Create a new project log entry for the design, implementation, and trend refresh.

## Risk And Safety

The main risk is changing anchor semantics for edge cases such as empty `childEl`, batched mounts, or stable skips. The running-anchor rules must mirror `getAnchor(newChildren, index + 1)` exactly. Unit tests with instrumentation provide an equivalence oracle. The shape matrix reduces the chance of overfitting to reverse.

## Recommendation

Proceed with the running-anchor optimization and the comprehensive shape matrix. This gives a measurable DOM-operation reduction on reverse and a broader baseline for future keyed-diff work.
