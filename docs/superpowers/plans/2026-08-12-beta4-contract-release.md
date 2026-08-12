# Beta.4 Contract Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Freeze the current Solace runtime contract, prepare `@italone/solace@0.1.0-beta.4`, verify compatibility against the exact published beta.2 package, and publish beta.4 without widening runtime scope.

**Architecture:** Keep runtime source untouched. Make the release surface self-consistent through the repository's established explicit prerelease version/CHANGELOG workflow, package scripts, release tests, release notes, README/status synchronization, and registry-backed consumer checks. Keep the network-backed upgrade test as an explicit release-candidate step rather than a default PR requirement.

**Tech Stack:** pnpm 10, TypeScript, Vitest, Playwright, Rollup, Vite, Changesets, npm registry, Git tags.

---

### Task 1: Establish the beta.4 release baseline

**Files:**

- Modify: `package.json:3`
- Modify: `CHANGELOG.md:1`
- Inspect: `.changeset/config.json`, `git status --short --branch`, `git rev-list --left-right --count origin/main...HEAD`

- [ ] **Step 1: Confirm the frozen source boundary**

Run:

```bash
git status --short --branch
git diff --name-only 4c4a805..HEAD
```

Expected: only release design/plan files are present after `4c4a805`, the commit that completed the current async contract; no runtime implementation change is introduced during beta.4 preparation.

- [ ] **Step 2: Add the explicit beta.4 version and CHANGELOG entry**

Change `package.json` from `0.1.0-beta.2` to `0.1.0-beta.4`. Add a `0.1.0-beta.4` Patch Changes section at the top of `CHANGELOG.md` stating that the release freezes and publishes buffered async SSR, sequential async SSG, prepare-then-commit async hydration, the eight-entry compatibility policy, and the Operations Console upgrade evidence. Explicitly keep streaming and router-aware SSR/hydration deferred.

Do not run `pnpm release:version`: the repository has no `.changeset/pre.json`, and its previous beta.0/beta.1/beta.2 preparation commits used an explicit prerelease version plus CHANGELOG entry to preserve the intended prerelease number.

- [ ] **Step 3: Verify the explicit version and CHANGELOG metadata**

Run:

```bash
git status --short
git diff --check
```

Expected: only `package.json` and `CHANGELOG.md` are modified, with no generated `dist`, coverage, benchmark-history, or unrelated source changes.

- [ ] **Step 4: Commit the release metadata**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: prepare beta.4 release metadata"
```

### Task 2: Harden the release-candidate compatibility gate

**Files:**

- Modify: `package.json:84-94` if the candidate-only upgrade command needs a stable script alias
- Modify: `scripts/operations-console-smoke.mjs` only if an existing failure in exact beta.2 comparison requires a release-process fix
- Modify: `tests/unit/scripts/operations-console-smoke.test.ts` for any changed command contract
- Modify: `tests/unit/scripts/release-readiness-check.test.ts` if release command ordering or public gates change
- Modify: `docs/release.md:39-47` to match the final command sequence

- [ ] **Step 1: Run the exact published baseline smoke before changing scripts**

```bash
pnpm stable:app:upgrade
```

Expected: npm installs `@italone/solace@0.1.0-beta.2`, the baseline consumer builds, the local packed candidate builds, and the Operations Console comparison passes. A registry/network error is an environmental failure and must be retried with approved network access.

- [ ] **Step 2: Add the upgrade gate to the release-candidate command path**

Keep ordinary `pnpm release:check` deterministic and local. Add a dedicated candidate script, for example `release:candidate:check`, whose exact order is:

```text
pnpm release:readiness -- --publishable
pnpm stable:app:upgrade
pnpm release:check
```

Do not add npm-network access to pull-request CI unless the repository explicitly chooses that policy later.

- [ ] **Step 3: Add a failing test for command presence and ordering**

Extend `tests/unit/scripts/release-readiness-check.test.ts` or the existing package-script contract test to assert that the candidate command includes `pnpm stable:app:upgrade` before `pnpm release:check`, while the normal release check still contains package smoke, stable app, browser E2E, and DevTools E2E.

- [ ] **Step 4: Run focused script tests**

```bash
pnpm exec vitest run tests/unit/scripts/release-readiness-check.test.ts tests/unit/scripts/operations-console-smoke.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the release-gate change**

```bash
git add package.json scripts/operations-console-smoke.mjs tests/unit/scripts/operations-console-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts docs/release.md
git commit -m "chore: add beta.4 candidate compatibility gate"
```

Only stage files actually modified in this task.

### Task 3: Apply the beta.4 version and synchronize public documentation

**Files:**

- Modify: `package.json:3`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `README.md`
- Modify: `readme.zh-CN.md`
- Modify: `docs/release.md`
- Modify: `docs/api.md` and `docs/api.zh-CN.md` only where the beta.4 compatibility wording is stale
- Modify: `tests/unit/docs/public-contract-docs.test.ts` and `tests/unit/docs/release-docs.test.ts` for synchronized exact assertions

- [ ] **Step 1: Verify explicit beta.4 version metadata**

```bash
node -p "require('./package.json').version"
sed -n '1,14p' CHANGELOG.md
```

Expected: the package version is `0.1.0-beta.4`, the first changelog section is beta.4, and no runtime source changes occur.

- [ ] **Step 2: Replace stale beta labels and metrics**

Update English and Chinese public docs so they consistently state:

```text
repository/package candidate: 0.1.0-beta.4
published npm baseline: 0.1.0-beta.2
target dist-tag: beta
latest remains: 0.0.5
```

