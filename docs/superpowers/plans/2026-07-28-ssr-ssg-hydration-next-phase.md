# SSR/SSG/Hydration Next Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the next SSR/SSG/hydration phase while keeping SFC/Vite and router API surfaces narrow.

**Architecture:** Treat the current 18 local commits as the working release baseline until GitHub push succeeds. Keep SFC/Vite and router changes in contract tests and docs first. Extend SSR/SSG/hydration only after diagnostics and shell boundaries are tested.

**Tech Stack:** TypeScript, Vite, Rollup, Vitest, Playwright, pnpm, Solace runtime/server APIs.

---

## File Structure

- Modify `docs/project-status.md`: release baseline, next work, and hard gates.
- Modify `docs/project-status.zh-CN.md`: Chinese mirror of the release baseline and next work.
- Modify `docs/roadmap.md`: sequencing for SFC/Vite, router beta, SSR/SSG/hydration, and DevTools UI.
- Create `docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md`: design boundary.
- Modify `tests/unit/renderer/hydration.test.ts`: future mismatch diagnostics tests.
- Modify `tests/unit/server/generate-static-site.test.ts`: future SSG shell/style preservation tests.
- Modify `tests/unit/vite/solace-plugin.test.ts`: future SFC/Vite no-syntax-expansion tests.
- Modify `tests/unit/router/*.test.ts`: future router beta boundary tests only when a current beta behavior regresses.

### Task 1: Release Baseline And Roadmap Documentation

**Files:**

- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/roadmap.md`
- Create: `docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md`

- [ ] **Step 1: Confirm local/remote state**

Run:

```bash
git fetch origin main
git status --short --branch
git rev-list --left-right --count origin/main...HEAD
```

Expected:

```text
## main...origin/main [ahead 18]
0	18
```

- [ ] **Step 2: Record baseline**

Update project status to say that `git push origin main` failed because the environment could not
connect to `github.com:443`, and the 18 local commits are the current working release baseline until
push succeeds.

- [ ] **Step 3: Update sequencing**

Update roadmap ordering so it says:

- SFC/Vite stabilization continues without syntax expansion.
- Router beta stabilization continues without nested routes or guards.
- SSR/SSG/hydration next-phase design and hardening comes before DevTools extension UI.
- `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e` stay mandatory for public API changes.

- [ ] **Step 4: Format docs**

Run:

```bash
pnpm exec prettier --write docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md
```

Expected: all files are formatted without errors.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md docs/superpowers/specs/2026-07-28-ssr-ssg-hydration-next-phase-design.md
git commit -m "docs: define ssr ssg hydration next phase"
```

Expected: one documentation commit.

### Task 2: Hydration Mismatch Diagnostics

**Files:**

- Modify: `tests/unit/renderer/hydration.test.ts`
- Modify: `src/renderer/hydration.ts`

- [ ] **Step 1: Write failing diagnostics tests**

Add tests that assert hydration mismatch errors include:

- Expected node/tag.
- Actual DOM node/tag.
- A path or location hint.

Example assertion shape:

```ts
expect(() => hydrate(h("section"), container)).toThrow(/expected.*section/i);
expect(() => hydrate(h("section"), container)).toThrow(/actual.*div/i);
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/renderer/hydration.test.ts
```

Expected: new diagnostics tests fail before implementation.

- [ ] **Step 3: Implement diagnostic enrichment**

Keep throw-on-mismatch behavior. Add diagnostic message fields without adding recovery or DOM
replacement.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm vitest run tests/unit/renderer/hydration.test.ts tests/integration/ssr-hydration.test.ts
pnpm quality
```

Expected: all focused and quality checks pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/unit/renderer/hydration.test.ts src/renderer/hydration.ts
git commit -m "fix: clarify hydration mismatch diagnostics"
```

Expected: one focused diagnostics commit.

### Task 3: SSG Shell And Style Preservation Contract

