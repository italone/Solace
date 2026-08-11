# Solace 0.1 Stable Real-App Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one realistic Operations Console that validates upgrading and consuming Solace through
its packed public package, including routing, recovery, SSR/SSG, hydration, cross-browser behavior,
and a documented `0.1.x` compatibility policy.

**Architecture:** Keep the application permanently under `examples/operations-console`, with
feature-owned pages and shared domain components. Local development resolves Solace source aliases,
while a separate Node script copies the same application source into temporary consumers and builds
it against either a local tarball or pinned npm beta.2. Keep SPA routing, explicit server route
sources, and hydration fixtures separate so the example does not imply router-aware hydration.

**Tech Stack:** TypeScript, JSX/TSX, Solace public APIs, Vite, Rollup package output, Vitest, Playwright,
pnpm, Node.js 20/22.

**Execution constraint:** Work in the current authorized dirty `main`. Do not create a worktree,
commit, push, publish, merge, tag, or change `package.json` version. Replace commit steps with diff
checkpoints.

---

## File Map

### New application files

- `examples/operations-console/index.html`: routed SPA HTML entry.
- `examples/operations-console/hydration.html`: matching and recovering hydration fixtures.
- `examples/operations-console/vite.config.ts`: local source aliases and two browser build inputs.
- `examples/operations-console/src/domain.ts`: incident/release types and status labels.
- `examples/operations-console/src/shared/fixtures.ts`: fresh deterministic fixture factories.
- `examples/operations-console/src/shared/IncidentSummary.tsx`: shared SSR/hydration summary.
- `examples/operations-console/src/shared/Layout.tsx`: application shell and navigation.
- `examples/operations-console/src/shared/styles.css`: app-owned responsive presentation.
- `examples/operations-console/src/app/store.ts`: fresh store factory plus application singleton.
- `examples/operations-console/src/app/router.ts`: documented hash-history route tree.
- `examples/operations-console/src/app/App.tsx`: shell and `RouterView` composition.
- `examples/operations-console/src/features/overview/OverviewPage.tsx`: metrics and recent work.
- `examples/operations-console/src/features/incidents/IncidentQueuePage.tsx`: filters and status updates.
- `examples/operations-console/src/features/incidents/IncidentDetailPage.tsx`: route-prop detail view.
- `examples/operations-console/src/features/releases/ReleaseActivityPage.tsx`: retry and exhausted states.
- `examples/operations-console/src/features/NotFoundPage.tsx`: wildcard-route recovery navigation.
- `examples/operations-console/src/entries/client.tsx`: SPA mount entry.
- `examples/operations-console/src/entries/hydration.tsx`: matching and recovery hydration entry.
- `examples/operations-console/src/entries/server-core.tsx`: beta.2-compatible sync SSR/SSG scenario.
- `examples/operations-console/src/entries/server-async.tsx`: local-candidate async SSR/SSG scenario.

### New validation and policy files

- `tests/integration/operations-console.test.ts`: store, routes, rendering, and fixture drift tests.
- `tests/e2e/operations-console.spec.ts`: desktop workflows and responsive hydration checks.
- `scripts/operations-console-smoke-config.mjs`: pure consumer configuration and argument helpers.
- `scripts/operations-console-smoke-config.d.mts`: strict TypeScript declarations for those helpers.
- `scripts/operations-console-smoke.mjs`: local tarball and pinned-baseline consumers.
- `tests/unit/scripts/operations-console-smoke.test.ts`: generated consumer-config unit tests.
- `docs/compatibility.md`: English compatibility and deprecation policy.
- `docs/compatibility.zh-CN.md`: Chinese compatibility and deprecation policy.
- `tests/unit/docs/compatibility-docs.test.ts`: policy synchronization gate.

### Existing files to modify

- `package.json`: development, candidate smoke, upgrade smoke, and release-gate scripts.
- `playwright.config.ts`: Operations Console web server.
- `.github/workflows/ci.yml`: candidate packed-app smoke on Node 20/22.
- `docs/examples.md`: runnable example and port table.
- `readme.md`, `readme.zh-CN.md`: compatibility-policy links and short promise.
- `docs/api.md`, `docs/api.zh-CN.md`: maturity and protected-entry wording.
- `docs/package-usage.md`: upgrade and deprecation consumer guidance.
- `docs/project-status.md`, `docs/project-status.zh-CN.md`: real-app evidence and fresh gate metrics.
- `docs/release.md`: stable-line compatibility and baseline-upgrade release checklist.
- `docs/roadmap.md`: mark real-app validation and policy as completed stable prerequisites.
- `tests/unit/docs/examples-docs.test.ts`: Operations Console documentation assertions.
- `tests/unit/docs/public-contract-docs.test.ts`: compatibility links and refreshed metrics.
- `tests/unit/docs/release-docs.test.ts`: deprecation and upgrade release assertions.
- `tests/integration/package-exports.test.ts`: keep the documented protected entry list locked.

