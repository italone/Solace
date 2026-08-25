# DevTools Packaging Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the real origin-scoped DevTools ZIP packaging path in routine CI and `release:check` while preventing the reserved smoke origin from satisfying production evidence.

**Architecture:** Reuse `scripts/devtools-extension-package.mjs` as the only packaging implementation and expose one fixed smoke command through `package.json`. Add the command to local and CI gates, while hardening the existing 1.0 evaluator so `.invalid` origins remain categorically non-production. Keep generated ZIP and sidecar output ignored and outside checked-in release evidence.

**Tech Stack:** Node.js ESM, pnpm 10, TypeScript, Vitest, Vite, GitHub Actions YAML, Markdown contract tests.

---

## File Map

- `scripts/one-zero-readiness-config.mjs`: reject `.invalid` hostnames from production DevTools evidence.
- `tests/unit/scripts/one-zero-readiness.test.ts`: prove an otherwise complete DevTools record fails with the smoke origin.
- `package.json`: define `package:devtools-extension:smoke` and add it to `release:check`.
- `scripts/release-readiness-check.mjs`: require the smoke script, release-check segment, and ignored artifact directory.
- `tests/unit/scripts/release-readiness-check.test.ts`: lock the smoke command and release gate ordering.
- `.github/workflows/ci.yml`: run the real smoke before Playwright installation in the browser job.
- `tests/unit/ci-workflow.test.ts`: lock CI placement and retain the local/CI evidence boundary.
- `docs/devtools.md`: document the smoke command and explain why `.invalid` is not production evidence.
- `docs/release.md`: document the mandatory local/CI packaging smoke without promoting its artifact.
- `tests/unit/devtools/devtools-docs.test.ts`: lock DevTools documentation wording.
- `tests/unit/docs/release-docs.test.ts`: lock release documentation wording.

### Task 1: Reject The Reserved Smoke Origin From 1.0 Evidence

**Files:**

- Modify: `tests/unit/scripts/one-zero-readiness.test.ts:482`
- Modify: `scripts/one-zero-readiness-config.mjs:239`

- [x] **Step 1: Write the failing reserved-origin test**

Add this test after the existing exact-HTTPS-origin test:

```ts
it("rejects reserved .invalid DevTools smoke origins", () => {
  const evidence = readyEvidence();
  const smokeOrigin = "https://devtools-smoke.invalid";
  evidence.devtools.testedOrigins = [smokeOrigin];
  evidence.devtools.evidenceRecord!.testedOrigins = [smokeOrigin];
  evidence.devtools.evidenceRecord!.artifactEvidence.origins = [smokeOrigin];

  const criterion = evaluateOneZeroReadiness(evidence).criteria[3];

  expect(criterion).toMatchObject({ id: "devtools.production-permissions", passed: false });
});
```

- [x] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts
```

Expected: FAIL because `https://devtools-smoke.invalid` currently satisfies `isExactHttpsOrigin()` and the criterion is `passed: true`.

- [x] **Step 3: Implement the minimum production-origin guard**

Update `isExactHttpsOrigin()` without changing the packaging parser:

```js
function isExactHttpsOrigin(value) {
  if (typeof value !== "string" || value.includes("*")) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.origin === value &&
      hostname !== "invalid" &&
      !hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}
```

- [x] **Step 4: Run the test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts
```

Expected: PASS with the reserved origin rejected and existing exact HTTPS fixtures still accepted.

- [x] **Step 5: Commit the evidence guard**

```bash
git add scripts/one-zero-readiness-config.mjs tests/unit/scripts/one-zero-readiness.test.ts
git commit -m "test: reject DevTools smoke origins as production evidence"
```

### Task 2: Add The Local Packaging Smoke Release Gate

**Files:**

- Modify: `tests/unit/scripts/release-readiness-check.test.ts:13,99`
- Modify: `package.json:68,102`
- Modify: `scripts/release-readiness-check.mjs:32-54,110`

- [x] **Step 1: Write failing release-gate assertions**

Update the reported gate assertion to include the named smoke:

```ts
expect(stdout).toContain(
  "public API gates: pnpm release:readiness, pnpm release:contract:check, pnpm package:smoke, pnpm adoption:smoke, pnpm stable:app, pnpm package:devtools-extension:smoke, pnpm performance:regression, pnpm test:e2e, pnpm test:e2e:devtools-extension",
);
```

In the release-check ordering test, add the exact script assertion:

```ts
expect(packageJson.scripts?.["package:devtools-extension:smoke"]).toBe(
  "pnpm package:devtools-extension -- --origin https://devtools-smoke.invalid --output .devtools-artifacts/solace-devtools-smoke.zip",
);
```

Insert this segment immediately after `pnpm stable:app` in the expected array:

```ts
"pnpm package:devtools-extension:smoke",
```

- [x] **Step 2: Run the release-readiness test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/release-readiness-check.test.ts
```

