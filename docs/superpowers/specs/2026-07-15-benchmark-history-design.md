# Benchmark History Design

## Context

Solace has two benchmark paths: `pnpm benchmark` for jsdom Tinybench smoke benchmarks and `pnpm benchmark:browser` for
Chromium production-build smoke benchmarks. Both commands emit reproducibility metadata, and jsdom benchmark sample size
is configurable through `SOLACE_BENCHMARK_SAMPLE_SIZE`.

The remaining README and performance-doc gap is trend recording. Persisting every benchmark run by default would create
working tree churn and make CI/local behavior diverge. The first history increment should therefore be opt-in and local.

## Goals

- Allow jsdom benchmark runs to append a JSONL history record when explicitly requested.
- Keep `pnpm benchmark` default behavior unchanged: one sample, no file writes.
- Write history only after all benchmark samples pass.
- Keep the history record reproducible but modest: metadata, sample size, command, sample count, and status.
- Avoid parsing Tinybench timing output or computing medians in this step.

## Non-Goals

- Do not record browser benchmark history yet.
- Do not aggregate medians, p95, variance, or historical comparisons.
- Do not set performance thresholds.
- Do not commit generated benchmark history files.

## Design

Add `SOLACE_BENCHMARK_HISTORY_PATH` as an opt-in environment variable for `scripts/run-benchmark.mjs`.

When unset, `createRunPlan()` continues to return only the existing command, args, and sample size in dry-run JSON. When
set, the dry-run JSON includes `historyPath` so users and tests can see where the runner would write.

In real benchmark mode, the runner will:

1. Build metadata in-process with the same package, OS, CPU, memory, sample size, and timestamp fields used by
   `scripts/benchmark-metadata.mjs`.
2. Print the existing `benchmark metadata: ...` line once.
3. Run the Vitest benchmark command once per configured sample.
4. After every sample succeeds, append one JSON line to `SOLACE_BENCHMARK_HISTORY_PATH`.

The JSONL record shape is:

```json
{
  "kind": "jsdom-benchmark",
  "status": "passed",
  "metadata": { "benchmarkEnvironment": "jsdom", "sampleSize": 1 },
  "sampleCount": 1,
  "command": "pnpm",
  "args": ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"]
}
```

The runner creates the parent directory for the history path and appends with UTF-8 encoding. It rejects empty history
paths. It does not write a failure record when metadata collection or any benchmark sample fails.

To avoid duplicating metadata logic in two scripts, move metadata construction into `scripts/benchmark-metadata.mjs` as
exported functions while preserving CLI behavior.

The runner must not provide an environment-variable command override. Tests should exercise the same benchmark command
path users run so this script does not become a generic command execution wrapper.

## Validation

- Unit tests for dry-run history path, invalid empty history path, metadata exports, and JSONL append behavior through a
  temporary file.
- `pnpm benchmark` to confirm the default runner still works and does not require a history path.
- Full quality gates: tests, typecheck, lint, build, and format check.