## Task 1: Domain Model And Store

**Files:**

- Create: `examples/operations-console/src/domain.ts`
- Create: `examples/operations-console/src/shared/fixtures.ts`
- Create: `examples/operations-console/src/app/store.ts`
- Create: `tests/integration/operations-console.test.ts`

- [x] **Step 1: Write failing store behavior tests**

Create the integration test with fresh-store assertions:

```ts
import { describe, expect, it } from "vitest";

import { createOperationsStore } from "../../examples/operations-console/src/app/store";

describe("Operations Console", () => {
  it("derives incident counts and updates status through an action", () => {
    const store = createOperationsStore();
    const previousIncidents = store.state.incidents;

    expect(store.getters.openCount).toBe(3);
    expect(store.getters.criticalCount).toBe(1);
    expect(store.getters.resolvedCount).toBe(1);

    store.actions.setIncidentStatus("INC-1042", "resolved");

    expect(store.getters.openCount).toBe(2);
    expect(store.getters.criticalCount).toBe(0);
    expect(store.getters.resolvedCount).toBe(2);
    expect(store.state.incidents).not.toBe(previousIncidents);
    expect(store.state.incidents.find((item) => item.id === "INC-1042")?.status).toBe("resolved");
  });

  it("creates isolated fixture state for each store", () => {
    const first = createOperationsStore();
    const second = createOperationsStore();

    expect(first.state.incidents).not.toBe(second.state.incidents);
    expect(first.state.incidents[0]).not.toBe(second.state.incidents[0]);
    first.actions.setIncidentStatus("INC-1042", "resolved");
    expect(second.state.incidents[0].status).toBe("investigating");
  });

  it("rejects status updates for unknown incidents", () => {
    const store = createOperationsStore();

    expect(() => store.actions.setIncidentStatus("INC-9999", "resolved")).toThrow(
      /^Unknown incident: INC-9999$/,
    );
  });
});
```

- [x] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
pnpm exec vitest run tests/integration/operations-console.test.ts
```

Expected: FAIL because `examples/operations-console/src/app/store.ts` does not exist.

- [x] **Step 3: Add exact domain and fixture contracts**

Define these public-to-the-example types in `domain.ts`:

```ts
export type IncidentStatus = "investigating" | "monitoring" | "resolved";
export type IncidentSeverity = "critical" | "high" | "medium";

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  updatedAt: string;
  summary: string;
}

export interface ReleaseRecord {
  id: string;
  version: string;
  environment: "staging" | "production";
  status: "completed" | "monitoring";
  releasedAt: string;
}

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};
```

In `fixtures.ts`, export `createIncidentFixtures()` with four incidents, including open critical
`INC-1042`, two other non-resolved incidents, and one resolved incident. Export
`createReleaseFixtures()` with at least three release records. Return new arrays and objects on every
call so tests do not share mutations.

- [x] **Step 4: Implement a fresh store factory**

Use only the documented root entry:

```ts
import { createStore } from "@italone/solace";
import type { StoreContext } from "@italone/solace";

import type { Incident, IncidentStatus, ReleaseRecord } from "../domain";
import { createIncidentFixtures, createReleaseFixtures } from "../shared/fixtures";

interface OperationsState {
  incidents: Incident[];
  releases: ReleaseRecord[];
}

interface OperationsGetters {
  openCount: number;
  criticalCount: number;
  resolvedCount: number;
}

export function createOperationsStore() {
  return createStore({
    state: (): OperationsState => ({
      incidents: createIncidentFixtures(),
      releases: createReleaseFixtures(),
    }),
    getters: {
      openCount: ({ state }): number =>
        state.incidents.filter((item) => item.status !== "resolved").length,
      criticalCount: ({ state }): number =>
        state.incidents.filter((item) => item.severity === "critical" && item.status !== "resolved")
          .length,
      resolvedCount: ({ state }): number =>
        state.incidents.filter((item) => item.status === "resolved").length,
    },
    actions: {
      setIncidentStatus(
        { state }: StoreContext<OperationsState, OperationsGetters>,
        id: string,
        status: IncidentStatus,
      ): void {
        const incident = state.incidents.find((item) => item.id === id);
        if (incident === undefined) {
          throw new Error(`Unknown incident: ${id}`);
        }
        state.incidents = state.incidents.map((item) =>
          item.id === id ? { ...item, status } : item,
        );
      },
    },
  });
}

