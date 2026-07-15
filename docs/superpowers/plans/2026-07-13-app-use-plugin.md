# App Use Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal `app.use(plugin, ...options)` plugin installation API to Solace apps.

**Architecture:** Keep plugin state inside each `createApp()` closure. Extend the `App` type with `use()`, support function and object plugins, dedupe per app instance, and leave mount/render behavior unchanged.

**Tech Stack:** TypeScript, Solace app runtime, Vitest app tests, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing App Plugin Tests

**Files:**

- Modify: `tests/unit/app/create-app.test.ts`

- [ ] **Step 1: Add function plugin test**

```ts
it("installs function plugins with options", () => {
  const container = document.createElement("div");
  const AppRoot = () => h("p", null, "mounted");
  const calls: unknown[][] = [];
  const app = createApp(AppRoot);

  app.use(
    (installedApp, ...options) => {
      calls.push([installedApp, ...options]);
    },
    "enabled",
    1,
  );
  app.mount(container);

  expect(calls).toEqual([[app, "enabled", 1]]);
  expect(container.innerHTML).toBe("<p>mounted</p>");
});
```

- [ ] **Step 2: Add object plugin test**

```ts
it("installs object plugins with options", () => {
  const app = createApp(() => h("p", null, "mounted"));
  const calls: unknown[][] = [];
  const plugin = {
    install(installedApp: unknown, ...options: unknown[]) {
      calls.push([installedApp, ...options]);
    },
  };

  app.use(plugin, { enabled: true });

  expect(calls).toEqual([[app, { enabled: true }]]);
});
```

- [ ] **Step 3: Add chaining and dedupe test**

```ts
it("returns the app from use and installs each plugin once per app", () => {
  const app = createApp(() => h("p", null, "mounted"));
  let calls = 0;
  const plugin = () => {
    calls += 1;
  };

  const returned = app.use(plugin).use(plugin);

  expect(returned).toBe(app);
  expect(calls).toBe(1);
});
```

- [ ] **Step 4: Add per-app installation test**

```ts
it("tracks installed plugins per app instance", () => {
  const firstApp = createApp(() => h("p", null, "first"));
  const secondApp = createApp(() => h("p", null, "second"));
  let calls = 0;
  const plugin = () => {
    calls += 1;
  };

  firstApp.use(plugin);
  secondApp.use(plugin);

  expect(calls).toBe(2);
});
```

- [ ] **Step 5: Run RED**

Run: `pnpm test tests/unit/app/create-app.test.ts`

Expected: FAIL because `app.use` does not exist.

### Task 2: Implement Minimal Plugin API

**Files:**

- Modify: `src/app.ts`

- [ ] **Step 1: Add plugin types**

```ts
export type PluginInstall = (app: App, ...options: unknown[]) => void;
export interface PluginObject {
  install: PluginInstall;
}
export type Plugin = PluginInstall | PluginObject;
```

- [ ] **Step 2: Extend `App`**

```ts
export interface App {
  mount(container: Element): void;
  use(plugin: Plugin, ...options: unknown[]): App;
}
```

- [ ] **Step 3: Add installed plugin state**

Inside `createApp()`:

```ts
const installedPlugins = new Set<Plugin>();
const app: App = { ... };
return app;
```

- [ ] **Step 4: Implement `use()`**

```ts
use(plugin, ...options) {
  if (installedPlugins.has(plugin)) {
    return app;
  }

  installedPlugins.add(plugin);
  if (typeof plugin === "function") {
    plugin(app, ...options);
  } else {
    plugin.install(app, ...options);
  }

  return app;
}
```

- [ ] **Step 5: Run GREEN**

Run: `pnpm test tests/unit/app/create-app.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-013-app-use-plugin.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add plugin usage to package smoke**

Import `Plugin`, create a function plugin, call `createApp(App).use(plugin).mount(...)`, and ensure
the plugin can typecheck against the packed package.

- [ ] **Step 2: Document `app.use()`**

Update `docs/api.md` App section with plugin forms and chaining.

- [ ] **Step 3: Update README**

Add plugin system to current capability text and remove it from future candidates.

- [ ] **Step 4: Add project log entry and index row**

Record changed files and validation results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [ ] **Step 1: Run targeted app tests**

Run: `pnpm test tests/unit/app/create-app.test.ts`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run package smoke**

Run: `pnpm package:smoke`

Expected: PASS and print `package consumer smoke passed`.

- [ ] **Step 4: Run full quality gate**

Run: `pnpm quality`

Expected: PASS.

- [ ] **Step 5: Run format check**

Run: `pnpm format:check`

Expected: PASS.
