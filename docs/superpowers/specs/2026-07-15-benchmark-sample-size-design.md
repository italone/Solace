# Benchmark Sample Size Design

## Goal

Allow jsdom benchmark runs to execute multiple independent samples while keeping the default benchmark command fast.

## Context

`pnpm benchmark` currently prints metadata with `sampleSize: 1` and then runs the Vitest benchmark config once. The
performance docs correctly describe this as a smoke benchmark. The next improvement is to make the sample count explicit
and configurable without changing the default release gate cost.

## Goals

- Keep `pnpm benchmark` default behavior at one sample.
- Allow repeated independent runs through `SOLACE_BENCHMARK_SAMPLE_SIZE`.
- Record the configured sample size in benchmark metadata.
- Preserve child process output and failure exit codes.
- Avoid shell loops or command interpolation.

## Non-Goals

- Do not compute cross-run medians or persist benchmark history in this step.
- Do not change individual Tinybench fixture definitions.
- Do not change the browser benchmark harness.
- Do not enforce performance thresholds.

## Design

Add `scripts/run-benchmark.mjs` as the package-level jsdom benchmark runner. It will:

- parse `SOLACE_BENCHMARK_SAMPLE_SIZE`, defaulting to `1`,
- print benchmark metadata once with the configured sample size,
- run `pnpm exec vitest run --config vitest.benchmark.config.ts` once per sample,
- print `benchmark sample X/Y` before each sample,
- exit non-zero when sample size is invalid or any child command fails,
- support `--dry-run --json` for low-cost CLI tests.

Update `scripts/benchmark-metadata.mjs` so metadata can receive the sample size through `--sample-size <n>` or
`SOLACE_BENCHMARK_SAMPLE_SIZE`.

Update `package.json`:

```json
"benchmark": "node scripts/run-benchmark.mjs"
```

## Testing

- Extend `tests/unit/scripts/benchmark-metadata.test.ts` to verify `--sample-size 3`.
- Add `tests/unit/scripts/run-benchmark.test.ts` to verify:
  - dry-run JSON defaults to sample size `1`,
  - dry-run JSON honors `SOLACE_BENCHMARK_SAMPLE_SIZE=3`,
  - invalid sample sizes exit non-zero with a clear diagnostic.

## Documentation

Update `docs/performance.md` to describe:

- default sample size remains `1`,
- use `SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` for repeated independent samples,
- the command still reports metadata and does not aggregate medians yet.

## Risks

- A wrapper script can hide child failures if it does not propagate exit status. The runner must reject on any non-zero
  child exit and set `process.exitCode`.
- Repeated samples can lengthen local runs. The default remains `1`, so CI and release gates stay fast unless the
  environment explicitly opts in.
