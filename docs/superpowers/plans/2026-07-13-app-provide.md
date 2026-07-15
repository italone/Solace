# App Provide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `app.provide(key, value)` so app instances and plugins can expose injectable values to the mounted component tree.

**Architecture:** Store an app-level provides map in each `createApp()` closure, pass it through `render()`/`patch()` to component instances, and make `inject()` fall back to the app-level map after walking component parents. Preserve component-level provider precedence.

**Tech Stack:** TypeScript, Solace app/component/renderer runtime, Vitest app and component tests, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing App Provide Tests

**Files:**

- Modify: `tests/unit/app/create-app.test.ts`
- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Add root app provide test**

```ts
it("provides app-level values to the root component", () => {
  const container = document.createElement("div");
  const AppRoot = () => {
    const theme = inject("theme", "light");

    return () => h("span", null, String(theme));
  };

  createApp(AppRoot).provide("theme", "dark").mount(container);

  expect(container.innerHTML).toBe("<span>dark</span>");
});
```

- [x] **Step 2: Add plugin app provide test**

```ts
it("allows plugins to provide app-level values", () => {
  const container = document.createElement("div");
  const plugin: Plugin = (app) => {
    app.provide("message", "from plugin");
  };
  const AppRoot = () => {
    const message = inject("message", "missing");

    return () => h("span", null, String(message));
  };

  createApp(AppRoot).use(plugin).mount(container);

  expect(container.innerHTML).toBe("<span>from plugin</span>");
});
```

- [x] **Step 3: Add chaining test**

```ts
it("returns the app from provide for chaining", () => {
  const app = createApp(() => h("p", null, "mounted"));

  expect(app.provide("theme", "dark")).toBe(app);
});
```

- [x] **Step 4: Add descendant app provide test**

```ts
it("injects app-level values into descendant components", () => {
  const container = document.createElement("div");
  const Child = () => {
    const theme = inject("theme", "light");

    return () => h("span", null, String(theme));
  };
  const Parent = () => () => h(Child);

  createApp(Parent).provide("theme", "dark").mount(container);

  expect(container.innerHTML).toBe("<span>dark</span>");
});
```

- [x] **Step 5: Add component override test**

```ts
it("uses component providers before app-level providers", () => {
  const container = document.createElement("div");
  const Child = () => {
    const theme = inject("theme", "light");

    return () => h("span", null, String(theme));
  };
  const Parent = () => {
    provide("theme", "component");

    return () => h(Child);
  };

  createApp(Parent).provide("theme", "app").mount(container);

  expect(container.innerHTML).toBe("<span>component</span>");
});
```

- [x] **Step 6: Run RED**

Run: `pnpm test tests/unit/app/create-app.test.ts tests/unit/component/component.test.ts`

Expected: FAIL because `app.provide` does not exist and app-level values are not injected.

### Task 2: Implement App-Level Provides

**Files:**

- Modify: `src/app.ts`
- Modify: `src/renderer/renderer.ts`
- Modify: `src/renderer/diff.ts`
- Modify: `src/component/component.ts`
- Modify: `src/component/provide.ts`

- [x] **Step 1: Extend App type**

Add `provide<T>(key: ProvideKey, value: T): App` to `App` and import `ProvideKey` / `Provides`.

- [x] **Step 2: Store app provides**

Inside `createApp()`:

```ts
const appProvides: Provides = new Map();
```

Implement:

```ts
provide(key, value) {
  appProvides.set(key, value);
  return app;
}
```

- [x] **Step 3: Pass app provides through render**

Update `render(vnode, container)` to accept an optional app-level provides map and pass it to
`patch()`.

- [x] **Step 4: Pass app provides through patch**

Thread the app-level provides map through `patch()`, `mountElement()`, `mountFragment()`, and
`mountComponent()` so all descendants receive it.

- [x] **Step 5: Store app provides on component instances**

Add `appProvides: Provides | null` to `ComponentInstance`, pass it in `createComponentInstance()`,
and inherit from the parent instance for descendants.

- [x] **Step 6: Update inject fallback**

After walking parent providers, read `instance.appProvides` before returning the default value.

- [x] **Step 7: Run GREEN**

Run: `pnpm test tests/unit/app/create-app.test.ts tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-014-app-provide.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Add app provide to package smoke**

Make the packed consumer plugin call `app.provide(ThemeKey, "dark")`, remove the root component
`provide(ThemeKey, "dark")`, and verify `inject()` still typechecks.

- [x] **Step 2: Document `app.provide()`**

Update `docs/api.md` App section with `provide(key, value): App` and plugin usage.

- [x] **Step 3: Update README**

Add app-level provide to current plugin/component capability wording.

- [x] **Step 4: Add project log entry and index row**

Record changed files and validation results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [x] **Step 1: Run targeted tests**

Run: `pnpm test tests/unit/app/create-app.test.ts tests/unit/component/component.test.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [x] **Step 3: Run package smoke**

Run: `pnpm package:smoke`

Expected: PASS and print `package consumer smoke passed`.

- [x] **Step 4: Run full quality gate**

Run: `pnpm quality`

Expected: PASS.

- [x] **Step 5: Run format check**

Run: `pnpm format:check`

Expected: PASS.
