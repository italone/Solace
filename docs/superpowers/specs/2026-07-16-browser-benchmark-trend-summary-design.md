# Browser Benchmark Trend Summary Design

## Context

After the Fragment batch mount and stable child component update skip changes, the next performance follow-up was to
collect additional browser trend samples. The generated `.benchmark-history/*.jsonl` files are intentionally ignored and
should not be committed, but the observed local summary is useful context for future threshold decisions.

## Goals

- Record the local Chromium production benchmark trend summary in `docs/performance.md`.
- Keep the summary clearly scoped to local samples, not a public performance claim.
- Preserve the rule that raw benchmark history files stay out of version control.
- Record the validation and decision in the project log.

## Non-Goals

- Do not add performance thresholds.
- Do not compare Solace with other frameworks.
- Do not commit `.benchmark-history/`.
- Do not change benchmark scripts or runtime code.

## Summary To Record

The local history summary contains one jsdom record and three browser records. Browser `large-list` metrics:

| Metric            | Median | p95  | Variance |
| ----------------- | ------ | ---- | -------- |
| `initialRenderMs` | 15.2   | 28.7 | 45.14    |
| `updateMs`        | 7.0    | 15.9 | 20.55    |
| `unmountMs`       | 1.4    | 3.5  | 1.08     |

With only three browser samples, p95 is the slowest observed sample. The docs should describe this as trend context
only and keep thresholds deferred.

## Validation

- `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark`
- `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` three times total
- `pnpm benchmark:history -- --json`
- `git status --short --branch --ignored=matching` to confirm `.benchmark-history/` is ignored
- Docs format check before commit
