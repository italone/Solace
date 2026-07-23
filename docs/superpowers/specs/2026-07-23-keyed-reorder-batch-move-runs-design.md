# Keyed Reorder Batch Move Runs Design

## Context

Solace `@italone/solace@0.0.1` has completed two recent keyed-reorder optimizations:

1. **Running anchor node** eliminated per-iteration `getAnchor()` lookups; every keyed-reorder shape now reports
   `movePathCounts.anchorLookups: 0`.
2. **Boolean stable-position lookup table** replaced the LIS index-array scan in the move loop.

After these changes, the latest 5-sample Chromium production benchmark window reports:

| Shape            | reorderMs median | insertBefore | insertBeforeMs |
| ---------------- | ---------------- | ------------ | -------------- |
| `reverse`        | 4.6              | 9,999        | ~2.4           |
| `sorted`         | 2.1              | 0            | 0              |
| `swap-neighbors` | 4.1              | 5,000        | ~1.1           |
| `shuffle`        | 6.3              | 9,805        | ~2.6           |
| `shift-window`   | 2.8              | 100          | ~0             |

`shuffle` remains the slowest shape. Diagnostic timing shows that `insertBefore` accounts for roughly 25-30% of
`shuffle` `reorderMs`, while the remaining time is JavaScript path overhead in `patchKeyedChildren()`. A follow-up
analysis of the seeded 10,000-row `shuffle` distribution reveals that the 9,805 moved nodes form only **193 contiguous
runs** in the new order. If each run could be inserted as a single `DocumentFragment` placement, `insertBefore` calls
would drop from 9,805 to 193 — a 98% reduction.

## Goal

Reduce keyed-reorder DOM mutation cost for high-movement shapes like `shuffle` by batching consecutive moved existing
children into a single `DocumentFragment` insert, while preserving exact DOM ordering and all existing semantics.

## Non-Goals

- Do not change DOM insertion order, LIS algorithm, keyed diff behavior, or public APIs.
- Do not add timing thresholds or fail release checks based on the new optimization.
- Do not commit `.benchmark-history/**`.
- Do not optimize mount/remove branches beyond moved-existing-child batching.
- Do not expose persistent public profiling APIs.
- Do not change behavior for shapes with no moved runs (e.g. `sorted`) or trivial moves (e.g. `shift-window`).

## Proposed Approach

### Where the opportunity is

`patchKeyedChildren()` currently walks the middle segment from right to left. For every existing child that is **not**
in the LIS, it calls `insert(childEl, container, anchorNode)` once. Because the walk is right-to-left, a maximal
contiguous range of moved existing children in the new order can be inserted together: their relative order inside the
batch is already correct, and they all share the same `anchorNode` (the rightmost already-placed node).

Example: new order `[A, B, stable-C, D, E]` with `A, B, D, E` moved. Walking right-to-left:

- Place `E` before `anchor`.
- Place `D` before `E` (new anchor).
- Skip `stable-C`.
- Place `B` before `stable-C`.
- Place `A` before `B`.

Current behavior: 4 `insertBefore` calls.

Batched behavior: collect `[A, B]` into a `DocumentFragment`, insert once before `stable-C`; collect `[D, E]` into a
`DocumentFragment`, insert once before the original anchor. Total: 2 `insertBefore` calls.

### Algorithm

Keep the existing right-to-left loop. Add a small accumulator that collects moved existing children until the run ends.
A run ends when the loop encounters:

- a stable position (in LIS),
- a new node to mount,
- the left boundary of the middle segment (`index < newStart`).

When a run ends, if the accumulator has more than one node, build a `DocumentFragment`, append the collected nodes in
their original relative order (which is left-to-right inside the run), and call `insert(fragment, container, anchorNode)`
once. If the run has exactly one node, use the existing single `insert` to avoid fragment overhead. Then update
`anchorNode` to the leftmost node of the run and continue.

Stable skips and mounts continue to update `anchorNode` exactly as today.

### Edge cases

- **Single-node run**: fall back to the current single `insert` call.
- **Run adjacent to a mount run**: mount logic already handles contiguous new children via `getNewRunStart` and
  `mountNewChildren`. The moved run and mount run are separate batches with the same `anchorNode`; order is preserved
  because the loop walks right-to-left.
