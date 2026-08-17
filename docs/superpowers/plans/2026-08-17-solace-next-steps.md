# Solace Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the `0.1.0-beta.5` baseline, harden the JSX/TSX-first public contract, and extend router / DevTools / performance evidence without expanding deferred scope.

**Architecture:** This plan keeps Solace's identity as a compact JSX/TSX-first runtime. Work is organized into five tracks: (1) release baseline validation, (2) JSX/TSX type contract hardening, (3) router stable-slice boundary coverage, (4) DevTools example panel hardening, and (5) benchmark/adoption evidence. Each track produces independently testable changes and updates the public contract docs and package smoke tests before any release claim.

**Tech Stack:** TypeScript, Vitest, Playwright, Rollup, Vite, pnpm, changesets.

---

## File Structure

This plan touches the following areas. No new runtime subsystems are created; most work extends existing files.

- `docs/project-status.md` — update completion map, validation dates, and known gaps after each track.
- `docs/api.md` — update public API examples if JSX/TSX type contracts change.
- `README.md` / `readme.zh-CN.md` — sync public contract wording.
- `src/jsx-types.ts` — JSX/TSX type contract (typed slots, listeners, generic components).
- `src/component/define-component.ts` — component type helpers.
- `src/component/component.ts` — emit/slot runtime behavior.
- `src/router/*.ts` — router stable slice.
- `src/server/*.ts` — router-aware SSR/hydration context.
- `examples/devtools-extension/` — DevTools panel UI and manifest.
- `tests/unit/**` and `tests/integration/**` — new tests for each track.
- `tests/e2e/**` — browser coverage for DevTools and router.
- `release/performance-history.json` — benchmark evidence.
- `package.json` — only if a new script or export changes; avoid unless required.

---

## Task 1: Re-sync release baseline and confirm beta.5 gate

**Files:**
- Read: `package.json:3`
- Read: `docs/project-status.md:9-32`
- Read: `release/adoption-evidence.md`
- Read: `release/one-zero-readiness.json`

- [ ] **Step 1: Fetch remote main and verify local/remote state**

Run:

```bash
git fetch origin main
git status --short --branch
git rev-list --left-right --count origin/main...HEAD
git tag -l 'v0.1.0-beta.5' -n1
git for-each-ref refs/tags/v0.1.0-beta.5
```

Expected: working tree clean; local `main` is not ahead of `origin/main`; local tag `v0.1.0-beta.5` exists and points to commit `afe459e` or the documented beta.5 release commit. Remote tag verification is noted as pending in `docs/project-status.md:216`.

- [ ] **Step 2: Re-run the full release gate to confirm baseline**

Run:

```bash
pnpm release:check
```

Expected: command exits 0. Record the final coverage numbers and test counts for comparison with `docs/project-status.md:139-152` (beta.5 recorded 81 Vitest files / 702 tests, 92.97% statements / 88.11% branches / 95.21% functions / 93.25% lines).

- [ ] **Step 3: Commit baseline evidence update if numbers changed**

If the gate passes with different numbers, update `docs/project-status.md` Validation Coverage section with the new date and counts.

```bash
git add docs/project-status.md
git commit -m "docs: record beta.5 baseline re-validation"
```

---

## Task 2: Harden JSX/TSX typed component contract

**Files:**
- Modify: `src/jsx-types.ts`
- Modify: `src/component/define-component.ts`
- Create: `tests/unit/renderer/jsx-typed-contract-edge.test.tsx`
- Modify: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`
- Modify: `docs/api.md`

- [ ] **Step 1: Add failing type tests for typed slot edge cases**

Create `tests/unit/renderer/jsx-typed-contract-edge.test.tsx`:

```tsx
import { describe, expectTypeOf, it } from "vitest";
import { defineComponent, type ComponentSetupContext } from "@italone/solace";

const Card = defineComponent(
  (_props: object, { slots }: ComponentSetupContext<{ header?: () => unknown; footer?: () => unknown }>) => {
    return () => (
      <div>
        {slots.header?.()}
        {slots.default?.()}
        {slots.footer?.()}
      </div>
    );
  },
);

describe("typed slots", () => {
  it("accepts named slots with correct types", () => {
    expectTypeOf(<Card v-slots={{ header: () => <header />, footer: () => <footer /> }}>body</Card>).toBeVoid();
  });
});
```

Run:

```bash
pnpm typecheck
```

Expected: FAIL with a JSX type error (the test asserts `toBeVoid` but TypeScript may reject the slot shape).

- [ ] **Step 2: Adjust JSX types to accept named slot objects**

Modify `src/jsx-types.ts` to ensure the automatic JSX runtime accepts component slot type parameters. Keep the change minimal and preserve existing generic component tests.

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Add runtime behavior test for named slots via JSX**

Add to `tests/unit/renderer/jsx-typed-contract-edge.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { createApp, defineComponent, type ComponentSetupContext } from "@italone/solace";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><div id=\"app\"></div>");
(globalThis as any).document = dom.window.document;
(globalThis as any).window = dom.window;

