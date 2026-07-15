# Default Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose component VNode children as a minimal default slot on `ComponentSetupContext`.

**Architecture:** Keep VNode children normalization unchanged. Add a small slots model to component instances, initialize it during setup, and refresh it when component VNodes update so `slots.default?.()` always returns the latest children.

**Tech Stack:** TypeScript, Solace component runtime, Vitest, Rollup package quality scripts.

---

### Task 1: Add Default Slot Behavior Tests

**Files:**

- Modify: `tests/unit/component/component.test.ts`

- [x] **Step 1: Write failing tests**

Add tests inside `describe("component renderer", ...)`:

```ts
it("renders component default slot children", () => {
  const container = document.createElement("div");
  const Panel =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, slots.default?.() ?? null);

  render(h(Panel, null, h("span", null, "inside")), container);

  expect(container.innerHTML).toBe("<section><span>inside</span></section>");
});

it("omits the default slot when component children are empty", () => {
  const container = document.createElement("div");
  const Panel =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, slots.default?.() ?? h("em", null, "empty"));

  render(h(Panel), container);

  expect(container.innerHTML).toBe("<section><em>empty</em></section>");
});

it("updates default slot children when component children change", () => {
  const container = document.createElement("div");
  const Panel =
    (_props: object, { slots }: ComponentSetupContext) =>
    () =>
      h("section", null, slots.default?.() ?? null);

  render(h(Panel, null, h("span", null, "before")), container);
  const section = container.querySelector("section");

  render(h(Panel, null, h("strong", null, "after")), container);

  expect(container.innerHTML).toBe("<section><strong>after</strong></section>");
  expect(container.querySelector("section")).toBe(section);
});
```

- [x] **Step 2: Run test to verify RED**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: FAIL because `slots` is missing from `ComponentSetupContext` or is `undefined` at runtime.

### Task 2: Implement Component Slots

**Files:**

- Modify: `src/component/component.ts`

- [x] **Step 1: Add slots types and instance storage**

Add:

```ts
export type Slot = () => VNodeChildren;

export interface Slots {
  default?: Slot;
}
```

Add `slots: Slots;` to `ComponentInstance` and initialize it with `{}` in `createComponentInstance`.

- [x] **Step 2: Expose slots in setup context**

Update `ComponentSetupContext`:

```ts
export interface ComponentSetupContext {
  emit: EmitFn;
  slots: Slots;
}
```

In `setupComponent`, initialize slots before creating `setupContext`, and pass `instance.slots`:

```ts
initProps(instance, instance.vnode.props);
initSlots(instance, instance.vnode.children);

const setupContext: ComponentSetupContext = {
  emit: instance.emit,
  slots: instance.slots,
};
```

- [x] **Step 3: Refresh slots on component update**

In `updateComponentProps`, call `initSlots(instance, nextVNode.children)` after props update.

Add:

```ts
function initSlots(instance: ComponentInstance, children: VNodeChildren): void {
  delete instance.slots.default;

  if (children !== null) {
    instance.slots.default = () => children;
  }
}
```

- [x] **Step 4: Run targeted test to verify GREEN**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

### Task 3: Update Public Docs and Logs

**Files:**

- Modify: `docs/api.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-13-006-default-slots.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Document slots in API docs**

Update the components section to show `slots.default?.()` usage.

- [x] **Step 2: Update README current capabilities**

Add default slots to the component capability list and remove `slots` from the candidate API list if present.

- [x] **Step 3: Add project log entry and index row**

Record changed files and validation results.

### Task 4: Validate

**Files:**

- No source edits expected.

- [x] **Step 1: Run targeted tests**

Run: `pnpm test tests/unit/component/component.test.ts`

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [x] **Step 3: Run package quality gate**

Run: `pnpm quality`

Expected: PASS.

- [x] **Step 4: Run format check**

Run: `pnpm format:check`

Expected: PASS.

## Plan Self-Review

- Spec coverage: default slot rendering, empty children fallback, and update behavior are covered by tests and implementation steps.
- Placeholder scan: no placeholders remain.
- Type consistency: `Slot`, `Slots`, `VNodeChildren`, and `ComponentSetupContext.slots` are used consistently.
- Commit steps: omitted because the current project directory is not a Git repository.