**Files:**

- Modify: `tests/unit/server/generate-static-site.test.ts`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`

- [ ] **Step 1: Add shell preservation tests**

Add a unit test that uses a component with `useStyle()` and asserts `generateStaticSite()` passes
serialized style tags to `shell` unchanged.

Expected style shape:

```ts
['<style data-s-id="page">.page { color: blue; }</style>'];
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/server/generate-static-site.test.ts tests/unit/style/runtime-style.test.ts
```

Expected: tests pass after the current style collection implementation is exercised.

- [ ] **Step 3: Document shell placement**

Document `styles.join("")` placement in `<head>` and keep filesystem output and manifest injection
deferred.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md
pnpm quality
pnpm package:smoke
```

Expected: docs format, quality, and packed consumer smoke pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/unit/server/generate-static-site.test.ts docs/api.md docs/api.zh-CN.md docs/package-usage.md
git commit -m "test: preserve ssg shell styles"
```

Expected: one focused SSG contract commit.

### Task 4: SFC/Vite And Router Boundary Regression Tests

**Files:**

- Modify: `tests/unit/vite/solace-plugin.test.ts`
- Modify: `tests/unit/compiler/parse.test.ts`
- Modify: `tests/unit/router/router.test.ts`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`

- [ ] **Step 1: Add SFC no-expansion assertions**

Add tests that assert unsupported extra `.solace` blocks still fail through Vite transform
diagnostics, and generated scoped style output still routes through `useStyle()`.

- [ ] **Step 2: Add router boundary assertions**

Add tests only for current beta behavior. Do not add nested routes, guards, redirects, lazy route
components, scroll behavior, memory history, auth, or permissions.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/vite/solace-plugin.test.ts tests/unit/compiler/parse.test.ts tests/unit/router/router.test.ts
```

Expected: focused tests pass.

- [ ] **Step 4: Verify public API gates**

Run:

```bash
pnpm release:readiness
pnpm package:smoke
pnpm test:e2e
```

Expected: all three public API hard gates pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/unit/vite/solace-plugin.test.ts tests/unit/compiler/parse.test.ts tests/unit/router/router.test.ts docs/api.md docs/api.zh-CN.md
git commit -m "test: lock sfc router beta boundaries"
```

Expected: one boundary regression commit.

### Task 5: DevTools Extension UI Readiness Review

**Files:**

- Modify: `docs/devtools.md`
- Modify: `docs/roadmap.md`
- Create: `docs/superpowers/specs/2026-07-28-devtools-extension-ui-design.md`

- [ ] **Step 1: Confirm SSR/SSG/hydration boundary**

Run:

```bash
rg -n "SSR/SSG/hydration|DevTools extension|browser DevTools" docs/roadmap.md docs/project-status.md docs/devtools.md
```

Expected: docs say DevTools extension UI starts after SSR/SSG/hydration planning.

- [ ] **Step 2: Draft DevTools UI design only after Task 1-4 are complete**

Design the UI around the existing `@italone/solace/devtools` event API. Do not change runtime event
payloads in the same task.

- [ ] **Step 3: Verify docs**

Run:

```bash
pnpm exec prettier --write docs/devtools.md docs/roadmap.md docs/superpowers/specs/2026-07-28-devtools-extension-ui-design.md
git diff --check
```

Expected: docs format and diff check pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/devtools.md docs/roadmap.md docs/superpowers/specs/2026-07-28-devtools-extension-ui-design.md
git commit -m "docs: design devtools extension ui"
```

Expected: one design-only DevTools commit.

## Final Verification

Run:

```bash
pnpm release:readiness
pnpm package:smoke
pnpm test:e2e
pnpm quality
```

Expected:

- Release readiness passes.
- Packed consumer smoke passes.
- Browser e2e reports 4 passed tests.
- Quality reports all format, typecheck, lint, unit/integration, and package export tests pass.