const Card = defineComponent(
  (_props: object, { slots }: ComponentSetupContext<{ header?: () => unknown; footer?: () => unknown }>) => {
    return () => (
      <div>
        {slots.header?.()}
        {slots.default?.()}
        {slots.footer?.()}
      </div>
    );
  },
);

describe("typed slots runtime", () => {
  it("renders named slots from JSX", () => {
    const container = dom.window.document.querySelector("#app") as Element;
    createApp(() => (
      <Card v-slots={{ header: () => <span>header</span>, footer: () => <span>footer</span> }}>
        body
      </Card>
    )).mount(container);
    expect(container.textContent).toContain("header");
    expect(container.textContent).toContain("body");
    expect(container.textContent).toContain("footer");
  });
});
```

Run:

```bash
pnpm test tests/unit/renderer/jsx-typed-contract-edge.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Update API docs with named slot example**

Modify `docs/api.md` Components section to include a typed named slot example similar to the test above.

- [ ] **Step 5: Commit**

```bash
git add src/jsx-types.ts tests/unit/renderer/jsx-typed-contract-edge.test.tsx docs/api.md
git commit -m "feat: harden JSX typed named slot contract"
```

---

## Task 3: Cover router stable-slice edge cases

**Files:**
- Modify: `src/router/router.ts`
- Modify: `src/router/snapshot.ts`
- Modify: `tests/integration/router-ssr-hydration.test.ts`
- Modify: `docs/api.md`

- [ ] **Step 1: Add failing integration test for lazy-route failure after navigation**

Modify `tests/integration/router-ssr-hydration.test.ts` to add:

```ts
describe("lazy route failure surface", () => {
  it("surfaces lazy-load-failed error with active route location", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: () => <div>home</div> },
        {
          path: "/lazy",
          component: lazyRoute(() => Promise.reject(new Error("load failed"))),
        },
      ],
    });
    await router.isReady();
    await expect(router.push("/lazy")).rejects.toMatchObject({
      type: "lazy-load-failed",
      to: expect.objectContaining({ path: "/lazy" }),
    });
  });
});
```

Run:

```bash
pnpm test tests/integration/router-ssr-hydration.test.ts -t "lazy route failure surface"
```

Expected: PASS if already implemented; if FAIL, note the missing field and fix in Step 2.

- [ ] **Step 2: Ensure lazy-load-failed errors carry active route location**

Modify `src/router/router.ts` lazy route handling so the error object includes `to` with the attempted location. Keep the existing error contract intact.

Run:

```bash
pnpm test tests/integration/router-ssr-hydration.test.ts -t "lazy route failure surface"
```

Expected: PASS.

- [ ] **Step 3: Add integration test for snapshot mismatch during hydration**

Add to `tests/integration/router-ssr-hydration.test.ts`:

```ts
describe("router snapshot hydration mismatch", () => {
  it("throws on snapshot mismatch unless recover is enabled", async () => {
    const router = createRouter({
      history: createMemoryHistory("/expected"),
      routes: [{ path: "/expected", component: () => <div>expected</div> }],
    });
    await router.isReady();
    const html = "<div id=\"app\"><div>wrong</div></div>";
    const dom = new JSDOM(`<!DOCTYPE html>${html}`);
    const container = dom.window.document.querySelector("#app") as Element;
    await expect(createApp(() => <router.View />).hydrateAsync(container, { snapshot: router.getCanonicalSnapshot() })).rejects.toThrow();
  });
});
```

Run:

```bash
pnpm test tests/integration/router-ssr-hydration.test.ts -t "router snapshot hydration mismatch"
```

Expected: PASS if mismatch detection is already strict; if FAIL, adjust `src/server/router-context.ts` or `src/renderer/hydration.ts` to surface the mismatch.

- [ ] **Step 4: Commit**

```bash
git add src/router/router.ts tests/integration/router-ssr-hydration.test.ts docs/api.md
git commit -m "test: cover router lazy failure and snapshot mismatch boundaries"
```

---

## Task 4: Harden DevTools extension timeline panel

**Files:**
- Modify: `examples/devtools-extension/src/panel.tsx`
- Modify: `examples/devtools-extension/manifest.json`
- Create: `tests/e2e/devtools-extension-store-timeline.spec.ts`
- Modify: `docs/devtools.md`