export const operationsStore = createOperationsStore();
```

- [x] **Step 5: Run focused tests and typecheck**

Run:

```bash
pnpm exec vitest run tests/integration/operations-console.test.ts
pnpm typecheck
```

Expected: both commands PASS.

- [x] **Step 6: Inspect the slice without committing**

Run `git diff --check` and inspect `git diff -- examples/operations-console tests/integration/operations-console.test.ts`.

## Task 2: Routed Operations Console

**Files:**

- Create: `examples/operations-console/index.html`
- Create: `examples/operations-console/vite.config.ts`
- Create: `examples/operations-console/src/shared/Layout.tsx`
- Create: `examples/operations-console/src/shared/styles.css`
- Create: `examples/operations-console/src/app/App.tsx`
- Create: `examples/operations-console/src/app/router.ts`
- Create: `examples/operations-console/src/features/overview/OverviewPage.tsx`
- Create: `examples/operations-console/src/features/incidents/IncidentQueuePage.tsx`
- Create: `examples/operations-console/src/features/incidents/IncidentDetailPage.tsx`
- Create: `examples/operations-console/src/features/releases/ReleaseActivityPage.tsx`
- Create: `examples/operations-console/src/features/NotFoundPage.tsx`
- Create: `examples/operations-console/src/entries/client.tsx`
- Modify: `tests/integration/operations-console.test.ts`

- [x] **Step 1: Add failing route-contract tests**

Append tests that import `operationsRouter` and assert:

```ts
it("resolves named, redirected, dynamic, lazy, and fallback routes", () => {
  expect(
    operationsRouter.resolve({ name: "incident-detail", params: { id: "INC-1042" } }),
  ).toMatchObject({
    path: "/incidents/INC-1042",
    name: "incident-detail",
    params: { id: "INC-1042" },
  });
  const legacyMatches = operationsRouter.resolve("/legacy-incidents").matched;
  expect(legacyMatches[legacyMatches.length - 1]?.redirect).toBe("/incidents");
  expect(operationsRouter.resolve("/releases").name).toBe("releases");
  expect(operationsRouter.resolve("/missing").name).toBe("not-found");
});
```

Add a second integration test using `createMemoryHistory()`, `RouterView`, and
`IncidentDetailPage`. Mount `/incidents/INC-1042`, navigate to `/incidents/INC-1039` without
unmounting the router root, and assert the heading changes. This locks the setup-once route-prop
contract and prevents capturing `props.id` outside the render function.

- [x] **Step 2: Run the route test and verify failure**

Run `pnpm exec vitest run tests/integration/operations-console.test.ts`.

Expected: FAIL because `src/app/router.ts` does not exist.

- [x] **Step 3: Implement the route table**

Create `router.ts` with this documented shape:

```tsx
import { createRouter, createWebHashHistory, lazyRoute } from "@italone/solace";

import { IncidentDetailPage } from "../features/incidents/IncidentDetailPage";
import { IncidentQueuePage } from "../features/incidents/IncidentQueuePage";
import { NotFoundPage } from "../features/NotFoundPage";
import { OverviewPage } from "../features/overview/OverviewPage";

export const operationsRouter = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "overview", component: OverviewPage, meta: { title: "Overview" } },
    { path: "/incidents", name: "incidents", component: IncidentQueuePage },
    {
      path: "/incidents/:id",
      name: "incident-detail",
      component: IncidentDetailPage,
      props: true,
    },
    { path: "/legacy-incidents", redirect: "/incidents" },
    {
      path: "/releases",
      name: "releases",
      component: lazyRoute(() => import("../features/releases/ReleaseActivityPage")),
    },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundPage },
  ],
  scrollBehavior: () => ({ left: 0, top: 0 }),
});
```

Make `ReleaseActivityPage.tsx` default-export the component so `lazyRoute()` receives the documented
module shape.

- [x] **Step 4: Implement the application pages and recovery states**

Use `RouterLink`, `RouterView`, and `useRoute()` in `Layout.tsx`/`App.tsx`. Give the navigation links
accessible names `Overview`, `Incidents`, and `Releases`, and expose `aria-current="page"` for the
active section. Treat `incident-detail` as part of Incidents.

The queue page must provide:

```tsx
const query = ref("");
const visibleIncidents = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return operationsStore.state.incidents.filter((incident) =>
    needle.length === 0
      ? true
      : `${incident.id} ${incident.title} ${incident.service}`.toLowerCase().includes(needle),
  );
});
```

Render an input labelled `Search incidents`, keyed rows with `data-incident-id`, named detail links,
and a labelled status `<select>` whose `onChange` calls `setIncidentStatus`. Make horizontally
scrollable table containers keyboard-focusable named regions and show a visible focus outline. Mark
the option matching `incident.status` as selected as well as retaining the select value; this works
around the current renderer mounting select value before its option children.

The detail page accepts `{ id?: string }`, reads the shared store, renders owner/severity/status and
summary, and returns a not-found detail state when the ID is absent. Its back link must use
`to={{ name: "incidents" }}`.

The release page must define two module-level wrappers:

```tsx
let recoverableAttempts = 0;