- **Empty `childEl`**: should not happen for moved existing children (they were patched in the match phase), but if it
  does, flush the current run and continue without updating `anchorNode`.
- **`DocumentFragment` append overhead**: appending 10000 nodes to a fragment is O(n), but it replaces the same number of
  DOM parent updates. The browser can perform the final insert as a single reflow rather than 9805 individual inserts.

### Renderer instrumentation

The existing `movePathCounts.movedExistingChildren` counter remains the same (it counts nodes, not inserts). Add a new
optional counter `movedExistingBatches` that counts how many batched inserts were performed. This lets browser benchmarks
verify the optimization is active without changing `insertBefore` assertions.

### Host operation

`src/renderer/dom.ts` already has an `insert(child, parent, anchor)` helper that delegates to `parent.insertBefore`. A
`DocumentFragment` is a valid `Node`, so no new host operation is required. The loop can create a local fragment via
`document.createDocumentFragment()` and append nodes to it, then call `insert(fragment, container, anchorNode)`.

## Alternatives Considered

### Left-to-right batching

Rejected. The current right-to-left design naturally handles anchor semantics; switching direction would require a full
rewrite of anchor handling and risks breaking stable-skip ordering.

### Always use DocumentFragment even for single nodes

Rejected. Creating a fragment for a single node adds allocation/app overhead with no benefit. Keep single-node inserts as
today.

### Precompute run boundaries in a separate pass

Rejected. It would require an extra O(n) allocation and traversal. Runs can be detected inline during the existing loop
with a small accumulator.

### Batch stable + moved nodes together

Rejected. Stable nodes must stay in place and become anchors. Moving them would change DOM order.

## Behavioral Requirements

- Default renderer behavior must be unchanged when instrumentation is not enabled.
- `domMutationCounts.insertBefore` for reverse must remain 9,999 (reverse has no consecutive moved runs because every
  moved node is separated by the single stable tail node, depending on loop direction).
- `domMutationCounts.insertBefore` for `shuffle` must drop significantly (from ~9,805 toward ~193).
- Final DOM order for every shape must match the current implementation.
- `movePathCounts.movedExistingChildren` counts remain unchanged (still per-node).
- `movePathCounts.movedExistingBatches` must be introduced and reflect the number of batched inserts.
- Existing unit tests for keyed diff must continue to pass.
- Browser benchmark shape assertions must continue to pass.

## Test Plan

### Renderer Unit Tests

Add tests in `tests/unit/renderer/diff.test.ts` for small fixtures that exercise batching:

- A fixture where two consecutive nodes move together, asserting `movedExistingChildren: 2` and
  `movedExistingBatches: 1`.
- A fixture where moved nodes are isolated by stable nodes, asserting `movedExistingBatches: 2`.
- Existing shuffle-like fixture continues to pass and reports `anchorLookups: 0`.

### Browser Benchmark Tests

- `tests/e2e/browser-benchmark.spec.ts` assertions for `shuffle` should continue to pass; optionally assert
  `movedExistingBatches` is much smaller than `movedExistingChildren`.
- Run a fresh five-sample browser benchmark after implementation to refresh `docs/performance.md`.

### Host Operation Test

No new test needed; `DocumentFragment` is handled by the existing `insert` helper.

## Documentation And Logging

- Update `docs/performance.md` with the new `shuffle` trend after the optimization.
- Create a project log entry describing the batch-move-runs optimization, expected reduction in `insertBefore`, and
  verification results.

## Risk And Safety

The main risk is incorrect fragment ordering for runs that include stable-skip boundaries or mount runs. The
right-to-left loop, combined with flushing the accumulator at every boundary, keeps the ordering identical to the
single-insert version. Unit tests with instrumentation provide an equivalence oracle. The shape matrix ensures the
optimization does not overfit to `shuffle`.

## Recommendation

Proceed with the batch move runs optimization. The analysis shows a 98% theoretical reduction in `insertBefore` calls for
`shuffle`, and the implementation is a localized change inside `patchKeyedChildren()` that preserves existing semantics.
