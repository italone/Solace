# Keyed Reorder DOM Mutation Instrumentation Design

## Context

Solace has shipped `@italone/solace@0.0.1`, and the current development line is performance. The browser benchmark now
has a Chromium production `keyed-reorder` scenario with five fresh local records. The latest keyed reorder browser
window reports `reorderMs` median 4.6 ms and p95 6.2 ms.

The previous design, `keyed-reorder-matched-patch-skip`, should not be implemented as written. A temporary RED test
passed immediately, and code inspection shows why: `patchElement()` already computes `havePropsChanged()` and
`haveElementChildrenChanged()` and returns early when both are false. Adding a pre-`patchElement()` no-op predicate would
repeat the same comparisons rather than remove the remaining cost.

## Goal

Add benchmark-only instrumentation to the browser keyed reorder scenario so future renderer work can decide whether the
next performance slice should target DOM move count, keyed diff bookkeeping, or repeated patch work.

## Non-Goals

- Do not change renderer behavior, keyed LIS logic, DOM insertion order, VNode shape, package exports, public APIs, or
  component semantics.
- Do not add timing thresholds or release gates based on the new counters.
- Do not add persistent renderer profiling APIs to the package.
- Do not commit local `.benchmark-history/**` records.
- Do not optimize Map, Set, LIS, anchor lookup, prop comparison, or text patching in this slice.
- Do not claim a performance win from this instrumentation alone.

## Proposed Approach

Keep the slice inside the browser benchmark harness and history shape. During the measured `keyed-reorder` update only,
wrap selected DOM prototype methods and property setters, count calls, then restore the originals in a `finally` block.
Attach the counts to the keyed reorder result under `domMutationCounts`.

The initial mount and unmount phases should not be counted. The point is to isolate the reorder patch path:

- `insertBefore`: approximates DOM placement and move pressure from keyed reorder.
- `setAttribute`: detects repeated prop patching of stable keyed rows.
- `removeAttribute`: detects repeated prop removals.
- `textContent`: detects repeated text writes.
- `removeChild`: detects unexpected removals during pure reorder.

The browser benchmark should assert the counter shape, but it should not assert exact large-list timing. For the current
full reverse keyed reorder fixture, the expected qualitative signal is:

- `insertBefore` is greater than zero because full reverse reorder requires DOM movement.
- `setAttribute`, `removeAttribute`, `textContent`, and `removeChild` are zero during a stable same-text reorder.

If those zero-count assertions fail, that is useful: it proves repeated patch work exists and becomes the next runtime
optimization candidate. If they pass, the next optimization should not be another generic stable element patch skip.

## Alternatives Considered

### Implement Another No-Op Patch Predicate

Rejected. The renderer already has the same early return inside `patchElement()`. A duplicate predicate before
`patchElement()` would do the same comparisons twice for changed nodes and does not produce a meaningful failing test.

### Optimize DOM Move Count Immediately

Rejected for this slice. Solace already uses LIS to avoid unnecessary moves, and full reverse reorder has a naturally
small stable subsequence. We should first record the actual move count in the browser fixture before attempting a higher
risk change in keyed placement.

### Add Internal Renderer Profiling Hooks

Rejected for now. Internal counters for `patchKeyedChildren()` branches, Map/Set construction, and LIS length would be
useful, but adding package-level profiling hooks creates API and production-boundary questions. Browser DOM mutation
counts are enough to distinguish DOM mutation cost from repeated prop/text patch cost without touching runtime behavior.

## Result Shape

`large-list` browser records should remain unchanged.

`keyed-reorder` records should gain:

```json
{
  "scenario": "keyed-reorder",
  "rows": 10000,
  "initialRenderMs": 5.9,
  "reorderMs": 4.6,
  "unmountMs": 1.1,
  "firstRowText": "Row 10000",
  "remainingNodesAfterUnmount": 0,
  "domMutationCounts": {
    "insertBefore": 9999,
    "setAttribute": 0,
    "removeAttribute": 0,
    "textContent": 0,
    "removeChild": 0
  }
}
```

The numeric values are illustrative except for zero-count semantics in the current stable reorder fixture. The exact
`insertBefore` count should be recorded as observed browser data, not treated as a release threshold.

## Behavioral Requirements

- `pnpm benchmark:browser` still runs both `large-list` and `keyed-reorder` in Chromium against the Vite production
  preview build.
- Existing `large-list` result fields and history records stay compatible.
- `keyed-reorder` result summaries include `domMutationCounts`.
- DOM counters only measure the reorder update window, not initial mount or unmount.
- DOM prototypes and descriptors are restored even if the scenario throws.
- The keyed reorder benchmark still verifies that `Row 10000` is first after reversal and no row nodes remain after
  unmount.
- The history summary CLI should preserve `domMutationCounts` in JSON records but should not aggregate each counter yet.
- Documentation should describe the counters as diagnostic context, not as absolute performance thresholds.

## Test Plan

Implementation should use benchmark-facing tests before runtime code changes:

- Update the browser benchmark Playwright assertions to require `domMutationCounts` on `keyed-reorder`.
- Add a focused unit test around browser history append behavior so keyed reorder records preserve `domMutationCounts`.
- Keep benchmark history aggregation unchanged for counters; only timing metrics remain aggregated.
- Run the Chromium browser benchmark once to confirm the instrumentation works in the production fixture.

Validation commands:

- `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`
- `pnpm benchmark:browser`
- `pnpm benchmark:history -- --json`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with the new keyed reorder DOM mutation counters.
- `solace-project-log/index.md` and a new implementation log entry.

This design document supersedes `2026-07-21-002` and is tracked as `2026-07-21-004`.

## Risk And Safety

The main risk is leaving patched DOM methods installed after a failed benchmark run. The implementation must restore all
patched methods in `finally` and keep instrumentation scoped to the measured reorder update. The second risk is
misreading counters as performance thresholds. Documentation and tests should treat them as diagnostics that guide the
next design cycle.

## Recommendation

Proceed with benchmark-only DOM mutation instrumentation. It corrects the invalid matched-patch-skip direction, keeps
runtime behavior unchanged, and gives the next renderer performance slice a concrete signal: if prop/text counters stay
zero, optimize keyed diff bookkeeping or move path; if they rise, design a narrower patch-skip fix with a real RED test.