const RecoverableReleasePanel = defineAsyncComponent({
  loader: async () => {
    recoverableAttempts += 1;
    if (recoverableAttempts === 1) throw new Error("release feed unavailable");
    return ReleaseTable;
  },
  loadingComponent: () => <p role="status">Loading release activity</p>,
  errorComponent: () => <p role="alert">Release activity unavailable</p>,
  retry: 1,
  retryDelay: 10,
});

const ExhaustedReleasePanel = defineAsyncComponent({
  loader: () => Promise.reject(new Error("dependency offline")),
  errorComponent: () => <p role="alert">Dependency status unavailable</p>,
  retry: 1,
  retryDelay: 10,
});
```

Render both wrappers and a heading `Release activity`. This demonstrates automatic recovery and the
exhausted error component without adding an error-boundary API.

- [x] **Step 5: Add shell, entry, Vite config, and restrained CSS**

`client.tsx` must import `styles.css` and mount with:

```tsx
createApp(App)
  .use(operationsRouter)
  .mount(document.querySelector("#app") as Element);
```

`index.html` contains `<div id="app"></div>` and loads `/src/entries/client.tsx`.

`vite.config.ts` uses the same root/JSX alias order as `examples/router-basic/vite.config.ts` and
configures `index.html` as the SPA build input. Task 3 adds `hydration.html` only after that file
exists. The CSS must use a fixed compact header, two-column shell above 800px, one-column shell below
800px, visible focus outlines, table overflow containment, non-color status labels, AA text contrast,
and no nested cards or decorative gradients. Mobile form controls use at least `1rem` text to avoid
focus zoom, and font sizes never scale with viewport width.

- [x] **Step 6: Run focused static validation**

Run:

```bash
pnpm exec vitest run tests/integration/operations-console.test.ts
pnpm typecheck
pnpm lint
pnpm exec vite build examples/operations-console
```

Expected: all commands PASS and `examples/operations-console/dist/index.html` exists. Remove or rely
on the existing ignore rule for generated output; confirm `git status --short` has no tracked dist
change.

- [x] **Step 7: Inspect the slice without committing**

Run `git diff --check` and inspect the application diff.

## Task 3: SSR, SSG, And Hydration Entries

**Files:**

- Create: `examples/operations-console/hydration.html`
- Create: `examples/operations-console/src/shared/IncidentSummary.tsx`
- Create: `examples/operations-console/src/entries/hydration.tsx`
- Create: `examples/operations-console/src/entries/server-core.tsx`
- Create: `examples/operations-console/src/entries/server-async.tsx`
- Modify: `examples/operations-console/vite.config.ts`
- Modify: `tests/integration/operations-console.test.ts`
- Modify: `vitest.config.ts`

- [x] **Step 1: Add failing server and fixture-drift tests**

Append these assertions:

```ts
it("renders the beta.2-compatible server scenario", () => {
  const result = runCoreRenderingScenario();
  expect(result.rendered.html).toContain("Open incidents");
  expect(result.site.pages.map((page) => page.path)).toEqual(["/", "/incidents/INC-1042"]);
  expect(result.site.pages[0].html).toContain("assets/hydration.js");
});

it("preserves async route output order", async () => {
  await expect(runAsyncRenderingScenario()).resolves.toMatchObject({
    rendered: { html: expect.stringContaining("Async operations snapshot") },
    paths: ["/async-overview", "/async-incident"],
  });
});

