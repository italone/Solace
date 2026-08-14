# Performance History Readiness Design

**Date:** 2026-08-14

**Target:** Replace hand-maintained 1.0 performance counts with deterministic, checked-in evidence
generated from ignored benchmark JSONL history.

## Goal

Make the `performance.recent-history` criterion auditable without committing raw local benchmark
history. Every required browser scenario and jsdom task must have at least five distinct valid
`runAt` timestamps. First and last timestamps plus distinct date counts are recorded for review but
do not create an additional cross-day threshold.

## Evidence Boundary

Raw files remain local and ignored:

- `.benchmark-history/browser.jsonl`
- `.benchmark-history/jsdom.jsonl`

A new generator reads those files and writes a deterministic summary to
`release/performance-history.json`. The summary contains:

- schema version and source-relative paths;
- SHA-256 digests and raw record counts for both source files;
- stable, sorted browser scenario and jsdom task maps;
- record count, distinct run count, distinct date count, first run timestamp, and last run
  timestamp for each scenario or task.

The generator counts only successful records with valid ISO timestamps. Browser scenarios use the
existing `scenario` name plus the keyed-reorder `shape` suffix. A jsdom record contributes its
timestamp once to each named task in `summary.tasks`. Duplicate timestamps do not increase
`distinctRunCount`.

The output omits wall-clock generation time so running the generator twice against unchanged input
produces identical bytes. Source digests tie the checked-in summary to the local JSONL inputs used to
produce it without publishing machine-specific raw timing data.

## Readiness Integration

`release/one-zero-readiness.json` replaces `browserScenarioCounts` and `jsdomScenarioCounts` with a
safe repository-relative evidence path. The readiness CLI loads that JSON file and passes the parsed
summary into the pure evaluator.

The evaluator requires:

- `minimumDistinctRuns` to be an integer of at least five;
- a supported summary schema;
- non-empty browser and jsdom scenario maps;
- valid per-scenario audit fields;
- `distinctRunCount >= minimumDistinctRuns` for every scenario and task.

The evaluator rejects the legacy hand-maintained count maps. Evidence paths must be non-empty,
repository-relative, and must not contain parent traversal. Missing or malformed evidence fails the
CLI with an actionable path-specific error.

## Current Evidence

The existing local browser history already contains at least five distinct runs per required
scenario. Before this slice, the jsdom file contained four raw records, but only two had task-level
metrics and distinct timestamps; the two older metadata-only records cannot prove task history.
One new successful jsdom benchmark run is appended after the generator and evaluator tests pass,
bringing every current task to three distinct runs without synthetic or duplicated records.

After regeneration, the performance criterion may pass while the overall 1.0 report remains not
ready because repository fixtures do not count as two independent real applications.

## Non-Goals

- Do not commit raw `.benchmark-history` files.
- Do not introduce timing thresholds or framework performance claims.
- Do not require a minimum number of calendar dates in this slice.
- Do not change benchmark execution, sample-size semantics, scenarios, or metrics.
- Do not count Operations Console or adoption fixtures as real applications.
- Do not publish, tag, push, or alter npm dist-tags.

## Validation

- Unit tests for stable evidence generation, duplicate timestamps, invalid timestamps, missing
  files, source digests, and deterministic scenario ordering.
- Unit tests for readiness summary validation, legacy count rejection, insufficient distinct runs,
  unsafe evidence paths, and CLI loading failures.
- One real jsdom benchmark append to reach three distinct task runs; keep the five-run gate failing
  until two later independent collection points exist.
- Generate `release/performance-history.json` twice and verify byte stability.
- Run focused script tests, the current readiness report, `pnpm release:check`, and
  `git diff --check`.
