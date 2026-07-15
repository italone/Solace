# jsdom Benchmark Metadata Design

## Context

Solace now logs reproducibility metadata for the Chromium production browser benchmark. The jsdom Tinybench smoke
benchmark still runs through `pnpm benchmark` without an equivalent metadata line, and `docs/performance.md` still
records CPU and memory as not recorded for the latest local benchmark run.

This design adds a small Node CLI that prints benchmark environment metadata before the jsdom benchmark suite runs.
It keeps the benchmark tests themselves focused on scenarios and avoids building a full historical results store.

## Goals

- Print a stable `benchmark metadata:` JSON line when running `pnpm benchmark`.
- Include package, Node, OS, CPU, memory, runtime, benchmark runner, environment, sample size, and timestamp fields.
- Keep `tests/performance/*.bench.ts` unchanged.
- Document the metadata fields and update the README next-step wording.
- Add a project log entry for the change.

## Non-Goals

- Do not add absolute timing thresholds.
- Do not persist benchmark results to files.
- Do not implement historical trend storage.
- Do not add a custom Tinybench reporter.
- Do not compare Solace with other frameworks.

## Architecture

Create `scripts/benchmark-metadata.mjs` as a small ESM Node CLI. It should read `package.json`, collect system
metadata from `node:os` and `process`, and print:

```text
benchmark metadata: {"packageName":"solace",...}
```

The script should also support `--json` for tests and future tooling. `package.json` should change `benchmark` from
running Vitest directly to:

```json
"benchmark": "node scripts/benchmark-metadata.mjs && vitest run --config vitest.benchmark.config.ts"
```

Using `&&` keeps the existing benchmark exit-code behavior: metadata failure stops the command, and Vitest failure
still fails the package script.

## Metadata Shape

```ts
type BenchmarkMetadata = {
  packageName: string;
  packageVersion: string;
  node: string;
  platform: string;
  release: string;
  arch: string;
  runtime: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  benchmarkRunner: "vitest";
  benchmarkEnvironment: "jsdom";
  sampleSize: 1;
  runAt: string;
};
```

`sampleSize` is `1` because the jsdom benchmark command remains a smoke benchmark run. Individual Tinybench tasks
may perform internal iterations, but the project-level harness does not yet aggregate repeated independent runs.

## Testing

- Add a Vitest test that runs `node scripts/benchmark-metadata.mjs --json` and validates the JSON shape.
- Verify the test fails before the script exists.
- Run the targeted test after implementing the script.
- Run `pnpm benchmark` to confirm metadata prints before the Tinybench suite and the suite passes.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm format:check`.

## Documentation And Logging

- Update `docs/performance.md` so the jsdom benchmark section documents `benchmark metadata`.
- Update `readme.md` so the benchmark next-step wording says both jsdom and Chromium benchmark commands now emit
  machine/runtime metadata, while history/trend storage remains future work.
- Add `solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md`.
- Add a 2026-07-14 `003` row to `solace-project-log/index.md`.

## Risks

- Shell chaining in `package.json` is already used in the project, so this keeps existing script style.
- CPU model can be unavailable; the script should fall back to `"unknown"`.
- The metadata line should not imply statistical confidence. Documentation must keep avoiding performance claims.
