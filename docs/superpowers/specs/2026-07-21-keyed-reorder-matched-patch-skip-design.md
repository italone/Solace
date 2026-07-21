# Keyed Reorder Matched Patch Skip Design

> Superseded on 2026-07-21 by
> `docs/superpowers/specs/2026-07-21-keyed-reorder-dom-mutation-instrumentation-design.md`.
> A RED-test probe showed that this design duplicates the existing `patchElement()` no-op early return and should not be
> implemented as written.

## Context

Solace has shipped `@italone/solace@0.0.1` and the performance line is back on renderer work. The browser benchmark now
has a dedicated Chromium production `keyed-reorder` scenario. The latest local browser window contains five
`keyed-reorder` records with `reorderMs` median 4.6 ms and p95 6.2 ms.

The renderer already has a keyed middle diff with LIS-based move minimization. It also has several focused optimizations
around contiguous insert/remove runs, stable keyed props comparison, and initial mount fast paths. In a full reverse
keyed reorder, the LIS is naturally small, so most nodes still need DOM movement. The next lower-risk slice should avoid
trying to reduce required moves and instead reduce repeated work performed while patching matched keyed element nodes
whose output is unchanged.

## Goal

Add a conservative no-op patch skip for matched keyed element nodes during renderer diff when the old and new VNodes are
provably equivalent for DOM output.

## Non-Goals

- Do not change keyed LIS behavior, DOM move ordering, anchors, or `insertBefore` strategy.
- Do not change VNode shape, public APIs, package exports, JSX runtime behavior, component semantics, or DevTools public
  payloads.
- Do not skip patching for components, Fragments, text changes, array child changes, event changes, class changes, or any
  changed non-key prop.
- Do not introduce timing thresholds or claim absolute performance targets.
- Do not rewrite keyed diff, replace `Map`/`Set` allocation, or add a generic renderer memoization system in this slice.

## Proposed Approach

Keep the optimization local to `src/renderer/diff.ts`. Add a small predicate that can identify element VNodes that are a
true no-op for DOM patching:

1. Both VNodes are the same type and both are elements.
2. The key is unchanged.
3. Props are equivalent for patching, ignoring `key` but not ignoring any other prop.
4. Children are equivalent for patching:
   - text children must be strictly equal,
   - no-children on both sides is stable,
   - array children are not treated as no-op unless the same children reference is reused.

Then, inside `patch()`, before entering the normal element update path, if the predicate returns true:

- assign `n2.el = n1.el`,
- return without calling `patchElement()`,
- do not emit a renderer element update event.

This should help keyed reorder workloads where each matched row VNode has the same `type`, `key`, props, and text output
after reordering. The DOM move pass still runs, but the matched-node patch step avoids repeated props and children checks
for nodes that will not change.

## Alternatives Considered

### Optimize DOM Move Count

This was the first candidate because the browser scenario is named keyed reorder. It is not the best next slice: Solace
already uses LIS for keyed middle movement, and full reverse reorder inherently has little stable subsequence to preserve.
Further move-count work would have higher correctness risk and less clear upside.

### Optimize Anchor Lookup And Insert Calls

Reducing repeated anchor lookup could trim some overhead, but it is tightly coupled to DOM ordering correctness. It is
also harder to prove with focused unit tests than a no-op patch skip.

### Replace Map/Set Allocation In Keyed Diff

The keyed middle path currently allocates a `Map`, a `Set`, and an index map. Reducing allocation might help very large
lists, but it would make the diff code harder to read and needs stronger evidence that allocation dominates the current
browser `reorderMs` window.

### Skip Only Props Comparison

The existing props compare fast path already reduces part of this cost. The new slice should skip the whole element
patch only when props and children are both provably stable. This keeps the optimization broad enough to matter while
remaining conservative.

## Behavioral Requirements

- Stable keyed element reorder must preserve DOM node identity and final DOM order.
- Stable keyed element reorder with equal text children must not call DOM prop patching or text setting for those rows.
- Changed text children must still update text.
- Changed `class`, data attributes, or other non-key props must still patch.
- Changed event handlers and removed event handlers must still patch.
- Array children must still go through normal child diff unless both VNodes reuse the exact same children array reference.
- Components and Fragments must keep existing behavior.
- DevTools renderer update events should not be emitted for skipped no-op element patches.

## Test Plan

Add targeted renderer unit tests before implementation:

- A keyed reorder test with stable element rows should spy on `Element.prototype.setAttribute`, `Element.prototype.removeAttribute`,
  and the renderer DOM text setter path where practical, then assert stable rows reuse DOM nodes and avoid unnecessary prop/text
  patching.
- A changed-text keyed reorder test should prove text still updates when one matched keyed node changes text.
- A changed-prop keyed reorder test should prove class or `data-*` changes still patch.
- An event replacement/removal test should prove event props are not skipped by the no-op predicate.
- An array-children test should prove nested children still use normal child diff when child arrays are not referentially identical.

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

- `docs/performance.md` with a short note that keyed reorder matched element no-op patches are skipped conservatively.
- `solace-project-log/index.md` and a new implementation log entry.

This design document is tracked as `2026-07-21-002`.

## Risk And Safety

The main risk is skipping a patch that should run. The predicate must be strictly conservative and prefer false whenever
there is uncertainty. The implementation should reuse existing comparison helpers where possible and add focused tests
for changed text, changed props, events, and nested children so the skip cannot hide real updates.

## Recommendation

Proceed with the matched keyed element no-op patch skip. It directly targets repeated patch work in the new browser
`keyed-reorder` baseline, avoids changing DOM move semantics, and can be validated with focused renderer tests plus the
existing browser benchmark.