it("keeps matching hydration markup aligned with server output", async () => {
  const fixture = await readFile("examples/operations-console/hydration.html", "utf8");
  const document = new DOMParser().parseFromString(fixture, "text/html");
  const result = runCoreRenderingScenario();
  const matchingRoots = document.querySelectorAll("#matching-root");

  expect(matchingRoots).toHaveLength(1);
  expect(matchingRoots[0]?.innerHTML).toBe(result.hydrationBody);
  expect(
    document.querySelectorAll('style[data-s-id="operations-console-incident-summary"]'),
  ).toHaveLength(1);
  expect(
    document.querySelector('style[data-s-id="operations-console-incident-summary"]')?.outerHTML,
  ).toBe(result.rendered.styles[0]);
});
```

Import `readFile`, `runCoreRenderingScenario`, and `runAsyncRenderingScenario` from their exact new
paths.

Convert `resolveSolaceAlias()` in `vitest.config.ts` to an ordered alias array. Keep explicit public
subpaths first, add `@italone/solace/server`, and use `/^@italone\/solace$/` for the final root alias
so example server entries are tested through the intended public source entry without prefix
accidents for other subpaths.

- [x] **Step 2: Run tests and verify missing-entry failures**

Run `pnpm exec vitest run tests/integration/operations-console.test.ts`.

Expected: FAIL because the server entries do not exist.

- [x] **Step 3: Implement the shared summary and core server scenario**

`IncidentSummary.tsx` accepts
`{ openCount: number; label?: string; onIncrement?: () => void; incrementLabel?: string }`, calls
`useStyle()` with a stable ID, and renders a `<section data-operations-summary>` containing the label,
count, and a button. The button is always present so SSR and hydration structure match; omit only its
event handler when rendering on the server.

`server-core.tsx` must export:

```tsx
export function runCoreRenderingScenario() {
  const hydrationBody = renderToString(<IncidentSummary openCount={3} />).html;
  const rendered = renderToString(<IncidentSummary openCount={3} label="Open incidents" />);
  const site = generateStaticSite({
    routes: [
      { path: "/", source: <IncidentSummary openCount={3} /> },
      {
        path: "/incidents/INC-1042",
        source: <IncidentSummary openCount={1} label="Critical incidents" />,
      },
    ],
    manifest: {
      "src/entries/hydration.tsx": {
        file: "assets/hydration.js",
        css: ["assets/operations.css"],
      },
    },
    clientEntry: "src/entries/hydration.tsx",
    shell: ({ body, styles, assets }) =>
      `<!doctype html><html><head>${styles.join("")}${assets.stylesheets.join("")}</head><body>${body}${assets.scripts.join("")}</body></html>`,
  });
  return { hydrationBody, rendered, site };
}
```

Adjust the shell to the exact `StaticAssetTags` values returned by the existing API: join generated
tag strings directly and do not construct asset URLs privately.

For both generated pages, parse full HTML and assert one inline collected style in `<head>`, one
stylesheet link for `/assets/operations.css`, no head script, one body module script for
`/assets/hydration.js`, route-specific summary content, and summary markup before the script.

- [x] **Step 4: Implement the candidate-only async scenario**

`server-async.tsx` exports one function:

```tsx
export async function runAsyncRenderingScenario() {
  const rendered = await renderToStringAsync(
    Promise.resolve(<IncidentSummary openCount={3} label="Async operations snapshot" />),
  );
  const site = await generateStaticSiteAsync({
    routes: [
      { path: "/async-overview", source: Promise.resolve(<IncidentSummary openCount={3} />) },
      { path: "/async-incident", source: Promise.resolve(<IncidentSummary openCount={1} />) },
    ],
  });
  return { rendered, paths: site.pages.map((page) => page.path) };
}
```

- [x] **Step 5: Implement matching and recovery hydration fixtures**

`hydration.html` contains the exact `hydrationBody` under `#matching-root`, the exact SSR
`style[data-s-id]` output in `<head>`, a stale `<p>` under `#recovery-root`, two empty `<output>`
elements for results, and the hydration entry script. Parse the fixture in tests and lock root
uniqueness, exact root `innerHTML`, and exact style `outerHTML`.

`hydration.tsx` must:

1. retain `matchingRoot.firstElementChild`;
2. call `createApp(MatchingSummary).hydrate(matchingRoot)`;
3. write `server node reused` to `#matching-result` only when identity is preserved;
4. call `createApp(RecoverySummary).hydrate(recoveryRoot, { recover: true })`;
5. write `mismatch recovered` to `#recovery-result`;
6. expose buttons labelled `Increment open incidents` and `Increment recovered count` whose reactive
   counts update after hydration.

Do not inspect `_solaceVNode`, component instances, or any other private field.

Add `hydration.html` as the second named Rollup input in `vite.config.ts` now that both HTML files
exist.

- [x] **Step 6: Run rendering and package-focused tests**

Run:

```bash
pnpm exec vitest run tests/integration/operations-console.test.ts tests/integration/ssr-hydration.test.ts
pnpm typecheck
pnpm exec vite build examples/operations-console
```

Expected: all commands PASS and both HTML inputs are emitted.

- [x] **Step 7: Inspect the slice without committing**

Run `git diff --check` and inspect server/hydration diffs.

## Task 4: Cross-Browser Operations Workflows

**Files:**

- Create: `tests/e2e/operations-console.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/examples.md`
- Modify: `tests/unit/docs/examples-docs.test.ts`
- Modify: `package.json`

- [x] **Step 1: Add the web server and failing E2E journeys**

Add a Vite web server at `http://127.0.0.1:6180` using the existing sanitized environment helper.
Write tests that navigate with absolute URLs:

```ts
test("runs the operations workflow", async ({ page }) => {
  await page.goto("http://127.0.0.1:6180");
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await page.getByRole("link", { name: "Incidents" }).click();
  await page.getByLabel("Search incidents").fill("checkout");
  await expect(page.locator("[data-incident-id]")).toHaveCount(1);
  await page.getByLabel("Status for INC-1042").selectOption("monitoring");
  await expect(page.getByLabel("Status for INC-1042")).toHaveValue("monitoring");
  await page.getByRole("link", { name: /INC-1042/ }).click();
  await expect(page.getByRole("heading", { name: /INC-1042/ })).toBeVisible();
  await page.getByRole("link", { name: "Back to incidents" }).click();
  await page.goto("http://127.0.0.1:6180/#/legacy-incidents");
  await expect(page.getByRole("heading", { name: "Incident queue" })).toBeVisible();
  await page.getByRole("link", { name: "Releases" }).click();
  await expect(page.getByRole("table", { name: "Release activity" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Dependency status unavailable");
  await page.goto("http://127.0.0.1:6180/#/missing");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("hydrates matching and mismatched server markup", async ({ page }) => {
  await page.goto("http://127.0.0.1:6180/hydration.html");
  await expect(page.locator("#matching-result")).toHaveText("server node reused");
  await expect(page.locator('style[data-s-id="operations-console-incident-summary"]')).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Increment open incidents" }).click();
  await expect(page.locator("#matching-root")).toContainText("4");
  await expect(page.locator("#recovery-result")).toHaveText("mismatch recovered");
  await page.getByRole("button", { name: "Increment recovered count" }).click();
  await expect(page.locator("#recovery-root")).toContainText("2");
});
```

- [x] **Step 2: Run the E2E file and verify it fails before the app is complete**

Run:

```bash
pnpm exec playwright test tests/e2e/operations-console.spec.ts --project=chromium
```

Expected: FAIL on the first missing or mismatched accessible application state.

- [x] **Step 3: Complete accessibility and responsive behavior exposed by E2E**

Use real headings, `<label>` elements, table captions, focusable links, and button text. Add a third
test with `page.setViewportSize({ width: 390, height: 844 })` that asserts the application shell has
no horizontal overflow and the incident search/status controls remain visible. Fix only application
markup/CSS required by these observable checks.

- [x] **Step 4: Document the example and add scripts**

Add these `package.json` scripts without changing version:

```json
"dev:operations": "vite examples/operations-console",
"build:operations": "vite build examples/operations-console"
```

Add an `Operations Console` section to `docs/examples.md` covering the command, location, SPA routes,
automatic retry, SSR/SSG entries, hydration fixture, and packed validation purpose. Add port `6180`
to the table. Extend `examples-docs.test.ts` to assert those exact concepts.

- [x] **Step 5: Run three-browser E2E and docs checks**

Run:

```bash
pnpm exec vitest run tests/unit/docs/examples-docs.test.ts
pnpm exec playwright test tests/e2e/operations-console.spec.ts
```

Expected: the Vitest file passes and all Operations Console tests pass in Chromium, Firefox, and
WebKit. DevTools tests are not part of this ordinary config.

- [x] **Step 6: Inspect the slice without committing**

Run `git diff --check` and inspect Playwright, app, package script, and docs diffs.

## Task 5: Packed Candidate And Beta.2 Upgrade Smoke

**Files:**

- Create: `scripts/operations-console-smoke.mjs`
- Create: `scripts/operations-console-smoke-config.mjs`
- Create: `scripts/operations-console-smoke-config.d.mts`
- Create: `tests/unit/scripts/operations-console-smoke.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Write failing consumer-config tests**

Test exported pure helpers without invoking the top-level smoke:

```ts
import { describe, expect, it } from "vitest";
import {
  createConsumerPackageJson,
  createConsumerTsconfig,
  parseSmokeArguments,
} from "../../../scripts/operations-console-smoke-config.mjs";