Expected: FAIL because the smoke script and release-check segment do not exist.

- [x] **Step 3: Add the package script and release-check segment**

Add next to `package:devtools-extension` in `package.json`:

```json
"package:devtools-extension:smoke": "pnpm package:devtools-extension -- --origin https://devtools-smoke.invalid --output .devtools-artifacts/solace-devtools-smoke.zip",
```

Insert the named smoke after `pnpm stable:app` in `release:check`:

```json
"release:check": "pnpm release:readiness && pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm adoption:smoke && pnpm stable:app && pnpm package:devtools-extension:smoke && pnpm benchmark && pnpm benchmark:browser && pnpm performance:regression && pnpm test:e2e && pnpm test:e2e:devtools-extension"
```

- [x] **Step 4: Make release readiness enforce the gate**

Add the script, command, and ignored-output requirements:

```js
requireScript("package:devtools-extension:smoke");
requireReleaseCheckCommand("pnpm package:devtools-extension:smoke");
requireGitignorePattern(".devtools-artifacts/");
```

Update the success diagnostic to the exact string asserted in Step 1.

- [x] **Step 5: Run focused checks and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/release-readiness-check.test.ts
pnpm release:readiness
```

Expected: both commands pass; readiness reports `pnpm package:devtools-extension:smoke` among mandatory gates.

- [x] **Step 6: Exercise the real package build**

Run:

```bash
pnpm package:devtools-extension:smoke
```

Expected: Vite build passes and the command prints the ZIP path, SHA-256, evidence sidecar path, and `https://devtools-smoke.invalid`.

Verify the ignored sidecar without promoting it:

```bash
node -e 'const fs=require("node:fs"); const p=".devtools-artifacts/solace-devtools-smoke.evidence.json"; const e=JSON.parse(fs.readFileSync(p,"utf8")); if(e.artifactPath!==".devtools-artifacts/solace-devtools-smoke.zip"||e.origins?.[0]!=="https://devtools-smoke.invalid"||!/^[a-f0-9]{64}$/.test(e.sha256)||!/^[a-f0-9]{64}$/.test(e.manifestSha256)) process.exit(1); console.log("DevTools smoke evidence verified")'
```

Expected: `DevTools smoke evidence verified`.

- [x] **Step 7: Commit the local gate**

```bash
git add package.json scripts/release-readiness-check.mjs tests/unit/scripts/release-readiness-check.test.ts
git commit -m "chore: gate DevTools distribution packaging"
```

### Task 3: Run The Smoke In CI And Document Its Boundary

**Files:**

- Modify: `tests/unit/ci-workflow.test.ts:13`
- Modify: `tests/unit/devtools/devtools-docs.test.ts:41`
- Modify: `tests/unit/docs/release-docs.test.ts:36`
- Modify: `.github/workflows/ci.yml:101`
- Modify: `docs/devtools.md:157`
- Modify: `docs/release.md:159`

- [x] **Step 1: Write the failing CI placement assertion**

Slice the browser job and assert the smoke is between build and Playwright installation:

```ts
const browserJob = workflow.slice(
  workflow.indexOf("  browser:"),
  workflow.indexOf("  performance-comparison:"),
);
const packageBuild = browserJob.indexOf("run: pnpm build");
const devtoolsPackageSmoke = browserJob.indexOf("run: pnpm package:devtools-extension:smoke");
const installBrowsers = browserJob.indexOf(
  "run: pnpm exec playwright install --with-deps chromium firefox webkit",
);

expect(devtoolsPackageSmoke).toBeGreaterThan(packageBuild);
expect(installBrowsers).toBeGreaterThan(devtoolsPackageSmoke);
```

- [x] **Step 2: Write failing documentation assertions**

Add to the DevTools packaging documentation test:

