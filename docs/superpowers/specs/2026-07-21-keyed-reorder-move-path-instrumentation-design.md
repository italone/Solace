# Keyed Reorder Move Path Instrumentation Design

## Context

Solace has shipped `@italone/solace@0.0.1`, and the active development line is renderer performance. Browser keyed
reorder now has three important data points:

- A Chromium production `keyed-reorder` scenario exists.
- `domMutationCounts` show stable reverse reorder performs `insertBefore: 9999` and `setAttribute`,
  `removeAttribute`, `textContent`, and `removeChild` all remain `0`.
- The full-match bookkeeping skip removed unused-old tracking for fully matched keyed middle segments, but the latest
  browser window still reports keyed reorder `reorderMs` median 4.7 ms and p95 5.8 ms.

The next slice should not change move behavior yet. The remaining visible work is the move path itself: LIS length,
stable-position skips, move insertions, anchor lookup frequency, and new-node mount branches inside
`patchKeyedChildren()`. We need those counters before deciding whether an optimization should target anchor lookup,
move-loop branching, specific reorder shapes, or whether full reverse reorder is already bounded by unavoidable DOM
placements.

## Goal

Add diagnostic instrumentation for keyed reorder move-path behavior so browser benchmark summaries can explain where the
remaining keyed reorder work occurs.

## Non-Goals

- Do not change keyed diff behavior, DOM ordering, LIS algorithm, anchor semantics, insert/remove behavior, or public
  renderer APIs.
- Do not reduce the `insertBefore` count in this slice.
- Do not add timing thresholds or fail release checks based on move-path counters.
- Do not commit `.benchmark-history/**`.
- Do not expose persistent public profiling APIs.
- Do not optimize anchor lookup, move-loop branching, Map allocation, LIS allocation, or special reorder patterns in
  this slice.

## Proposed Approach

Keep the change diagnostic and development-only. Add internal renderer debug counters that are inert unless explicitly
enabled by the browser benchmark fixture. The browser fixture will enable counters only for the measured
`keyed-reorder` update window, read the snapshot after `await nextTick()`, then reset/disable the counters.

The counters should focus on the current keyed middle move path:

- `keyedMiddleSegments`: number of keyed middle segments that reach the Map/LIS path.
- `matchedOldChildren`: count of matched keyed old children.
- `newChildrenMounted`: count of new keyed children mounted from the move loop.
- `removedOldChildren`: count of old keyed children removed from the middle segment.
- `lisLength`: length of the increasing subsequence used for stable-position skips.
- `stableMoveSkips`: count of nodes skipped because they are in the LIS.
- `movedExistingChildren`: count of existing keyed children inserted/moved by the move loop.
- `anchorLookups`: count of `getAnchor()` calls made from the keyed move/mount loop.

The result should be attached to the existing `keyed-reorder` browser result as `movePathCounts`, alongside
`domMutationCounts`. This keeps browser history records self-contained and allows future trend logs to compare:

- DOM mutation reality: `insertBefore`, text/prop/remove writes.
- Renderer move-path intent: matched count, LIS length, move count, anchor lookup count.

For the current 10,000-row full reverse fixture, expected qualitative values are:

- `matchedOldChildren: 10000`
- `newChildrenMounted: 0`
- `removedOldChildren: 0`
- `lisLength: 1`
- `stableMoveSkips: 1`
- `movedExistingChildren: 9999`
- `anchorLookups` at least `9999`

Exact anchor lookup count should be measured, not guessed in the spec. The implementation plan can choose whether to
assert exact values in a focused unit test after confirming the current helper call sites.

## Alternatives Considered

### Optimize Anchor Lookup Immediately

Rejected for this cycle. Anchor lookup is plausible because `getAnchor(newChildren, index + 1)` is called repeatedly in
the move loop, but changing it without counters risks optimizing a non-dominant cost or breaking placement semantics.

### Add More DOM Prototype Counters

Rejected. `domMutationCounts` already tells us that props/text/remove writes are zero and moves dominate visible DOM
mutations. More DOM-level counters would not explain renderer-internal branch costs.

### Add Public Renderer Profiling APIs

Rejected for now. Public profiling would require API shape, lifecycle, production boundary, and documentation decisions.
The browser benchmark only needs temporary internal counters enabled by test/benchmark code.

### Special-Case Full Reverse Reorder

Rejected. Full reverse has pathological movement characteristics and is useful as a stress case, but optimizing it
directly risks overfitting. Instrumentation should first show whether other reorder shapes share the same bottleneck.

## Behavioral Requirements

- Default renderer behavior must be unchanged when instrumentation is not enabled.
- Browser benchmark result shape for `large-list` must remain unchanged.
- `keyed-reorder` browser result should include `movePathCounts` only after the feature is implemented.
- Counters must be reset before each measured keyed reorder update window and disabled afterward.
- Counter collection must not allocate large per-node histories; only aggregate numbers should be stored.
- Existing `domMutationCounts` must remain unchanged and continue to count only the reorder update window.
- Existing keyed remove, insert, mixed move, duplicate-key fallback, Fragment, component, and unkeyed diff behavior must
  stay unchanged.

## Test Plan

Implementation should add tests before runtime changes:

- A renderer unit test should enable internal move-path counters, run a small full reverse keyed reorder, and assert:
  matched old children, no mounts/removes, LIS length 1, one stable skip, and the expected number of moved existing
  children.
- A mixed insert/remove keyed test should assert mounts/removes are counted while DOM order and node identity remain
  correct.
- Browser benchmark tests should assert `movePathCounts` exists for `keyed-reorder`, is non-negative integer shaped, and
  aligns qualitatively with the full reverse fixture.
- Browser history append tests should prove `movePathCounts` is preserved in JSONL records.

Validation commands:

- `pnpm vitest run tests/unit/renderer/diff.test.ts`
- `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`
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

- `docs/performance.md` with the new `movePathCounts` diagnostic field and how it differs from `domMutationCounts`.
- `solace-project-log/index.md` and a new implementation log entry.

This design document is tracked as `2026-07-21-012`.

## Risk And Safety

The main risk is instrumentation leaking into normal renderer behavior. Counters must stay disabled by default and
should not alter control flow. The second risk is making unit tests too brittle by overasserting exact anchor counts
before confirming all call sites. The implementation plan should assert exact counts only where the current code path is
small and stable; browser tests should prefer qualitative shape checks.

## Recommendation

Proceed with move-path instrumentation before any move optimization. The current evidence shows DOM props/text work is
not the bottleneck, bookkeeping has already been reduced, and the remaining visible work is keyed move behavior. This
spec gives the next implementation cycle a narrow, measurable target without changing renderer semantics.
