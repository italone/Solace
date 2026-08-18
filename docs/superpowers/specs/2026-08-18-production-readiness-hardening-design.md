# Solace Production Readiness Hardening Design

## Goal

Turn the current beta.5 evidence into an honest, enforceable release system without claiming that
Solace is production-ready or 1.0-ready before real Solace-primary applications exist.

## Status Model

`pnpm release:one-zero:check` evaluates a **1.0 evidence checklist**. Its terminal states are
`READY` and `INCOMPLETE`; neither state publishes a package or changes API maturity. The report must
explain every unmet criterion. Beta publishing remains possible while the checklist is incomplete,
but the stable `release:publish` command must require a ready checklist.

## Production Adoption Evidence

An application counts toward 1.0 only when all of these fields are present and verified:

- it is independent of this repository and installs an exact npm version;
- Solace is its primary renderer rather than a temporary compatibility bundle;
- it exercises Router, Store, async components, error recovery, and SSR/hydration;
- an upgrade from a previous beta and a rollback rehearsal are recorded;
- the evidence points to a repository-relative evidence document.

The existing React/Vite installations remain useful package compatibility evidence, but they do not
count as production adoption. Repository-owned Operations Console and adoption-consumer fixtures
remain release gates and also do not count as independent adoption. Missing external evidence is an
honest `INCOMPLETE` result, not a reason to manufacture a passing record.

## Stable Contract Freeze

Add `release/public-contract.json` as the machine-readable source for the eight protected package
exports and their maturity. A contract checker validates that every package export is represented,
that maturity values are explicit, and that a stable 1.0 admission cannot pass while the package
root still mixes stable runtime APIs with beta Router or async APIs. This freezes the current
boundary without promoting beta or experimental capabilities.

## Performance Regression Gate

Historical readiness requires both a minimum distinct-run count and a minimum distinct-date count.
Add a checked-in performance budget file and an executable regression checker that reads the latest
successful browser and jsdom history records. The gate compares current latency against explicit
per-scenario maximums and reports the exact scenario and observed value on failure. The full release
gate runs benchmarks first and the regression checker immediately afterward.

Timing budgets are intentionally broad enough for supported development machines. They are a
catastrophic-regression guard, not a marketing benchmark. The checked-in history remains the audit
trail; readiness requires five distinct dates so repeated runs in one session cannot satisfy it.

## Core Module Boundaries

Reduce the two largest modules without changing public behavior:

- move Router option, route record, and raw-location validation into `src/router/contract.ts`;
- move keyed sequence helpers and the longest-increasing-subsequence implementation into
  `src/renderer/keyed-sequence.ts`.

Existing public Router and renderer tests are characterization tests. New focused internal tests
cover the extracted pure helpers. No new root export or runtime capability is introduced.

## Release Closure

The completed post-beta.5 changes form a local beta.6 candidate. Preparation includes a changelog
entry, package version, synchronized English/Chinese status docs, a consumed changeset record, and a
fresh full `pnpm release:check`. npm publication and GitHub push remain separate external actions;
the local candidate must stay explicit if GitHub connectivity is unavailable.

## Non-Goals

- Do not implement streaming SSR, auth, permissions, expanded SFC syntax, or a production DevTools
  distribution.
- Do not count repository fixtures or temporary React integration bundles as real adoption.
- Do not split navigation or renderer algorithms beyond the two low-risk responsibility extracts.
- Do not publish npm or create a remote tag as part of this work.

## Success Criteria

- Ordinary and DevTools Playwright suites run under their correct configs.
- The 1.0 report becomes `INCOMPLETE` with actionable missing real-adoption and stable-contract
  criteria.
- Stable publishing invokes the strict 1.0 checklist; beta publishing does not.
- CI reports the 1.0 checklist and runs the public contract checker.
- Performance history enforces five distinct dates and executable budgets.
- Router and renderer large files shrink through behavior-preserving extraction.
- The beta.6 local candidate passes the complete release gate.
