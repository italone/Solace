# Solace Beta 3 Contract, Compatibility, and Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the beta.2 release record and harden the next beta line's runtime contract, CI compatibility matrix, and quality baseline without publishing or changing the package version.

**Architecture:** Preserve the existing public API and deferred-boundary errors. Add local unknown-own-field validation at each SSR, hydration, and SSG boundary so typos fail at runtime while existing TypeScript excess-property checks remain intact. Keep core DevTools extension tests Chromium-only while expanding ordinary application E2E coverage across supported Playwright browsers.

**Tech Stack:** TypeScript, Vitest, Playwright, GitHub Actions, pnpm, Markdown.

---

### Task 1: Correct beta.2 release-state documentation

**Files:**

- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`

- [ ] Replace the beta.2 statements that say the remote tag push failed with the verified state that `v0.1.0-beta.2` exists on the remote and points to the beta.2 release commit.
- [ ] Keep the instruction to recheck Git and npm state before future releases; do not change package versions or publish commands.
- [ ] Run `pnpm format:check` and `git diff --check`.

### Task 2: Reject unknown SSR and hydration fields at runtime

**Files:**

- Modify: `src/renderer/renderer.ts`
- Modify: `src/server/render-to-string.ts`
- Modify: `src/server/generate-static-site.ts`
- Test: `tests/unit/renderer/hydration.test.ts`
- Test: `tests/unit/server/render-to-string.test.ts`
- Test: `tests/unit/server/generate-static-site.test.ts`
- Test: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `README.md`
- Modify: `readme.zh-CN.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Test: `tests/unit/docs/public-contract-docs.test.ts`

- [ ] Add one failing runtime assertion per boundary: `{ recvoer: true }` for hydration, `{ contex: {} }` for SSR, `{ shel: fn }` for SSG, and `{ provdies: new Map() }` on an SSG route.
- [ ] Run the affected Vitest files and confirm each new assertion fails because the unknown field is currently ignored.
- [ ] Preserve existing deferred-field checks before generic unknown-field checks, then throw `TypeError` messages naming the boundary and field.
- [ ] Run the focused tests, package-export tests, and packed consumer smoke.
- [ ] Document that only the declared fields are accepted and unknown own fields throw at runtime in English and Chinese public docs.

### Task 3: Expand CI and ordinary browser E2E compatibility

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts`

- [ ] Convert the CI Node setup to a matrix for Node 20 and Node 22 while retaining pnpm 10.33.4 and frozen-lockfile installation.
- [ ] Add Firefox and WebKit projects to ordinary `playwright.config.ts`; leave the DevTools extension configuration Chromium-only.
- [ ] Install Chromium, Firefox, and WebKit in the CI browser setup step.
- [ ] Run the local Chromium E2E smoke and Playwright configuration checks; report Firefox/WebKit execution separately if browsers are unavailable locally.

### Task 4: Raise coverage floors and add failure-path tests

**Files:**

- Modify: `vitest.config.ts`
- Test: `tests/unit/renderer/hydration.test.ts`
- Test: `tests/unit/router/history.test.ts`
- Test: `tests/unit/component/lifecycle.test.ts`

- [ ] Add focused tests for hydration extra-node or missing-node recovery, history listener/navigation failure cleanup, and lifecycle calls outside active setup.
- [ ] Run the affected tests and confirm the new failure-path behavior.
- [ ] Raise global coverage thresholds to 85% branches and 90% functions.
- [ ] Run `pnpm test:coverage` and inspect the per-file report for regressions.

### Task 5: Prepare the beta.4 vertical-slice decision

**Files:**

- Create: `docs/superpowers/specs/2026-08-11-async-ssr-hydration-boundary-design.md`
- Review: `docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md`
- Review: `docs/devtools.md`

- [ ] Compare async SSR/hydration and production DevTools distribution by public value, API blast radius, test cost, and deferred-boundary risk.
- [ ] Recommend one vertical slice and explicitly keep SFC syntax, router auth/permissions, and UI library work out of scope.
- [ ] Do not implement the selected slice until its design is reviewed separately.

### Task 6: Define stable-release adoption evidence

**Files:**

- Modify: `docs/large-app.md`
- Modify: `docs/large-app.zh-CN.md`
- Modify: `docs/release.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`

- [ ] Define the minimum real-application evidence for upgrade, routing, error recovery, SSR/SSG, and packed package consumption.
- [ ] Define documented public-entry compatibility and deprecation rules before the 0.1 stable decision.
- [ ] Keep the application fixture or external app choice explicit; do not invent production evidence from repository examples.
