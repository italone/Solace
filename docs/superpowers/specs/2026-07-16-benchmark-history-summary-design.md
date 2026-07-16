# Benchmark History Summary Design

## Context

Solace now records opt-in JSONL benchmark history for both jsdom and Chromium browser benchmark commands:

- `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark`
- `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser`

The remaining benchmark trend gap is local aggregation. The history files exist, but users still need to manually parse
JSONL to compare runs. The first aggregation step should be read-only and local so it does not create new working tree
churn or CI side effects.

## Goals

- Add a `pnpm benchmark:history` command that summarizes one or more JSONL history files.
- Report record counts and numeric metrics using median, p95, and variance.
- Support browser benchmark timing metrics (`initialRenderMs`, `updateMs`, `unmountMs`).
- Keep jsdom history useful by counting records even though current jsdom records do not include Tinybench timings.
- Provide JSON output for future automation.
- Fail clearly on malformed JSONL with file and line information.

## Non-Goals

- Do not parse raw Tinybench console output.
- Do not write files or mutate history.
- Do not enforce performance thresholds.
- Do not add browser or jsdom benchmark samples in this step.

## Design

Create `scripts/summarize-benchmark-history.mjs`.

CLI behavior:

- `pnpm benchmark:history` reads default paths:
  - `.benchmark-history/jsdom.jsonl`
  - `.benchmark-history/browser.jsonl`
- `pnpm benchmark:history -- --json <path...>` reads explicit paths and prints machine-readable JSON.
- Missing files are ignored so the command is usable before any local history exists.
- Blank lines are ignored.
- Malformed JSON fails with `Invalid benchmark history JSON at <path>:<line>`.

Summary shape:

```json
{
  "recordCount": 3,
  "groups": [
    {
      "kind": "browser-benchmark",
      "scenario": "large-list",
      "recordCount": 3,
      "metrics": {
        "initialRenderMs": { "count": 3, "median": 12, "p95": 14, "variance": 2.6666666667 }
      }
    }
  ]
}
```

Grouping rules:

- `browser-benchmark` records group by `kind` and `summary.scenario`.
- `jsdom-benchmark` records group by `kind` and `metadata.benchmarkEnvironment`.
- Unknown records are ignored rather than causing the summarizer to fail.

Statistics:

- Median is the middle sorted value, or the average of the two middle values for even counts.
- p95 uses nearest-rank percentile: `ceil(0.95 * count) - 1`.
- Variance is population variance.

## Validation

- Unit tests cover browser metrics, jsdom record counts, missing files, malformed JSONL, and CLI JSON output.
- Run `pnpm benchmark:history -- --json <tmpfile>` against a generated temporary history file.
- Run project test/typecheck/lint/build/format gates.
