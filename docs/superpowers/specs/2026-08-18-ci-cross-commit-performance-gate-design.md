# CI Cross-Commit Performance Gate Design

## Goal

Add a reproducible CI performance regression gate that compares the pull request or pushed commit
with its base revision on the same GitHub Actions runner. The gate must identify real cross-commit
regressions without treating local benchmark history or fabricated timestamps as CI evidence.

## Current Problem

The existing `pnpm performance:regression` command checks the latest local browser and jsdom records
against absolute budgets and requires a minimum number of local runs and dates. Those records live in
the ignored `.benchmark-history/` directory. A clean CI runner neither checks out that directory nor
configures the benchmark commands to write complete history, so the current CI step cannot reproduce
the local gate from repository state alone.

Existing benchmark metadata captures package version, runtime, operating system, CPU, memory, and
browser details, but it does not identify the Git commit. The current evaluator also does not require
matching environments and does not compare candidate values with a prior commit.

## Selected Approach

CI will benchmark two Git worktrees on the same runner:

1. the resolved base commit;
2. the candidate commit checked out by the workflow.

Both sides use the same installed Node major version, pnpm version, Playwright Chromium installation,
runner hardware, benchmark commands, and sample size. Each side runs three samples. The comparison
uses the median value for every configured scenario and metric and fails when the candidate median is
more than 20 percent above the base median.

The existing local absolute-budget gate remains unchanged. The new relative gate is additive and CI
specific.

## Commit Resolution

For pull requests, the base commit is `github.event.pull_request.base.sha` and the candidate commit is
`github.event.pull_request.head.sha`. For a push to `main`, the base commit is `github.event.before`
and the candidate commit is `github.sha`.

The workflow must reject an all-zero or missing base SHA with a clear message instead of silently
comparing the candidate with itself. The checkout step must fetch enough history to make both commits
available. It must not mutate or push either revision.

## Benchmark Records

Browser and jsdom benchmark metadata gain a required `commitSha` field. The value is supplied through
`SOLACE_BENCHMARK_COMMIT_SHA`; benchmark commands used for persisted comparison records reject a
missing or malformed SHA. Ordinary smoke runs that do not persist comparison data may keep commit
metadata optional so existing local `pnpm benchmark` and `pnpm benchmark:browser` commands remain
ergonomic.

The base revision may predate native `commitSha` support. The candidate-owned comparison orchestrator
therefore binds the resolved revision SHA to every collected base and candidate record at the
collection boundary. If a record already contains `commitSha`, the orchestrator requires an exact
match; it may fill a missing field for a legacy base record, but it may never overwrite a conflicting
value. The normalized comparison inputs always contain explicit commit SHAs.

The CI comparison command invokes both benchmark paths with:

- the exact revision SHA;
- sample size `3`;
- temporary, revision-specific JSONL output paths;
- no writes to the repository-owned source tree.

Temporary output is deleted after comparison. It is not committed and does not count toward 1.0
multi-date evidence.

## Environment Fingerprint

Before comparing metrics, the evaluator builds a canonical environment fingerprint from fields that
must match between base and candidate:

- Node major version;
- platform and architecture;
- operating-system release;
- CPU model and logical CPU count;
- browser name, browser major version, and Playwright project for browser scenarios;
- benchmark runner and environment for jsdom scenarios;
- row count or other scenario-size fields that define workload size;
- configured sample size.

Package version, commit SHA, timestamps, and measured values are intentionally excluded from the
fingerprint. Any required-field omission or fingerprint mismatch fails the gate rather than producing
an invalid ratio.

## Aggregation And Thresholds

The relative gate owns a machine-readable configuration file with:

- schema version;
- minimum sample count of `3`;
- default maximum regression ratio of `1.2`;
- the browser and jsdom scenarios and metrics to compare;
- optional per-metric overrides when future evidence justifies them.

For each metric, the evaluator sorts the finite sample values and selects the median. A candidate
passes when `candidateMedian <= baseMedian * maximumRatio`. Missing scenarios, missing metrics,
non-finite or non-positive values, duplicate revision labels, insufficient samples, and environment
mismatches are hard failures.

Failure output is stable and actionable:

```text
FAIL browser:keyed-reorder:reverse.reorderMs base=10.00ms head=12.50ms ratio=1.250 limit=1.200
```

The command exits nonzero when any comparison fails, so the GitHub Actions job becomes the alert. No
external notification service is added in this slice.

## CI Workflow

Add a dedicated `performance-comparison` job after ordinary quality checks. It creates temporary
base and candidate worktrees, installs dependencies once per worktree with the locked pnpm version,
uses the already installed browser binaries, executes the comparison command, and uploads the raw
base/head JSONL plus the comparison report as diagnostic artifacts even on failure.

The existing `browser` job continues to run the production browser benchmark and browser E2E, but it
does not run the local absolute regression gate because ignored `.benchmark-history/` records are not
available on a clean runner. `pnpm release:check` retains that local gate. The relative comparison job
is separate so its doubled benchmark cost and diagnostic artifacts remain visible.

## Testing

Unit tests cover:

- median calculation for odd sample counts;
- a passing comparison at or below 20 percent;
- a failing comparison above 20 percent with exact diagnostics;
- missing or duplicate revisions;
- insufficient samples;
- environment fingerprint mismatch;
- missing/non-finite metrics;
- commit SHA parsing and propagation for jsdom and browser metadata;
- legacy base-record SHA binding and conflicting-SHA rejection;
- pull-request and push base/head SHA resolution.

CLI integration tests use small synthetic JSONL fixtures and verify both exit codes. Workflow
documentation tests assert that CI runs the relative gate and retains diagnostic artifacts. The
complete `pnpm quality` and `pnpm release:check` gates remain required before completion.

## Relationship To 1.0 Evidence

This gate proves that one candidate commit does not regress materially from one base commit on the
same runner. It does not prove five-date stability. CI comparison artifacts therefore do not update
`release/performance-history.json`, do not modify the ignored local history, and do not make
`release:one-zero:check` pass. The five distinct real dates per keyed browser scenario remain an
independent long-term evidence requirement.

## Out Of Scope

- Fabricating, copying, or rewriting benchmark timestamps.
- Treating CI artifacts as production adoption or 1.0 performance history.
- Automatically changing performance thresholds from observed results.
- External alerting, dashboards, scheduled benchmark workflows, or cross-run artifact retention.
- Renderer or Router performance optimization.
- Production DevTools distribution or independent application adoption evidence.