- [ ] **Step 1: Add store action timeline view to panel**

Modify `examples/devtools-extension/src/panel.tsx` to render a second tab or section that lists recorded store actions. Use the public `@italone/solace/devtools` listener API.

Example shape:

```tsx
const StoreActions = ({ actions }: { actions: Array<{ type: string; time: number; payload?: unknown }> }) => (
  <ul>
    {actions.map((action, i) => (
      <li key={i}>
        {action.time}: {action.type}
      </li>
    ))}
  </ul>
);
```

- [ ] **Step 2: Add e2e test for store action timeline**

Create `tests/e2e/devtools-extension-store-timeline.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("devtools panel renders store action timeline", async ({ page, extensionId }) => {
  await page.goto("http://localhost:6174/store-timeline");
  const backgroundPage = await page.context().backgroundPages()[0];
  // Open the panel via chrome extension URL
  await page.goto(`chrome-extension://${extensionId}/panel.html`);
  await page.getByText("Store").click();
  await expect(page.locator("text=increment")).toBeVisible();
});
```

Run:

```bash
pnpm test:e2e:devtools-extension
```

Expected: PASS after panel implementation. If the demo page does not exist, add `examples/devtools-extension/store-timeline.html` and route first.

- [ ] **Step 3: Document inspected-origin review checklist**

Modify `docs/devtools.md` to add a section:

```markdown
## Inspected Origin Checklist

Before distributing the extension beyond local demos:

1. Review `manifest.json` `host_permissions`.
2. Confirm no runtime payload changes are required.
3. Run `pnpm test:e2e:devtools-extension` on the target origins.
4. Publish only after explicit maintainer review.
```

- [ ] **Step 4: Commit**

```bash
git add examples/devtools-extension/ tests/e2e/devtools-extension-store-timeline.spec.ts docs/devtools.md
git commit -m "feat: add DevTools store action timeline panel and origin checklist"
```

---

## Task 5: Refresh benchmark history evidence

**Files:**
- Modify: `release/performance-history.json`
- Read: `docs/performance.md`
- Read: `docs/release.md`

- [ ] **Step 1: Regenerate benchmark history with distinct run timestamps**

Run:

```bash
pnpm benchmark
pnpm benchmark:browser
pnpm benchmark:history:evidence -- --output release/performance-history.json
```

Expected: `release/performance-history.json` is updated and contains 5 distinct `runAt` timestamps for every current jsdom task and every browser scenario.

- [ ] **Step 2: Verify history satisfies threshold rules**

Run:

```bash
pnpm benchmark:history -- --min-browser-count 5 --min-jsdom-count 5
```

Expected: PASS with no threshold failures.

- [ ] **Step 3: Commit**

```bash
git add release/performance-history.json
git commit -m "docs: refresh benchmark history evidence"
```

---

## Task 6: Update public contract documentation

**Files:**
- Modify: `docs/project-status.md`
- Modify: `README.md`
- Modify: `readme.zh-CN.md`

- [ ] **Step 1: Update project status with new validation dates**

After Tasks 1-5 pass, update `docs/project-status.md` Summary and Validation Coverage sections with the current date, test counts, coverage numbers, and any completed gaps.

- [ ] **Step 2: Sync README and Chinese README**

Mirror any public API example changes from `docs/api.md` into `README.md` and `readme.zh-CN.md`. Do not add new promises beyond the existing beta contract.

- [ ] **Step 3: Run quality gate**

Run:

```bash
pnpm quality
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/project-status.md README.md readme.zh-CN.md
git commit -m "docs: sync public contract docs after next-steps work"
```

---

## Self-Review

**1. Spec coverage:**
- Sync release baseline → Task 1.
- Harden JSX/TSX typed contract → Task 2.
- Router stable-slice boundaries → Task 3.
- DevTools example hardening → Task 4.
- Performance evidence → Task 5.
- Public contract docs → Task 6.
- No expansion of deferred scope (streaming SSR, auth, permissions, SFC syntax expansion, production DevTools distribution) is included.

**2. Placeholder scan:**
- No TBD/TODO/fill-in-details steps.
- Code blocks contain concrete examples.
- Commands include expected outputs.

**3. Type consistency:**
- `ComponentSetupContext` slot type parameter matches existing usage in `src/component/component.ts`.
- Router error `type: "lazy-load-failed"` matches existing error contract.
- DevTools listener shape uses the public subpath contract.

**Gap:** Task 4 assumes a `/store-timeline` demo route exists. If it does not, the task must first add the demo page before writing the e2e test.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-17-solace-next-steps.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach do you want?