```ts
expect(docs).toContain("pnpm package:devtools-extension:smoke");
expect(docs).toContain("https://devtools-smoke.invalid");
expect(docs).toContain("never counts as a tested production origin");
```

Add to the release DevTools notes test:

```ts
expect(release).toContain("pnpm package:devtools-extension:smoke");
expect(release).toContain("does not satisfy production DevTools distribution evidence");
```

- [x] **Step 3: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/ci-workflow.test.ts tests/unit/devtools/devtools-docs.test.ts tests/unit/docs/release-docs.test.ts
```

Expected: FAIL for the missing workflow step and missing documentation wording.

- [x] **Step 4: Add the browser-job smoke step**

Insert after the browser job's ordinary `Build` step:

```yaml
- name: Package DevTools extension smoke
  run: pnpm package:devtools-extension:smoke
```

Do not upload `.devtools-artifacts/` and do not remove the existing DevTools E2E step.

- [x] **Step 5: Document the local smoke boundary**

Add after the build/E2E command block in `docs/devtools.md`:

```md
`pnpm package:devtools-extension:smoke` runs the real distributable build with the reserved
`https://devtools-smoke.invalid` origin and writes an ignored ZIP plus evidence sidecar. It verifies
packaging and manifest permission consistency only. The `.invalid` origin never counts as a tested
production origin and the smoke output must not be copied into checked-in release evidence.
```

Add under `## DevTools Extension Notes` in `docs/release.md`:

```md
Routine browser CI and `pnpm release:check` run `pnpm package:devtools-extension:smoke` before browser
tests. This validates the real ZIP and manifest-generation path, but the reserved `.invalid` origin
and ignored artifact do not satisfy production DevTools distribution evidence.
```

- [x] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/ci-workflow.test.ts tests/unit/devtools/devtools-docs.test.ts tests/unit/docs/release-docs.test.ts
```

Expected: all focused workflow and documentation tests pass.

- [x] **Step 7: Format and commit CI/documentation integration**

Run:

```bash
pnpm prettier --check .github/workflows/ci.yml docs/devtools.md docs/release.md tests/unit/ci-workflow.test.ts tests/unit/devtools/devtools-docs.test.ts tests/unit/docs/release-docs.test.ts
git diff --check
```

Expected: both commands pass.

Commit:

```bash
git add .github/workflows/ci.yml docs/devtools.md docs/release.md tests/unit/ci-workflow.test.ts tests/unit/devtools/devtools-docs.test.ts tests/unit/docs/release-docs.test.ts
git commit -m "ci: smoke test DevTools distribution packaging"
```

### Task 4: Verify The Complete Gate And Evidence Integrity

**Files:**

- Verify only; no production evidence files should change.

- [x] **Step 1: Run all focused contract tests**

```bash
pnpm exec vitest run tests/unit/scripts/one-zero-readiness.test.ts tests/unit/scripts/release-readiness-check.test.ts tests/unit/ci-workflow.test.ts tests/unit/devtools/devtools-docs.test.ts tests/unit/docs/release-docs.test.ts tests/unit/scripts/devtools-extension-package.test.ts
```

Expected: all selected test files pass.

- [x] **Step 2: Run static and full unit validation**

```bash
pnpm format:check
pnpm typecheck
pnpm test
git diff --check
```

Expected: all commands exit zero with no formatting, type, test, or whitespace failures.

- [x] **Step 3: Run the full local release gate**

```bash
pnpm release:check
```

Expected: the real DevTools packaging smoke runs and the complete existing release gate passes,
including coverage, package/adoption/stable smoke, benchmarks, local performance regression, browser
E2E, and DevTools extension E2E.

- [x] **Step 4: Confirm production evidence did not change**

```bash
git diff --exit-code f6d7809 -- release/devtools-distribution-evidence.json release/one-zero-readiness.json
pnpm release:one-zero:check -- --report
```

Expected: the diff command prints nothing and exits zero. The report remains `INCOMPLETE` with
`devtools.production-permissions` still failing, alongside the independent-adoption, five-date
performance-history, and stable-contract gaps.

- [x] **Step 5: Inspect the final repository state**

```bash
git status --short --branch
git log -5 --oneline --decorate
```

Expected: only ignored `.devtools-artifacts/` output exists outside Git status; tracked work is clean.
Do not publish npm, create a Git tag, or push until explicitly authorized.