describe("operations console package smoke", () => {
  it("pins only the requested Solace package in the consumer", () => {
    expect(createConsumerPackageJson("file:/tmp/solace.tgz")).toMatchObject({
      private: true,
      type: "module",
      dependencies: { "@italone/solace": "file:/tmp/solace.tgz" },
    });
  });

  it("excludes candidate-only async server code from the beta.2 baseline", () => {
    expect(createConsumerTsconfig(false).exclude).toContain("src/entries/server-async.tsx");
    expect(createConsumerTsconfig(true).exclude).not.toContain("src/entries/server-async.tsx");
  });

  it("accepts only the pinned baseline option", () => {
    expect(parseSmokeArguments(["--baseline", "0.1.0-beta.2"])).toEqual({
      baseline: "0.1.0-beta.2",
    });
    expect(() => parseSmokeArguments(["--baseline", "latest"])).toThrow(
      "Baseline must be 0.1.0-beta.2",
    );
  });
});
```

Create `operations-console-smoke-config.d.mts` with exact declarations for the three exported
functions. `createConsumerPackageJson()` returns a JSON object with `private`, `type`, and
`dependencies`; `createConsumerTsconfig()` returns the strict compiler/include/exclude object;
`parseSmokeArguments()` returns `{ baseline?: "0.1.0-beta.2" }`.

- [x] **Step 2: Run the helper test and verify missing-module failure**

Run `pnpm exec vitest run tests/unit/scripts/operations-console-smoke.test.ts`.

Expected: FAIL because the smoke config module does not exist.

- [x] **Step 3: Implement pure configuration helpers and temporary consumer creation**

Implement the three tested helpers in `operations-console-smoke-config.mjs`. Import them into the
main smoke script. The main script executes only when `process.argv[1] !== undefined` and
`fileURLToPath(import.meta.url) === resolve(process.argv[1])`.

Use `mkdtemp(join(tmpdir(), "solace-operations-consumer-"))`, `cp(..., { recursive: true })`, explicit
`join()` paths, inherited child-process stdio, and `rm(workspace, { recursive: true, force: true })` in
`finally`.

Candidate mode must:

1. run `pnpm build` at repository root;
2. run `pnpm pack --pack-destination <packDir>`;
3. require exactly one `.tgz`;
4. copy `examples/operations-console/src`, both HTML files, and generate a no-alias Vite config;
5. install the tarball with `pnpm install --ignore-scripts`;
6. run root `tsc -p <consumerDir>`;
7. run root Vite for the two browser entries;
8. run Vite SSR builds for `server-core.tsx` and `server-async.tsx`;
9. dynamically import each emitted server module and assert the core/async result contracts;
10. assert both browser HTML files and at least one JavaScript asset exist.

Generate a plain-object `vite.config.mjs` so the consumer does not need to import repository source or
resolve Vite as its own dependency.

- [x] **Step 4: Implement pinned upgrade mode**

When passed `--baseline 0.1.0-beta.2`, run one baseline consumer with dependency value
`0.1.0-beta.2` and `includeAsync: false`, then run the local candidate consumer with
`includeAsync: true`. Prefix failures with `baseline compatibility failed:` or
`local candidate compatibility failed:` so registry/network failures remain distinguishable.

Do not accept `latest`, `beta`, ranges, or environment-derived package specs.

- [x] **Step 5: Wire scripts and CI**

Add:

```json
"stable:app": "node scripts/operations-console-smoke.mjs",
"stable:app:upgrade": "node scripts/operations-console-smoke.mjs --baseline 0.1.0-beta.2"
```

Insert `pnpm stable:app` after `pnpm package:smoke` in `release:check`. Add a `Stable app packed
consumer` step after `Package consumer smoke` in the Node 20/22 CI quality matrix. Do not add the
registry-backed upgrade command to routine CI.

- [x] **Step 6: Run unit and local candidate validation**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/operations-console-smoke.test.ts
pnpm stable:app
```

Expected: helper tests pass; candidate smoke logs successful typecheck, client build, core server
scenario, async server scenario, and cleanup.

- [x] **Step 7: Run the explicit beta.2 upgrade validation**

Run `pnpm stable:app:upgrade` with registry access.

Expected: the pinned beta.2 core workflow passes first, then the local candidate core plus additive
async workflow passes. If network access is sandbox-blocked, rerun only this approved npm-dependent
command with escalation; do not weaken the baseline pin.

- [x] **Step 8: Inspect the slice without committing**

Run `git diff --check`, inspect script/CI/package diffs, and confirm no temp consumer remains in the
repository.

## Task 6: Compatibility And Deprecation Policy

**Files:**

- Create: `docs/compatibility.md`
- Create: `docs/compatibility.zh-CN.md`
- Create: `tests/unit/docs/compatibility-docs.test.ts`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`
- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/release.md`
- Modify: `docs/roadmap.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `tests/unit/docs/release-docs.test.ts`
- Modify: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Write failing policy contract tests**

The new test must read both policy files and `package.json`, then assert:

```ts
const protectedEntries = [
  ".",
  "./devtools",
  "./jsx-dev-runtime",
  "./jsx-runtime",
  "./package.json",
  "./server",
  "./sfc",
  "./vite",
];

