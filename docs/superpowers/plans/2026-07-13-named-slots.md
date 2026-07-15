# Named Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named slot support for component children passed as slot function maps while preserving default slot behavior.

**Architecture:** Extend the VNode component children type to include slot dictionaries, preserve those dictionaries for component VNodes, and teach component slot initialization to copy named slot functions into the setup context. Keep JSX slot syntax and slot props out of scope.

**Tech Stack:** TypeScript, Solace VNode/component runtime, Vitest component tests, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing Named Slot Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add multiple named slots test**

```ts
it("renders named slot children", () => {
  const container = document.createElement("div");
  const Layout =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, [
        h("header", null, slots.header?.() ?? null),
        h("main", null, slots.default?.() ?? null),
        h("footer", null, slots.footer?.() ?? null),
      ]);

  render(
    h(Layout, null, {
      header: () => h("h1", null, "Title"),
      default: () => h("p", null, "Body"),
      footer: () => h("small", null, "Meta"),
    }),
    container,
  );

  expect(container.innerHTML).toBe(
    "<section><header><h1>Title</h1></header><main><p>Body</p></main><footer><small>Meta</small></footer></section>",
  );
});
```

- [ ] **Step 2: Add missing named slot test**

```ts
it("omits missing named slots", () => {
  const container = document.createElement("div");
  const Layout =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, [
        h("header", null, slots.header?.() ?? null),
        h("main", null, slots.default?.() ?? null),
      ]);

  render(
    h(Layout, null, {
      default: () => h("p", null, "Body"),
    }),
    container,
  );

  expect(container.innerHTML).toBe("<section><header></header><main><p>Body</p></main></section>");
});
```

- [ ] **Step 3: Add named slot update test**

```ts
it("updates named slot children when component children change", () => {
  const container = document.createElement("div");
  const Layout =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, [
        h("header", null, slots.header?.() ?? null),
        h("main", null, slots.default?.() ?? null),
      ]);

  render(
    h(Layout, null, {
      header: () => h("h1", null, "Before"),
      default: () => h("p", null, "Body"),
    }),
    container,
  );
  const section = container.querySelector("section");

  render(
    h(Layout, null, {
      default: () => h("p", null, "Updated"),
    }),
    container,
  );

  expect(container.innerHTML).toBe(
    "<section><header></header><main><p>Updated</p></main></section>",
  );
  expect(container.querySelector("section")).toBe(section);
});
```

- [ ] **Step 4: Run RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because component children do not accept or preserve named slot maps yet.

### Task 2: Implement Named Slot Runtime

**Files:**

- Modify: `src/vnode/vnode.ts`
- Modify: `src/vnode/h.ts`
- Modify: `src/component/component.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add slot child types**

In `src/vnode/vnode.ts`, add `VNodeSlots = Record<string, () => VNodeChildren>` and
`ComponentVNodeChildren = VNodeChildren | VNodeSlots`.

- [ ] **Step 2: Accept slot maps for component VNodes**

Update component `createVNode()` and `h()` overloads so component children can be
`ComponentVNodeChildren`.

- [ ] **Step 3: Preserve component slot maps**

In `createVNode()`, detect non-null plain object children for component vnodes and leave the object
unchanged instead of wrapping it in an array.

- [ ] **Step 4: Copy named slots into component instances**

In `initSlots()`, clear every previous slot key, then:

- If children is a slot map, copy function-valued keys to `instance.slots`.
- Otherwise, keep the existing behavior of assigning `children` to `slots.default`.

- [ ] **Step 5: Run GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-011-named-slots.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add named slot usage to package smoke**

Change the consumer `Panel` usage to pass `{ header, default }` slot functions and update `Panel` to
read `slots.header?.()`.

- [ ] **Step 2: Document named slots**

Update `docs/api.md` component examples to show `slots.header?.()` and `h(Panel, null, { ... })`.

- [ ] **Step 3: Update README candidate list**

Remove `named slots` from future candidates while keeping `slot props` as future work.

- [ ] **Step 4: Add project log entry and index row**

Record changed files and validation results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [ ] **Step 1: Run targeted component tests**

Run: `pnpm test tests/unit/component/component.test.ts`

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
