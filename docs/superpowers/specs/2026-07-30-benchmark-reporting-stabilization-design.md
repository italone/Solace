# Benchmark Reporting Stabilization Design

## Goal

Extract the useful benchmark reporting ideas from the old
`perf/keyed-reorder-move-path-instrumentation` branch without merging its stale renderer
implementation or replacing the current keyed reorder benchmark shape model.

## Context

The remaining perf branch is not an already-merged cleanup branch. It has old renderer and benchmark
commits on top of an older baseline. A direct merge would delete current router, SFC, SSR, SSG, and
DevTools work from the branch diff and would also regress the renderer keyed reorder move-path
instrumentation that now tracks moved existing batches.

The current `main` baseline already has:

- Keyed reorder move-path counters, including `movedExistingBatches`.
- Browser benchmark scenarios for `large-list`.
- Keyed reorder browser benchmark shapes: `reverse`, `sorted`, `swap-neighbors`, `shuffle`, and
  `shift-window`.
- History summarization that groups legacy keyed reorder records by `scenario:shape`.
- Browser and jsdom benchmark summary minimum-count validation.

## Scope

This project only strengthens benchmark reporting around the current browser benchmark contracts:

- `examples/performance-benchmark/src/main.tsx`
- `tests/e2e/browser-benchmark.spec.ts`
- `tests/e2e/browser-benchmark-history.ts`
- `tests/unit/scripts/browser-benchmark-history.test.ts`
- `tests/unit/scripts/benchmark-history-summary.test.ts`

The implementation should keep the current object-shaped keyed reorder scenario API and the current
five shape names.

## Reporting Capability

Keyed reorder benchmark results should capture enough row-order evidence to prove each shape ran the
intended reorder, not only that the first row changed. For keyed reorder records, store:

- `firstRowText`
- `middleRowText`
- `lastRowText`

The browser benchmark should assert these values before returning a result so a broken reorder shape
fails at the source. The e2e test should also validate the values for every shape.

## History Compatibility

The history format should remain backward-compatible with existing records:

- Existing keyed reorder history records may have `scenario: "keyed-reorder"` and
  `shape: "reverse"`.
- New keyed reorder history records may include `middleRowText` and `lastRowText`.
- Summary grouping should continue to display keyed reorder shape groups as
  `keyed-reorder:<shape>`.
- `--min-jsdom-count` remains supported.

No migration script is required because JSONL history readers already tolerate extra fields and
missing optional fields.

## Non-Goals

- Do not merge `perf/keyed-reorder-move-path-instrumentation` wholesale.
- Do not replace the current `KeyedReorderShape` union with flat scenario strings.
- Do not remove `movedExistingBatches` from move-path counts.
- Do not change renderer diff behavior.
- Do not change package exports, router, SFC, SSR, SSG, or DevTools code.
- Do not add new benchmark shapes in this slice.

## Testing Strategy

Use TDD and focused validation:

- Add failing unit coverage for appending keyed reorder history records with first, middle, and last
  row text.
- Add failing CLI summary coverage that proves keyed reorder shape groups remain separate while
  preserving `--min-jsdom-count`.
- Add failing e2e benchmark assertions for expected row text triples for each existing keyed reorder
  shape.
- Implement the smallest benchmark result changes needed to pass those tests.

Minimum validation:

- `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`
- `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`
- `pnpm vitest run tests/unit/renderer/diff.test.ts`

Expanded validation if the browser benchmark app or e2e contract changes:

- `pnpm test:e2e -- browser-benchmark`

## Risks

- E2e browser benchmark validation can be slower than focused unit tests. Keep the browser check
  scoped to `browser-benchmark` only.
- Historical records may lack `middleRowText` and `lastRowText`; type changes must leave those
  optional for history parsing.
- The benchmark app must not count row-order assertion reads as DOM mutations for the measured
  reorder operation.

## Acceptance Criteria

- Keyed reorder benchmark results include and validate first, middle, and last row text.
- Browser benchmark e2e assertions cover all existing keyed reorder shapes with expected row text
  triples.
- Benchmark history tests prove shape grouping remains compatible with `scenario + shape` records.
- `--min-jsdom-count` behavior remains covered.
- Renderer move-path counters and renderer diff behavior are unchanged.
