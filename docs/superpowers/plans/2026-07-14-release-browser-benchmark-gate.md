# Release Browser Benchmark Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include the Chromium production browser benchmark in Solace's release gate.

**Architecture:** Reuse the existing `benchmark:browser` script and insert it into `release:check` after jsdom benchmarks and before ordinary e2e tests. Extend the release readiness script so it validates that the release gate includes `pnpm benchmark:browser`.

**Tech Stack:** pnpm package scripts, Node.js ESM release readiness CLI, Playwright benchmark config, Markdown docs, Prettier.

---

## File Structure

- Modify `package.json`: add `pnpm benchmark:browser` to `release:check`.
- Modify `scripts/release-readiness-check.mjs`: validate that `release:check` includes `pnpm benchmark:browser`.
- Modify `docs/release.md`: update release gate description.
- Modify `readme.md`: update release check capability wording.
- Add `solace-project-log/solace-entries/2026-07-14-004-release-browser-benchmark-gate.md`: project log entry.
- Modify `solace-project-log/index.md`: add the 2026-07-14 `004` row.

No runtime source, benchmark scenario, package export, or publishability state should change.

---

### Task 1: Update Release Gate Script

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add browser benchmark to release:check**

In `package.json`, replace:

```json
"release:check": "pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm benchmark && pnpm test:e2e",
```

with:

```json
"release:check": "pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm benchmark && pnpm benchmark:browser && pnpm test:e2e",
```

---

### Task 2: Update Release Readiness Check

**Files:**

- Modify: `scripts/release-readiness-check.mjs`

- [ ] **Step 1: Add script coverage validation**

After `requireScript("release:publish");`, add:

```js
requireReleaseCheckCommand("pnpm benchmark:browser");
```

Add this helper after `requireScript`:

```js
function requireReleaseCheckCommand(command) {
  const releaseCheck = packageJson.scripts?.["release:check"];

  if (typeof releaseCheck !== "string" || !releaseCheck.includes(command)) {
    failures.push(`package.json release:check must include "${command}".`);
  }
}
```

- [ ] **Step 2: Run readiness check**

Run:

```bash
pnpm release:readiness
```

Expected: exits with code 0.

---

### Task 3: Update Documentation And Log

**Files:**

- Modify: `docs/release.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-14-004-release-browser-benchmark-gate.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update release docs**

In `docs/release.md`, update the Local Release Gate description so it includes browser production benchmark:

```md
This runs format check, typecheck, JSX dev typecheck, lint, default tests, package exports tests, coverage thresholds, package consumer smoke, jsdom benchmark smoke, Chromium production browser benchmark, and browser e2e tests.
```

- [ ] **Step 2: Update README current capability**

In `readme.md`, update the release gate bullet to include browser production benchmark:

```md
- 发布门禁：`pnpm release:check`、format check、coverage thresholds、package consumer smoke、jsdom benchmark smoke、Chromium production browser benchmark、Changesets versioning。
```

- [ ] **Step 3: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-14-004-release-browser-benchmark-gate.md` with status `验证中`, affected files, and pending validation rows.

- [ ] **Step 4: Add project log index row**

Add a 2026-07-14 `004` row for release browser benchmark gate.

---

### Task 4: Format And Validate

**Files:**

- All touched files.

- [ ] **Step 1: Format touched files**

Run:

```bash
pnpm exec prettier --write package.json scripts/release-readiness-check.mjs docs/release.md readme.md docs/superpowers/specs/2026-07-14-release-browser-benchmark-gate-design.md docs/superpowers/plans/2026-07-14-release-browser-benchmark-gate.md solace-project-log/solace-entries/2026-07-14-004-release-browser-benchmark-gate.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run readiness check**

Run:

```bash
pnpm release:readiness
```

Expected: exits with code 0.

- [ ] **Step 3: Run browser benchmark**

Run:

```bash
pnpm benchmark:browser
```

Expected: exits with code 0 and logs `browser benchmark summary`.

- [ ] **Step 4: Run release check**

Run:

```bash
pnpm release:check
```

Expected: exits with code 0.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Confirm private state**

Run:

```bash
node -e "const pkg = require('./package.json'); if (pkg.private !== true) process.exit(1); console.log('private remains true')"
```

Expected: exits with code 0.

- [ ] **Step 9: Update project log validation table**

Set log status to `已完成` and replace pending validation rows with observed results.

- [ ] **Step 10: Run final format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.
