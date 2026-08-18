# CI Cross-Commit Performance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a same-runner base/head performance regression gate to CI while preserving the local absolute-budget gate and the independent 1.0 multi-date evidence requirement.

**Architecture:** Benchmark metadata will carry an optional validated commit SHA and the CI collector will normalize legacy base records at the collection boundary. A pure evaluator will compare median base/head metrics under a versioned 1.2 ratio configuration and require matching environment fingerprints. GitHub Actions will create a detached base worktree, run three-sample jsdom and Chromium benchmarks for both revisions, invoke the evaluator, and upload temporary raw records and reports on success or failure.

**Tech Stack:** Node.js ESM scripts, Vitest, Playwright, pnpm, Git worktrees, GitHub Actions artifacts, JSON/JSONL release configuration.

---

### Task 1: Add commit SHA metadata to persisted benchmark records

**Files:**

- Modify: `scripts/benchmark-metadata.mjs`
- Modify: `tests/e2e/browser-benchmark.spec.ts`
- Modify: `tests/e2e/browser-benchmark-history.ts`
- Test: `tests/unit/scripts/benchmark-metadata.test.ts`
- Test: `tests/unit/scripts/browser-benchmark-history.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Add tests that provide `SOLACE_BENCHMARK_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567`
and assert both jsdom metadata and browser history summaries contain that exact SHA. Add a test that
an invalid non-40-hex SHA is rejected when a history output path is configured, while metadata
without persisted output remains valid without the variable.

- [ ] **Step 2: Run the metadata tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: the new commit SHA assertions fail because current records do not expose the field.

- [ ] **Step 3: Implement shared SHA parsing and propagation**

Add a small parser in `scripts/benchmark-metadata.mjs`:

```js
export function parseBenchmarkCommitSha(env, { required = false } = {}) {
  const value = env.SOLACE_BENCHMARK_COMMIT_SHA;
  if (value === undefined || value === "") {
    if (required)
      throw new Error("SOLACE_BENCHMARK_COMMIT_SHA is required for persisted benchmark history");
    return undefined;
  }
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error("SOLACE_BENCHMARK_COMMIT_SHA must be a 40-character lowercase hexadecimal SHA");
  }
  return value;
}
```

Include the optional parsed value in jsdom metadata. In the browser benchmark, require the SHA when
`SOLACE_BROWSER_BENCHMARK_HISTORY_PATH` is set, include it in `BrowserBenchmarkMetadata`, and ensure
the appended JSONL record preserves it. Keep non-persisted local smoke commands compatible with an
unset SHA.

- [ ] **Step 4: Run the metadata tests and formatting**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
pnpm prettier --check scripts/benchmark-metadata.mjs tests/e2e/browser-benchmark.spec.ts tests/e2e/browser-benchmark-history.ts tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
```

Expected: focused tests pass and all files are formatted.

- [ ] **Step 5: Commit metadata propagation**

```bash
git add scripts/benchmark-metadata.mjs tests/e2e/browser-benchmark.spec.ts tests/e2e/browser-benchmark-history.ts tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/browser-benchmark-history.test.ts
git commit -m "feat: attach commit sha to benchmark history"
```

### Task 2: Implement the pure base/head regression evaluator

**Files:**

- Create: `scripts/performance-cross-commit-config.mjs`
- Create: `scripts/performance-cross-commit-config.d.mts`
- Create: `scripts/performance-cross-commit.mjs`
- Create: `release/performance-cross-commit-budgets.json`
- Create: `tests/fixtures/performance/base.jsonl`
- Create: `tests/fixtures/performance/head.jsonl`
- Test: `tests/unit/scripts/performance-cross-commit.test.ts`

- [ ] **Step 1: Write failing evaluator tests**

Create synthetic browser/jsdom records with explicit `commitSha`, matching environment fingerprints,
and three samples per metric. Cover:

```ts
expect(evaluateCrossCommitPerformance(input).valid).toBe(true);
expect(evaluateCrossCommitPerformance(overTwentyPercent).errors.join(" ")).toContain(
  "ratio=1.250 limit=1.200",
);
expect(evaluateCrossCommitPerformance(environmentMismatch).errors.join(" ")).toContain(
  "environment fingerprint mismatch",
);
```

