# Keyed Props Compare Fast Path Design

## Context

The latest browser production benchmark history has 17 local Chromium `large-list` records. The latest-window median for
the 10,000-row selected-row update is 3.5 ms, and the renderer has already optimized several larger keyed children paths:
LIS movement, contiguous insert runs, contiguous remove runs, and stable keyed element sibling skips.

The remaining narrow hotspot for large keyed updates is props comparison. A selected-row update creates many VNodes whose
DOM output is unchanged. Those stable siblings still pass through conservative comparison helpers before the renderer can
skip patching. This design targets that comparison cost without changing renderer semantics.

## Goal

Add a conservative props comparison fast path for renderer updates so stable keyed siblings avoid unnecessary object key
enumeration during large-list patches.

## Non-Goals

- Do not change public APIs, package exports, package build shape, or DevTools event payloads.
- Do not add deep props comparison.
- Do not skip event handler cleanup, component lifecycle, or DevTools behavior.
- Do not introduce timing thresholds or claim an absolute performance target.
- Do not rewrite keyed children diff or Fragment handling.

## Proposed Approach

Update the internal props comparison helper in `src/renderer/diff.ts` to return early for cases that are provably
unchanged:

1. `oldProps === newProps`: identical props object or both `null`.
2. Both sides have no non-key props.
3. Existing length and value checks remain the fallback for all other cases.

This keeps the behavior local to props comparison. Element patching, child diffing, component prop updates, event props,
and keyed movement logic continue to call the same public renderer paths.

## Alternatives Considered

### Fragment Patch Optimization

Fragment local text patching already has benchmark coverage, but the current browser benchmark hotspot is the large-list
selected-row update, not Fragment-heavy rendering. This would be a weaker fit for the freshest benchmark evidence.

### Component Batching Expansion

Component batching is valuable, but component update semantics are more sensitive because props, children, slots,
lifecycle hooks, and effect scheduling all interact. It is better handled as a separate design when component benchmark
data points to a specific bottleneck.

### Keyed Diff Rewrite

The keyed unknown-sequence path has already received multiple focused optimizations. A rewrite would increase regression
risk without a narrow failing test. The current task should stay inside props comparison.

## Behavioral Requirements

- Element props that are identical by reference must be treated as unchanged.
- Elements with only equal `key` props must be treated as having no patchable prop changes.
- Any added, removed, or changed non-key prop must still trigger prop patching.
- Event props must still update and remove correctly.
- Child changes must still trigger element patching even when props are unchanged.
- Component update decisions must preserve the existing public behavior for props and children.

## Test Plan

Add targeted renderer unit coverage before changing runtime code:

- Verify that stable keyed siblings with unchanged `key`-only props do not call DOM prop patching during a local text
  update elsewhere in the list.
- Verify that changed non-key props still patch.
- Verify that event handler replacement/removal still works.

Then run focused and broader validation:

- `pnpm vitest run tests/unit/renderer/diff.test.ts`
- `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

Browser benchmark refresh is optional for this implementation because the change is a narrow micro-optimization with
existing jsdom list-diff coverage. If a browser run is performed, record it only as trend context.

## Documentation And Logging

Implementation should update:

- `docs/performance.md` with a short note that keyed props comparison now has a conservative fast path for stable
  siblings.
- `solace-project-log/index.md` and a new `solace-project-log/solace-entries/2026-07-17-014-*.md` implementation log.

This design document is tracked separately as `2026-07-17-013`.

## Risk And Safety

The main risk is accidentally treating changed non-key props as stable. The implementation should keep the existing
fallback logic and only add early returns for unambiguous cases. Tests must cover both skipped patching and changed-prop
patching so the fast path cannot mask real updates.