expect(Object.keys(packageJson.exports).sort()).toEqual(protectedEntries);
for (const doc of [compatibility, compatibilityZh]) {
  expect(doc).toContain("0.1.x");
  expect(doc).toContain("0.2.0");
  expect(doc).toContain("@italone/solace/server");
  expect(doc).toContain("@italone/solace/package.json");
  expect(doc).toContain("src/**");
  expect(doc).toContain("dist/**");
}
expect(compatibility).toContain("at least one published `0.1.x` release");
expect(compatibilityZh).toContain("至少一个已发布的 `0.1.x` 版本");
```

Extend release-doc tests to require `pnpm stable:app:upgrade`, the pinned beta.2 baseline, and the
security/correctness exception. Extend public-contract docs tests to require compatibility links in
both READMEs and API docs.

- [x] **Step 2: Run documentation tests and verify failure**

Run:

```bash
pnpm exec vitest run tests/unit/docs/compatibility-docs.test.ts tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts
```

Expected: FAIL because policy files and synchronized wording are missing.

- [x] **Step 3: Write the English and Chinese policy documents**

Both documents must define:

- all eight protected package export keys and their user-facing import paths;
- `0.1.x` as one compatibility line;
- patch releases as additive/fix-only for documented stable behavior;
- breaking removals/signature changes no earlier than `0.2.0`;
- router/async beta and SFC/Vite experimental maturity without silent entry-path removal;
- private `src/**`, `dist/**`, generated layout, and internals exclusions;
- exact messages protected only when explicitly documented;
- deprecation marker, replacement, migration example, changeset/release note, retained tests, one
  published `0.1.x` release minimum, then removal at a breaking boundary;
- the severe security/correctness exception and required prominent migration guidance.

Keep the two language versions structurally aligned.

- [x] **Step 4: Synchronize public guidance and release gates**

Add short links and summaries rather than duplicating the full policy. `docs/release.md` must add a
stable compatibility checklist containing:

```bash
pnpm stable:app:upgrade
pnpm release:check
```

State that the upgrade baseline is exactly `@italone/solace@0.1.0-beta.2`, that routine CI runs the
local candidate only, and that public-entry deprecations require types/docs/changeset/tests together.

Update `docs/roadmap.md` to mark medium-app validation and compatibility policy as stable
prerequisites being completed by this slice, while leaving router-aware SSR/hydration and production
DevTools distribution deferred.

- [x] **Step 5: Keep package exports synchronized**

Refactor the existing package-export test only enough to share the exact protected-entry constant or
repeat the same explicit sorted list. Do not add or remove an export. Run:

```bash
pnpm test:package
pnpm exec vitest run tests/unit/docs/compatibility-docs.test.ts tests/unit/docs/public-contract-docs.test.ts tests/unit/docs/release-docs.test.ts
```

Expected: all package and documentation contract tests PASS.

- [x] **Step 6: Inspect the slice without committing**

Run `git diff --check` and compare English/Chinese policy sections side by side.

## Task 7: Final Status Evidence And Release Gate

**Files:**

- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify only if actual evidence requires it: `docs/release.md`, `docs/examples.md`

- [x] **Step 1: Run focused checks before recording metrics**

Run:

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:package
pnpm stable:app
pnpm test:e2e
```

Expected: all pass. Ordinary E2E includes Operations Console in Chromium, Firefox, and WebKit;
DevTools remains excluded from this config.

- [x] **Step 2: Capture fresh coverage and browser counts**

Run:

```bash
pnpm test:coverage
pnpm exec playwright test --list
pnpm exec playwright test --config playwright.devtools-extension.config.ts --list
```

Record the exact Vitest file/test count, statements/branches/functions/lines percentages, ordinary
cross-browser E2E count, and Chromium-only DevTools count from command output. Do not estimate them.

- [x] **Step 3: Update English/Chinese project status and metric locks**

Replace the previous `2026-08-11` full-gate evidence with a new dated paragraph that states:

- the Operations Console candidate packed smoke result;
- the pinned beta.2 upgrade result;
- fresh unit/integration and coverage metrics;
- fresh ordinary three-browser and DevTools Chromium-only counts;
- package version remained `0.1.0-beta.2` and no publish occurred.

Mirror the facts in Chinese. Update exact assertions in `public-contract-docs.test.ts` to the captured
values.

- [x] **Step 4: Run the explicit upgrade gate again after docs settle**

Run `pnpm stable:app:upgrade`.

Expected: pinned beta.2 core and local candidate scenarios PASS. If registry state is unavailable,
report this gate as unverified and do not claim the stable prerequisite complete.

- [x] **Step 5: Run the complete local release gate**

Run:

```bash
pnpm release:check
```

Expected: release readiness, quality, coverage, existing package smoke, Operations Console packed
smoke, benchmarks, Chromium/Firefox/WebKit E2E, and Chromium-only DevTools extension E2E all PASS.

- [x] **Step 6: Verify generated-output cleanliness**

Run:

```bash
git status --short
git diff --check
pnpm format:check
```

Expected: only intended source/docs/tests/config files are modified or untracked; `dist`, coverage,
benchmark history, Playwright output, packed tarballs, and temporary consumers produce no tracked
diff.

- [x] **Step 7: Final manual scope audit without committing**

Confirm all of the following from the diff:

- no package version, changeset release version, tag, or publish action changed;
- no router auth/permissions, router-aware rendering, streaming SSR, SFC expansion, UI library, or
  production DevTools distribution entered the implementation;
- the compatibility promise covers documented entries and explicitly excludes private deep paths;
- candidate async checks remain excluded from the beta.2 baseline build;
- all checklist statuses in this plan reflect actual command evidence.