Also cover odd-sample median selection, missing scenarios/metrics, non-finite values, missing or
conflicting SHAs, duplicate revision labels, and fewer than three samples.

- [ ] **Step 2: Run the evaluator tests and verify RED**

Run: `pnpm exec vitest run tests/unit/scripts/performance-cross-commit.test.ts`

Expected: the test file fails because the evaluator module does not exist.

- [ ] **Step 3: Implement configuration and evaluator**

Define `release/performance-cross-commit-budgets.json` with `schemaVersion: 1`,
`minimumSamples: 3`, `maximumRatio: 1.2`, and the existing browser/jsdom scenario metric maps. The
evaluator must:

1. validate both revision labels as distinct 40-character SHAs;
2. normalize legacy records by accepting an externally supplied revision SHA only when the record has
   no SHA, and reject conflicting values;
3. build a canonical environment fingerprint from Node major, platform, arch, OS release, CPU model,
   logical CPU count, browser/project or jsdom runner, workload size, and sample size;
4. group records by scenario and metric, require exactly the configured minimum sample count, sort
   finite positive values, and select the median;
5. fail with deterministic `FAIL kind:scenario.metric base=... head=... ratio=... limit=...` output
   when the ratio exceeds `maximumRatio`;
6. return a structured report containing normalized revisions, fingerprints, medians, ratios, and
   errors.

The CLI accepts `--base <jsonl> --head <jsonl> --config <json> --output <path>`, reads JSONL safely,
writes a formatted report when requested, prints stable failures, and exits nonzero on invalid input
or regression. Use `node:fs/promises`, `node:path`, and argument arrays only; do not shell-interpolate
record values.

- [ ] **Step 4: Run evaluator tests and CLI fixture checks**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/performance-cross-commit.test.ts
node scripts/performance-cross-commit.mjs --base tests/fixtures/performance/base.jsonl --head tests/fixtures/performance/head.jsonl --config release/performance-cross-commit-budgets.json
```

Expected: unit tests pass; the passing fixture prints `performance cross-commit: PASS`.

- [ ] **Step 5: Commit the evaluator slice**

```bash
git add scripts/performance-cross-commit-config.mjs scripts/performance-cross-commit-config.d.mts scripts/performance-cross-commit.mjs release/performance-cross-commit-budgets.json tests/unit/scripts/performance-cross-commit.test.ts tests/fixtures/performance/base.jsonl tests/fixtures/performance/head.jsonl
git commit -m "feat: add cross-commit performance evaluator"
```

### Task 3: Add the CI same-runner comparison job

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `scripts/ci-performance-comparison.mjs`
- Test: `tests/unit/scripts/ci-performance-comparison.test.ts`
- Test: `tests/unit/docs/release-docs.test.ts`

- [ ] **Step 1: Write failing commit-resolution and orchestration tests**

Test pull-request input resolves `pull_request.base.sha` and `pull_request.head.sha`; push input
resolves `before` and `sha`; all-zero or missing base SHA throws a stable error. Test that legacy base
records receive the resolved SHA, conflicting record SHAs fail, and temporary output paths are
revision-specific.

- [ ] **Step 2: Run orchestration tests and verify RED**

Run: `pnpm exec vitest run tests/unit/scripts/ci-performance-comparison.test.ts`

Expected: the test file fails because the orchestrator does not exist.

- [ ] **Step 3: Implement the CI orchestrator**

Implement `scripts/ci-performance-comparison.mjs` with pure exported helpers for SHA resolution and
record normalization, plus a CLI path that:

1. resolves base/head SHAs from explicit CLI arguments or GitHub environment variables;
2. creates a temporary base detached worktree with `git worktree add --detach`;
3. runs `pnpm install --frozen-lockfile` and the jsdom/browser benchmark commands in each worktree
   with `SOLACE_BENCHMARK_COMMIT_SHA`, sample size `3`, and separate JSONL output paths;
4. invokes the pure evaluator against those paths and writes `performance-cross-commit-report.json`;
5. removes the temporary worktree and output directory in a `finally` block while preserving report
   files for CI artifact upload.

Use `spawn`/`execFile` with argument arrays, propagate child exit codes and stderr, and reject missing
base/head revisions before creating worktrees.

- [ ] **Step 4: Wire the CI job and package script**

Add `performance:compare:ci: node scripts/ci-performance-comparison.mjs` to `package.json`. Add a
`performance-comparison` job after `quality` in `.github/workflows/ci.yml` that:

```yaml
performance-comparison:
  needs: quality
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    # setup pnpm/node/cache and install dependencies as in the existing jobs
    - name: Install Playwright Chromium
      run: pnpm exec playwright install --with-deps chromium
    - name: Compare base and candidate performance
      run: pnpm performance:compare:ci
    - name: Upload performance comparison diagnostics
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: performance-cross-commit-${{ github.run_id }}
        path: .performance-artifacts/
        if-no-files-found: warn
