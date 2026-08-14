# Beta.5 Contract, Adoption, And Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the local beta.5 candidate, finish typed-slot producer contracts, add independent adoption validation, preserve the router-aware SSR boundary, and add executable 1.0 admission checks.

**Architecture:** Extend existing release and package-smoke scripts instead of adding parallel release paths. Keep typed slots compile-time only, isolate adoption consumers under `examples/adoption-consumer`, and model 1.0 readiness as pure evidence evaluation plus a small CLI. Router-aware SSR/hydration remains a design and rejection contract.

**Tech Stack:** TypeScript 5.9, Node.js ESM, pnpm 10, Rollup, Vite, Vitest, jsdom, Playwright, Changesets-compatible prerelease metadata.

---

### Task 1: Prepare beta.5 and dual compatibility baselines

**Files:** `package.json`, `CHANGELOG.md`, `scripts/operations-console-smoke-config.mjs`, `scripts/operations-console-smoke.mjs`, `tests/unit/scripts/operations-console-smoke.test.ts`, `tests/unit/docs/public-contract-docs.test.ts`, `docs/release.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `readme.md`, `readme.zh-CN.md`

- [ ] Add failing tests for repeatable allowlisted `--baseline 0.1.0-beta.2 --baseline 0.1.0-beta.4` parsing and candidate script composition.
- [ ] Run the focused script tests and confirm the current single-baseline parser fails.
- [ ] Implement ordered baseline arrays and run every selected baseline before the packed candidate.
- [ ] Change the local candidate to `0.1.0-beta.5`; record typed emit/listener/slot work and registry/adoption gates in CHANGELOG and status docs while keeping npm beta at beta.4.
- [ ] Update documentation contract tests with the fresh 2026-08-14 metrics.
- [ ] Run focused tests, `pnpm release:readiness`, and both network-backed baselines when available.

### Task 2: Finish typed-slot producer contracts

**Files:** `src/jsx-types.ts`, `src/jsx-runtime.ts`, `src/jsx-dev-runtime.ts`, `src/vnode/vnode.ts`, `src/vnode/h.ts`, `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`, `scripts/package-consumer-smoke.mjs`, `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`

- [ ] Add failing TSX cases for required/forbidden default children and failing `h()` cases for required, unknown, and incompatible named/scoped slots.
- [ ] Run `pnpm typecheck` and `pnpm typecheck:jsxdev`; confirm unused `@ts-expect-error` directives or missing-child errors prove RED.
- [ ] Add slot-map utilities that derive JSX children requirements and typed `h()` slot objects while retaining permissive defaults.
- [ ] Mirror positive and negative contracts in the packed consumer source.
- [ ] Update English/Chinese API and package usage boundaries.
- [ ] Run both typechecks, focused runtime tests, `pnpm test:package`, and `pnpm package:smoke`.

### Task 3: Add independent CSR and SSR/hydration adoption validation

**Files:** `examples/adoption-consumer/**`, `scripts/adoption-consumer-smoke-config.mjs`, `scripts/adoption-consumer-smoke.mjs`, `tests/unit/scripts/adoption-consumer-smoke.test.ts`, `playwright.adoption.config.ts`, `package.json`, `docs/examples.md`, `docs/large-app.md`, `docs/large-app.zh-CN.md`

- [ ] Add failing pure tests for local-tarball and exact-registry package specs, generated consumer metadata, and stage-specific errors.
- [ ] Create a fixture that imports only `@italone/solace` public paths and exposes CSR, server render, matching hydration, and recovery behavior.
- [ ] Build/install the fixture in a temporary directory and assert bundle output and server results.
- [ ] Add three-browser Playwright checks against the installed local candidate.
- [ ] Document exact commands, bundle observations, error recovery, and the no-source-alias rule.
- [ ] Run unit tests, local candidate smoke, and browser smoke; attempt exact beta.4 registry smoke and report network failures separately.

### Task 4: Preserve and design router-aware SSR/hydration

**Files:** `docs/superpowers/specs/2026-08-14-router-aware-ssr-hydration-design.md`, `tests/unit/docs/public-contract-docs.test.ts`, `docs/api.md`, `docs/api.zh-CN.md`, `docs/roadmap.md`

- [ ] Write the future API/data-flow design around memory history, canonical route snapshots, server context, and hydration verification.
- [ ] Explicitly exclude auth, permissions, streaming, Suspense, route crawling, and filesystem output.
- [ ] Add documentation contract assertions that current `router` options remain rejected by SSR, SSG, and hydration.
- [ ] Run documentation and existing server/router rejection tests.

### Task 5: Add executable 1.0 admission checks

**Files:** `release/one-zero-readiness.json`, `scripts/one-zero-readiness-config.mjs`, `scripts/one-zero-readiness.mjs`, `tests/unit/scripts/one-zero-readiness.test.ts`, `package.json`, `docs/roadmap.md`, `docs/release.md`, `docs/ecosystem.md`, `docs/ecosystem.zh-CN.md`

- [ ] Add failing pure tests for two independent apps, dual upgrade baselines, benchmark windows, DevTools permissions, and migration policy.
- [ ] Implement one-pass readiness evaluation with stable criterion IDs and actionable failure messages.
- [ ] Add a beta evidence file that truthfully remains not ready where evidence is missing.
- [ ] Add `pnpm release:one-zero:check`; exit nonzero until every requirement is satisfied, with a documentation mode that prints current gaps.
- [ ] Document that UI libraries and plugin marketplaces remain outside the 1.0 gate.
- [ ] Run focused tests and assert the current evidence reports expected gaps.

### Task 6: Final candidate verification

**Files:** all changed files

- [ ] Run `pnpm format` on changed documentation and source files.
- [ ] Run `pnpm release:check` and capture fresh counts and coverage.
- [ ] Run `pnpm stable:app:upgrade` for beta.2 and beta.4 when npm registry access is available.
- [ ] Run `pnpm registry:smoke -- 0.1.0-beta.4` and record network failures separately.
- [ ] Run `git diff --check`, inspect generated output changes, and keep the worktree free of unrelated artifacts.
- [ ] Do not publish, push, or create a tag without a separate maintainer instruction.
