# Slot Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Solace slot functions to receive an optional props object while preserving existing default and named slot behavior.

**Architecture:** Keep runtime behavior unchanged and expand the slot function type from zero-argument to optional-props. Validate the public API through component tests and packed package smoke.

**Tech Stack:** TypeScript, Solace component runtime, Vitest component tests, Rollup package exports, package consumer smoke.

---

### Task 1: Add Failing Slot Props Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [ ] **Step 1: Add named slot props test**

```ts
it("passes props to named slot children", () => {
  const container = document.createElement("div");
  const List =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("ul", null, [
        h(Fragment, null, slots.item?.({ value: "Ada", index: 0 }) ?? null),
        h(Fragment, null, slots.item?.({ value: "Grace", index: 1 }) ?? null),
      ]);

  render(
    h(List, null, {
      item: (slotProps) => h("li", null, `${String(slotProps?.index)}:${String(slotProps?.value)}`),
    }),
    container,
  );

  expect(container.innerHTML).toBe("<ul><li>0:Ada</li><li>1:Grace</li></ul>");
});
```

- [ ] **Step 2: Add default slot props test**

```ts
it("passes props to default slot children", () => {
  const container = document.createElement("div");
  const Message =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, slots.default?.({ text: "hello" }) ?? null);

  render(
    h(Message, null, {
      default: (slotProps) => h("p", null, String(slotProps?.text)),
    }),
    container,
  );

  expect(container.innerHTML).toBe("<section><p>hello</p></section>");
});
```

- [ ] **Step 3: Add reactive slot props update test**

```ts
it("updates slot props when the child component rerenders", async () => {
  const state = reactive({ count: 0 });
  const container = document.createElement("div");
  const Counter =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, slots.default?.({ count: state.count }) ?? null);

  render(
    h(Counter, null, {
      default: (slotProps) => h("span", null, `count: ${String(slotProps?.count)}`),
    }),
    container,
  );

  state.count = 1;
  await nextTick();

  expect(container.innerHTML).toBe("<section><span>count: 1</span></section>");
});
```

- [ ] **Step 4: Run RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL at TypeScript transform/type level because `Slot` does not currently accept props.

### Task 2: Implement Slot Props Types

**Files:**

- Modify: `src/component/component.ts`
- Modify: `src/vnode/vnode.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add `SlotProps` and update `Slot`**

In `src/component/component.ts`:

```ts
export type SlotProps = Record<string, unknown>;
export type Slot = (props?: SlotProps) => VNodeChildren;
```

- [ ] **Step 2: Reuse `Slot` in VNode slot children**

In `src/vnode/vnode.ts`, import the `Slot` type and update:

```ts
export type VNodeSlots = Record<string, Slot>;
```

- [ ] **Step 3: Export the public type**

In `src/index.ts`, export `SlotProps` from `src/component/component.ts`.

- [ ] **Step 4: Run GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Docs, Smoke, And Logs

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-012-slot-props.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add slot props to package smoke**

Update the packed consumer `Panel` to call `slots.default?.({ label: "slotted" })`, and update the
default slot function to read `slotProps?.label`.

- [ ] **Step 2: Document slot props**

Update `docs/api.md` component examples to show `slots.default?.({ text: "Body" })`.

- [ ] **Step 3: Update README candidate list**

Remove `slot props` from future candidates and include it in current component capability text.

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