```

The job must pass the event-derived base/head SHAs through environment variables, must not write to
`.benchmark-history/`, and must keep the existing browser job unchanged.

- [ ] **Step 5: Add workflow documentation assertions and validate locally**

Extend `tests/unit/docs/release-docs.test.ts` to require the new script, 20% ratio, three samples,
same-runner comparison, and artifact upload wording in `docs/release.md`. Run:

```bash
pnpm exec vitest run tests/unit/scripts/ci-performance-comparison.test.ts tests/unit/docs/release-docs.test.ts
pnpm prettier --check .github/workflows/ci.yml package.json scripts/ci-performance-comparison.mjs tests/unit/scripts/ci-performance-comparison.test.ts docs/release.md tests/unit/docs/release-docs.test.ts
```

Expected: focused tests and formatting pass.

- [ ] **Step 6: Commit CI integration**

```bash
git add .github/workflows/ci.yml package.json scripts/ci-performance-comparison.mjs tests/unit/scripts/ci-performance-comparison.test.ts docs/release.md tests/unit/docs/release-docs.test.ts
git commit -m "ci: compare cross-commit performance on same runner"
```

### Task 4: Add release metadata and run the full verification slice

**Files:**

- Create: `.changeset/cross-commit-performance-gate.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Test: `tests/unit/docs/public-contract-docs.test.ts`

- [ ] **Step 1: Add the patch changeset and synchronized status note**

Create `.changeset/cross-commit-performance-gate.md`:

```md
---
"@italone/solace": patch
---

Add a same-runner base/head performance regression gate with commit and environment evidence while keeping 1.0 history requirements separate.
```

Add the same English/Chinese status statement: the CI cross-commit gate is active, uses three samples
and a 1.2 ratio, and does not count as five-date 1.0 evidence.

- [ ] **Step 2: Update documentation contract tests and format**

Assert the new script, ratio, sample count, and separation from 1.0 evidence in
`tests/unit/docs/public-contract-docs.test.ts`. Run `pnpm prettier --check .changeset/cross-commit-performance-gate.md docs/project-status.md docs/project-status.zh-CN.md tests/unit/docs/public-contract-docs.test.ts` and `git diff --check`.

- [ ] **Step 3: Run the complete local gates**

Run:

```bash
pnpm quality
pnpm test:coverage
pnpm package:smoke
pnpm adoption:smoke
pnpm stable:app
pnpm benchmark
pnpm benchmark:browser
pnpm performance:regression
pnpm test:e2e
pnpm test:e2e:devtools-extension
pnpm release:one-zero:check -- --report
```

Expected: all local gates pass; 1.0 remains `INCOMPLETE` because CI comparison is not five-date
evidence and the existing adoption/DevTools/stable-boundary gaps remain honest.

- [ ] **Step 4: Commit release metadata and final local state**

```bash
git add .changeset/cross-commit-performance-gate.md docs/project-status.md docs/project-status.zh-CN.md tests/unit/docs/public-contract-docs.test.ts
git commit -m "chore: record cross-commit performance gate"
git status -sb
```

Expected: the worktree is clean; no push, npm publish, or tag creation occurs.
