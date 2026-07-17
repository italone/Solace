# Jsdom Benchmark Metrics History Design

## Context

Solace now keeps local ignored benchmark history for both jsdom and browser production runs. Browser history records
include per-run timing metrics (`initialRenderMs`, `updateMs`, `unmountMs`) and `pnpm benchmark:history` summarizes
median, p95, and variance for those metrics.

The jsdom benchmark history currently records only metadata, status, command, args, and sample count. This means jsdom
benchmark trend records can prove the benchmark suite ran, but they cannot show which Tinybench tasks changed over time.
The performance document explicitly notes that Tinybench timing aggregation is not yet persisted.

## Goal

Persist jsdom Tinybench task timing summaries in `.benchmark-history/jsdom.jsonl` and teach `pnpm benchmark:history` to
summarize those jsdom metrics by benchmark task.

## Non-Goals

- Do not add runtime renderer, component, scheduler, reactivity, DevTools, or package API changes.
- Do not add absolute timing thresholds or fail builds based on timing values.
- Do not change browser benchmark record shape.
- Do not commit local `.benchmark-history/**` files.
- Do not compare Solace against external frameworks.

## Proposed Approach

Use an explicit benchmark metrics helper inside the jsdom benchmark files. A quick probe showed Vitest's JSON reporter
only exposes test-level duration for these benchmark tests, not Tinybench task latency or throughput. The implementation
should therefore move the duplicated per-file `report(bench)` logic into a shared helper that both prints the existing
human-readable lines and stores task-level metrics in a process-scoped collection.

`scripts/run-benchmark.mjs` should run the existing benchmark command as it does today. When history recording is
enabled, the benchmark process should also write a temporary JSON metrics artifact through an internal environment
variable controlled by the runner. The runner should parse that artifact after all samples pass and append a jsdom
history record containing:

- existing metadata and run fields,
- `sampleCount`,
- benchmark command and args,
- a `summary.tasks` array with one entry per Tinybench task.

Each task entry should include a stable benchmark label, the benchmark file, and numeric timing summaries available from
Tinybench, such as latency mean and p99 when present. If a task lacks a numeric metric, the metrics helper should omit
that metric rather than inventing a value.

`scripts/summarize-benchmark-history.mjs` should keep the existing browser grouping unchanged and add jsdom groups keyed
by task name. For each numeric jsdom task metric, it should report count, median, p95, and variance across history
records. Existing jsdom records without task summaries must still be accepted and counted so old local history files
remain readable.

## Alternatives Considered

### Persist Only Total Benchmark Runtime

This is simple, but it does not help identify which scenario changed. It would hide the difference between list diff,
Fragment, component update, and memory benchmark behavior.

### Parse Human Console Output

The existing benchmark files print human-readable Tinybench reports. Parsing those lines would be brittle and sensitive
to wording changes. A machine-readable output path is safer.

### Use Vitest JSON Reporter

This was the initial idea, but a probe of `vitest --reporter=json` showed only test-level duration and assertion status
for the current benchmark tests. It does not include Tinybench task-level latency or throughput, so it is not sufficient
for scenario-level trend records.

### Add Threshold Gates Now

Thresholds need more data and a variance policy. The current task should only persist and summarize data so later
threshold design has evidence.

## Record Shape

The new jsdom record should remain JSONL-compatible and backwards-compatible:

```json
{
  "kind": "jsdom-benchmark",
  "status": "passed",
  "metadata": {},
  "sampleCount": 3,
  "command": "pnpm",
  "args": ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
  "summary": {
    "tasks": [
      {
        "name": "10000 row local text update",
        "file": "tests/performance/list-diff.bench.ts",
        "metrics": {
          "latencyMeanMs": 1.23,
          "latencyP99Ms": 2.34,
          "throughputMeanOpsPerSec": 456.78
        }
      }
    ]
  }
}
```

The exact numeric values above are illustrative. Implementation must map real Vitest/Tinybench output fields and should
use explicit metric names so future readers know the unit and meaning.

## Behavioral Requirements

- `pnpm benchmark` without `SOLACE_BENCHMARK_HISTORY_PATH` continues to run the existing jsdom benchmark suite.
- `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark` appends a valid JSONL record.
- New records include task-level numeric metrics when Vitest/Tinybench exposes them.
- The metrics artifact path is internal to `scripts/run-benchmark.mjs` and should not be required from users.
- `pnpm benchmark:history` remains compatible with old jsdom metadata-only records.
- `pnpm benchmark:history -- --json` includes jsdom task metric summaries when task metrics exist.
- Browser history summaries and `--min-browser-count` behavior remain unchanged.
- Invalid metrics JSON should fail with a clear error rather than appending a misleading history record.

## Test Plan

Implementation should use TDD in the script unit tests:

- Add helper tests for collecting representative Tinybench task metrics from completed and non-completed tasks.
- Add history summary tests proving jsdom task metrics produce median, p95, and variance.
- Add compatibility tests for old jsdom records without `summary.tasks`.
- Add a dry-run or fixture-based test for `run-benchmark` history record creation without running the full benchmark suite.

Then run:

- `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts`
- `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`
- `pnpm benchmark`
- `pnpm benchmark:history -- --json`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`

## Documentation And Logging

Implementation should update:

- `docs/performance.md` to state that jsdom history now persists task-level metrics and can summarize them.
- `solace-project-log/index.md` and a new implementation log entry.

This design document is tracked separately as `2026-07-17-018`.

## Risk And Safety

The main risk is making benchmark files depend on a process-global side channel. Keep the helper small, fixture-backed,
and active only when the runner sets an internal metrics artifact path. The history writer should only append after all
benchmark samples pass and metrics artifact parsing succeeds.