Keep the existing deferred list unchanged except for version wording. Do not claim beta.4 is published until the registry step succeeds.

- [ ] **Step 3: Update documentation contract tests**

Change exact version/count assertions only where the release metadata requires it. Preserve assertions for the eight protected entries, deferred streaming/router/auth boundaries, and the release checklist.

- [ ] **Step 4: Run documentation and package metadata checks**

```bash
pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts
pnpm format:check
pnpm release:readiness
```

Expected: all pass; no claim of publication is present before npm publication.

- [ ] **Step 5: Commit the beta.4 metadata update**

```bash
git add package.json README.md readme.zh-CN.md docs/api.md docs/api.zh-CN.md docs/project-status.md docs/project-status.zh-CN.md docs/release.md tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts CHANGELOG.md
git commit -m "chore: prepare solace beta.4 metadata"
```

`CHANGELOG.md` was committed in Task 1; stage it here only if documentation synchronization required a correction.

- [ ] **Step 6: Push the reviewed beta.4 candidate commits**

```bash
git push origin main
```

Expected: the release-design, plan, candidate-gate, version, CHANGELOG, and synchronized documentation commits are available on `origin/main`. Publishing is still forbidden until Task 4 passes and the maintainer explicitly confirms Task 5.

### Task 4: Run the complete prepublish evidence set

**Files:**

- No source edits expected
- Inspect generated outputs with `git status --short` after each build-heavy command

- [ ] **Step 1: Verify publishable Git state**

```bash
git fetch origin main
git status --short --branch
git rev-list --left-right --count origin/main...HEAD
pnpm release:readiness -- --publishable
```

Expected: clean worktree, synchronized branch, publishable package version, and public Changesets access configuration.

- [ ] **Step 2: Run the exact beta.2 upgrade smoke**

```bash
pnpm stable:app:upgrade
```

Expected: baseline npm beta.2 and local beta.4 packed candidate both build the Operations Console successfully.

- [ ] **Step 3: Run the full release gate**

```bash
pnpm release:check
```

Expected: format, build, typecheck, JSX-dev typecheck, lint, existing Vitest suite, package exports, coverage thresholds, packed consumer, Operations Console, jsdom benchmark, browser benchmark, browser E2E, and DevTools E2E pass.

- [ ] **Step 4: Inspect the final tarball**

```bash
npm pack --dry-run --json
```

Expected: only intended `dist`, public docs, README, license, and package metadata are included; no source maps or local benchmark artifacts are unexpectedly packed.

- [ ] **Step 5: Record prepublish evidence without publishing yet**

Save command output or a concise release log under the repository's existing release-log convention. Do not modify runtime code to repair a failed check; stop and report the first actionable failure.

### Task 5: Publish beta.4 and verify the registry contract

**Files:**

- Modify: `solace-project-log/index.md` and add a dated entry under `solace-project-log/solace-entries/` after successful publication
- No runtime source edits

- [ ] **Step 1: Obtain explicit maintainer confirmation for npm publication**

Confirm npm authentication, organization access, public access, and the intended `beta` dist-tag. Do not print or persist credentials or OTP values.

- [ ] **Step 2: Publish using the guarded project command**

```bash
pnpm release:publish:beta
```

Expected: the command reruns its release gate and publishes `0.1.0-beta.4` with `beta`; abort on any failure.

- [ ] **Step 3: Verify npm registry state**

```bash
npm view @italone/solace dist-tags --json
npm view @italone/solace@0.1.0-beta.4 version
```

Expected: `beta` is `0.1.0-beta.4`, `latest` remains `0.0.5`, and the exact version resolves.

- [ ] **Step 4: Run post-publish consumer smoke from npm**

Run the registry smoke using `@italone/solace@beta` and verify package root, all protected public subpaths, server-side paragraph rendering, and private deep-subpath blocking.

- [ ] **Step 5: Verify and push the tag created by Changesets publish**

```bash
git show -s --format='%H %D' v0.1.0-beta.4
git push origin main v0.1.0-beta.4
```

Expected: `changeset publish` created `v0.1.0-beta.4`; the remote branch contains the release commit and the tag points to that same commit. Do not create or move a tag manually if the publish command did not complete.

- [ ] **Step 6: Record and verify the final clean state**

Update the release log with the exact commands/results, then run:

```bash
git status --short --branch
git rev-list --left-right --count origin/main...HEAD
git show -s --format='%H %D' v0.1.0-beta.4
```

Expected: clean worktree, `0 0` branch divergence, and the beta.4 tag resolves to the pushed release commit.

### Task 6: Final release review

- [ ] **Step 1: Check the frozen-scope diff**

```bash
git diff 4c4a805..HEAD --name-only
```

Expected: only approved release metadata, scripts/tests/docs, release logs, and version files are present; no runtime feature files changed after the frozen `4c4a805` contract baseline.

- [ ] **Step 2: Verify all acceptance criteria from the design**

Check npm dist-tags, package version, docs language, public entry smoke, release tag, clean worktree, and recorded evidence. Report any skipped remote check explicitly.

- [ ] **Step 3: Commit release evidence**

```bash
git add solace-project-log/index.md solace-project-log/solace-entries/2026-08-12-001-beta-4-npm-publication.md
git commit -m "docs: record beta.4 publication"
git push origin main
```

The final evidence commit must not alter the already published package contents; if the project requires the release commit and log entry to be identical, record the log before tagging instead.
