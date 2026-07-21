# Keyed Reorder Full-Match Bookkeeping Skip Design

## Context

Solace has shipped `@italone/solace@0.0.1`, and the performance line is focused on browser-observed keyed reorder
cost. The latest Chromium browser benchmark history contains 10 `keyed-reorder` records. The latest five
`keyed-reorder` records report `reorderMs` median 4.9 ms and p95 6.2 ms.

The browser `domMutationCounts` added in the previous slice show a clear signal for stable reverse reorder:

- `insertBefore: 9999`
- `setAttribute: 0`
- `removeAttribute: 0`
- `textContent: 0`
- `removeChild: 0`

That rules out repeated props/text DOM mutation as the next target. The current `patchKeyedChildren()` still does
bookkeeping that is unnecessary for a fully matched keyed middle segment: it always allocates `usedOldChildren`, calls
`usedOldChildren.add()` for every matched node, then scans old children with `unmountUnusedKeyedChildren()` even when
every old keyed child is matched by the new keyed children and no unmount can happen.

## Goal

Skip unused-old tracking and scan work for fully matched keyed middle segments while preserving existing keyed reorder
DOM order, LIS move minimization, and safety for insert/remove/mixed keyed updates.

## Non-Goals

- Do not reduce DOM move count for full reverse reorder.
- Do not change keyed LIS behavior, move ordering, anchor selection, or `insertBefore` semantics.
- Do not change renderer public APIs, VNode shape, JSX behavior, component behavior, Fragment behavior, or DevTools
  payloads.
- Do not remove the keyed lookup `Map` or `newIndexToOldIndexMap` in this slice.
- Do not add renderer profiling APIs or timing thresholds.
- Do not commit `.benchmark-history/**`.

## Proposed Approach

Keep the implementation local to `src/renderer/diff.ts`.

In `patchKeyedChildren()`:

1. Keep the existing prefix/suffix sync, keyed lookup `Map`, `newIndexToOldIndexMap`, patch loop, LIS, and move loop.
2. Remove the unconditional `const usedOldChildren = new Set<VNode>()`.
3. Track `matchedOldCount` while patching keyed matches.
4. After the new-child patch loop, compute `oldSegmentLength = oldEnd - oldStart + 1`.
5. If `matchedOldCount === oldSegmentLength`, skip unused-old unmounting entirely because every old node in the middle
   segment has a corresponding new node.
6. If `matchedOldCount < oldSegmentLength`, call a replacement helper that derives used old indexes from
   `newIndexToOldIndexMap` and unmounts old keyed ranges not represented in that map.

This removes a `Set` allocation and 10,000 `Set.add()` calls from the browser reverse reorder fixture while leaving the
9999 required DOM placements and LIS behavior unchanged.

## Alternatives Considered

### Optimize DOM Move Count

Rejected for this slice. The browser counters show 9999 `insertBefore` calls for full reverse reorder, but Solace
already uses LIS and full reverse has only a tiny stable subsequence. Reducing move count risks DOM ordering
correctness and needs a separate design.

### Add More Renderer Instrumentation First

Useful later, but not required for this slice. The current code inspection and mutation counters already identify one
unnecessary bookkeeping path with a true RED test: full-match keyed reorder currently constructs `Set`.

### Replace Map-Based Key Lookup

Rejected for now. The key lookup map is still needed to match old and new children efficiently. Removing or pooling it
would be more invasive and harder to prove with a focused behavior test.

### Keep Set But Skip Final Unmount Scan

This would avoid one old-child pass but keep the largest avoidable work in the reverse reorder path: `Set.add()` for
every matched keyed row. Removing the Set from full-match paths is the cleaner small slice.

## Behavioral Requirements

- Full keyed reorder must preserve DOM node identity and final DOM order.
- Full keyed reorder must not allocate `Set` for unused-old tracking.
- Full keyed reorder must keep existing LIS move minimization and still issue the required DOM placements.
- Keyed remove and mixed remove/reorder cases must still unmount old keyed nodes that disappear from the new children.
- Keyed insert and mixed insert/reorder cases must still mount new keyed nodes at the correct anchors.
- Duplicate-key and mixed keyed/unkeyed children must keep falling back to unkeyed/index patching through existing
  `hasUniqueKeys()` behavior.
- Stable keyed row props/text patch behavior must not change.

## Test Plan

Add focused renderer unit tests before implementation:

- A full matched keyed reverse reorder test should temporarily replace `globalThis.Set` with a spy constructor after the
  initial mount, render the reversed keyed list, assert DOM order and identity, and assert `Set` was not constructed
  during the update.
- A keyed remove/reorder safety test should verify old nodes that are not present in the new keyed children are still
  disconnected after the update.
- Existing keyed insert, mixed insert/move, duplicate-key fallback, stable keyed sibling skip, and DOM move minimization
  tests should continue passing.

Validation commands:

- `pnpm vitest run tests/unit/renderer/diff.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`
- `pnpm benchmark:browser`
- `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

Browser benchmark refresh should happen after implementation only as trend context. Local `.benchmark-history/**` files
must remain ignored and uncommitted.

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with a short note that fully matched keyed middle segments skip unused-old tracking.
- `solace-project-log/index.md` and a new implementation log entry.

This design document is tracked as `2026-07-21-008`.

## Risk And Safety

The main risk is skipping removals in mixed keyed updates. The implementation must only skip unused-old unmounting when
the number of matched old nodes equals the old middle segment length. Removal cases must use the `newIndexToOldIndexMap`
to find which old indexes are still represented. DOM move and LIS code should remain untouched.

## Recommendation

Proceed with the full-match bookkeeping skip. It follows directly from the new browser counters, avoids the invalid
patch-skip path, removes unnecessary work from the keyed reverse reorder benchmark, and can be validated with a true RED
test before touching renderer code.
