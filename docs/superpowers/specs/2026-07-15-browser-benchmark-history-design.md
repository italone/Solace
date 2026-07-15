# Browser Benchmark History Design

## Context

The jsdom benchmark runner now supports opt-in local JSONL history through `SOLACE_BENCHMARK_HISTORY_PATH`. The browser
production benchmark still only prints a `browser benchmark summary:` JSON line. README and the project log now identify
browser benchmark history as the next trend-recording gap.

The browser benchmark already has a structured summary containing measured browser timings and reproducibility metadata.
That summary is the right unit to persist; this step should not parse console output or compute aggregate statistics.

## Goals

- Add opt-in JSONL history recording for `pnpm benchmark:browser`.
- Keep default `pnpm benchmark:browser` behavior unchanged when no history path is set.
- Write one history record only after the browser benchmark summary passes its current assertions.
- Reuse the existing browser benchmark summary shape instead of inventing separate timing fields.
- Keep generated history files out of version control.

## Non-Goals

- Do not add browser benchmark sample size configuration.
- Do not compute medians, p95, variance, or trend comparisons.
- Do not set performance thresholds.
- Do not change the browser benchmark app, scenarios, or Playwright server setup.

## Design

Introduce a small helper at `tests/e2e/browser-benchmark-history.ts`:

- `parseBrowserBenchmarkHistoryPath(env)`: returns `undefined` when `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH` is unset,
  returns the raw path when set, and rejects whitespace-only values with
  `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH must not be empty`.
- `appendBrowserBenchmarkHistory(historyPath, summary)`: creates the parent directory and appends one UTF-8 JSON line.

The JSONL record shape is:

```json
{
  "kind": "browser-benchmark",
  "status": "passed",
  "sampleCount": 1,
  "summary": {
    "scenario": "large-list",
    "metadata": {
      "browserName": "chromium",
      "sampleSize": 1
    }
  }
}
```

`tests/e2e/browser-benchmark.spec.ts` parses the history path at test start and appends the summary after
`expectBrowserBenchmarkSummary(summary)` and the console log. If the path is invalid, the benchmark command fails with a
clear env-var message. If the benchmark itself fails, no success history record is written.

Document the env var in `docs/performance.md` and update README so both jsdom and browser benchmarks have opt-in local
history while statistical aggregation remains future work.

## Validation

- Unit tests for path parsing and JSONL append helper.
- `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=<tmp>/browser.jsonl pnpm benchmark:browser` to verify the production browser
  benchmark writes a record.
- `pnpm test:e2e` to ensure ordinary e2e remains unaffected.
- Full quality gates: tests, typecheck, lint, build, format check.
