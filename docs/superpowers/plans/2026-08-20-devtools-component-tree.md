# DevTools Component Tree Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `parentId` to component DevTools events and render a live component tree tab in the example DevTools extension panel.

**Architecture:** The runtime event union (`src/devtools/events.ts`) gains `parentId: number | null` on `component:mount/update/unmount`; the renderer emit helper (`src/renderer/devtools-events.ts`) reads it from `instance.parent?.devtoolsId ?? null`. The extension panel keeps a `componentTree` map in `PanelState` that is updated incrementally in `recordDevtoolsEvent` (before timeline trimming, so the tree survives the event limit) and renders it as a new "Components" tab.

**Tech Stack:** TypeScript, Vitest (unit + integration), Playwright (Chromium extension e2e), Solace's own `h()`/`render`.

**Spec:** `docs/superpowers/specs/2026-08-20-devtools-component-tree-design.md`

---

### Task 1: Runtime event payload — `parentId` on component events

**Files:**

- Modify: `src/devtools/events.ts:1-4` (union), `src/devtools/events.ts:99-108` (serialize)
- Modify: `src/renderer/devtools-events.ts:12-16` (emit helper)
- Test: `tests/integration/devtools-payload-stability.test.ts:15-17` (allowed keys)
- Test: `tests/unit/devtools/devtools-events.test.ts`

- [x] **Step 1: Update the payload stability allowlist (failing test)**

In `tests/integration/devtools-payload-stability.test.ts`, change lines 15-17 to include `parentId`:

```ts
  "component:mount": ["id", "name", "parentId", "type"],
  "component:update": ["id", "name", "parentId", "type"],
  "component:unmount": ["id", "name", "parentId", "type"],
```

Then extend the same file's integrated test: after `render(h(Counter, { onChange }), container)`, add a nested child render and assert the child mount event carries the parent's id. Append inside the existing `it("serializes integrated runtime events...")` body, after the initial assertions on captured events:

```ts
const mountEvents = events.filter(
  (event): event is Extract<DevtoolsEvent, { type: "component:mount" }> =>
    event.type === "component:mount",
);
// Root component reports parentId null.
expect(mountEvents.length).toBeGreaterThanOrEqual(1);
expect(mountEvents[0]?.parentId).toBeNull();
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/devtools-payload-stability.test.ts`
Expected: FAIL — serialized component events lack `parentId`.

- [x] **Step 3: Update the union and serializer**

In `src/devtools/events.ts`, replace lines 2-4 with:

```ts
  | { type: "component:mount"; id: number; name: string; parentId: number | null }
  | { type: "component:update"; id: number; name: string; parentId: number | null }
  | { type: "component:unmount"; id: number; name: string; parentId: number | null }
```

In `serializeDevtoolsEvent` (lines 101-108), add `parentId` to the returned object:

```ts
    case "component:mount":
    case "component:update":
    case "component:unmount":
      return {
        type: event.type,
        id: event.id,
        name: event.name,
        parentId: event.parentId,
      };
```

- [x] **Step 4: Pass `parentId` at the emit site**

In `src/renderer/devtools-events.ts`, update `emitComponentDevtoolsEvent`:

```ts
emitDevtoolsEvent({
  type,
  id: instance.devtoolsId,
  name: getComponentDevtoolsName(instance),
  parentId: instance.parent?.devtoolsId ?? null,
});
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/integration/devtools-payload-stability.test.ts tests/unit/devtools`
Expected: PASS (existing unit tests referencing component event shapes may need `parentId` added to literals — add `parentId: null` or a real parent id where tests construct such events).

- [x] **Step 6: Commit**

```bash
git add src/devtools/events.ts src/renderer/devtools-events.ts tests/
git commit -m "feat: add parentId to component DevTools events"
```

---

### Task 2: Panel state — incremental component tree

**Files:**

- Modify: `examples/devtools-extension/src/panel/state.ts`
- Test: `tests/unit/devtools-extension/state.test.ts`

Note: the timeline trims events to `state.limit`, so the tree must be maintained as its own structure in `PanelState`, updated in `recordDevtoolsEvent` before trimming. Tree state also survives `clearTimeline`? No — Clear resets the whole capture window, tree included.

- [x] **Step 1: Write failing unit tests**

Append to `tests/unit/devtools-extension/state.test.ts`:

```ts
describe("component tree state", () => {
  it("builds a tree from mount events using parentId", () => {
    let state = createPanelState();
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 1,
      name: "App",
      parentId: null,
    });
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 2,
      name: "Child",
      parentId: 1,
    });

    const nodes = getComponentTreeNodes(state);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ id: 1, name: "App", depth: 0 });
    expect(nodes[1]).toMatchObject({ id: 2, name: "Child", depth: 1 });
  });

  it("removes a subtree on unmount and keeps the tree after timeline trimming", () => {
    let state = createPanelState({ limit: 2 });
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 1,
      name: "App",
      parentId: null,
    });
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 2,
      name: "Child",
      parentId: 1,
    });
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 3,
      name: "Grandchild",
      parentId: 2,
    });
    // Limit 2 evicts the mount rows, but the tree must survive.
    state = recordDevtoolsEvent(state, {
      type: "store:action",
      name: "x",
      status: "success",
      durationMs: 1,
    });

    expect(state.events).toHaveLength(2);
    expect(getComponentTreeNodes(state)).toHaveLength(3);

    state = recordDevtoolsEvent(state, {
      type: "component:unmount",
      id: 2,
      name: "Child",
      parentId: 1,
    });
    const remaining = getComponentTreeNodes(state);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ id: 1, name: "App" });
  });

  it("marks updated nodes and clears the tree on Clear", () => {
    let state = createPanelState();
    state = recordDevtoolsEvent(state, {
      type: "component:mount",
      id: 1,
      name: "App",
      parentId: null,
    });
    state = recordDevtoolsEvent(state, {
      type: "component:update",
      id: 1,
      name: "App",
      parentId: null,
    });

    expect(getComponentTreeNodes(state)[0]?.lastUpdateEventId).toBeTypeOf("string");

    state = clearTimeline(state);
    expect(getComponentTreeNodes(state)).toHaveLength(0);
  });
});
```

Import `getComponentTreeNodes` (and existing helpers) from `../../../examples/devtools-extension/src/panel/state` following the file's existing import style.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/devtools-extension/state.test.ts`
Expected: FAIL — `getComponentTreeNodes` is not exported.

- [x] **Step 3: Implement tree state in `state.ts`**

Add types and state:

```ts
export interface ComponentTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  mountedEventId: string;
  lastUpdateEventId: string | null;
}

export interface ComponentTreeState {
  nodes: Map<number, ComponentTreeNode>;
  collapsed: Set<number>;
}
```

Add the collapse toggle (wired to the UI in Task 3):

```ts
export function toggleComponentNode(state: PanelState, nodeId: number): PanelState {
  const collapsed = new Set(state.componentTree.collapsed);
  if (collapsed.has(nodeId)) {
    collapsed.delete(nodeId);
  } else {
    collapsed.add(nodeId);
  }
  return { ...state, componentTree: { ...state.componentTree, collapsed } };
}
```

Extend `PanelState` with `componentTree: ComponentTreeState`. In `createPanelState` return `componentTree: { nodes: new Map(), collapsed: new Set() }`. In `clearTimeline`, return a fresh `componentTree` with empty nodes and collapsed sets (do not mutate the old state). `applyComponentTreeEvent` must preserve `collapsed` when it returns `{ nodes, collapsed: tree.collapsed }`.

In `recordDevtoolsEvent`, before building the trimmed rows, compute the next tree immutably:

```ts
function applyComponentTreeEvent(
  tree: ComponentTreeState,
  event: DevtoolsEvent,
  rowId: string,
): ComponentTreeState {
  if (
    event.type !== "component:mount" &&
    event.type !== "component:update" &&
    event.type !== "component:unmount"
  ) {
    return tree;
  }

  const nodes = new Map(tree.nodes);
  if (event.type === "component:mount") {
    nodes.set(event.id, {
      id: event.id,
      name: event.name,
      parentId: event.parentId,
      mountedEventId: rowId,
      lastUpdateEventId: null,
    });
  } else if (event.type === "component:update") {
    const existing = nodes.get(event.id);
    if (existing !== undefined) {
      nodes.set(event.id, { ...existing, lastUpdateEventId: rowId });
    }
  } else {
    removeSubtree(nodes, event.id);
  }

  return { nodes };
}

function removeSubtree(nodes: Map<number, ComponentTreeNode>, rootId: number): void {
  for (const [id, node] of nodes) {
    if (node.parentId === rootId) {
      removeSubtree(nodes, id);
    }
  }
  nodes.delete(rootId);
}
```

Call it inside `recordDevtoolsEvent` (note: paused state returns early, as today):

```ts
const componentTree = applyComponentTreeEvent(state.componentTree, event, row.id);
return {
  ...state,
  events: rows,
  selectedEventId,
  nextEventId: state.nextEventId + 1,
  componentTree,
};
```

(Construct `row` before this call so `row.id` is available.)

Add the render-order accessor:

```ts
export function getComponentTreeNodes(state: PanelState): ComponentTreeNode[] {
  const byParent = new Map<number | null, ComponentTreeNode[]>();
  for (const node of state.componentTree.nodes.values()) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  const ordered: ComponentTreeNode[] = [];
  const walk = (parentId: number | null, depth: number): void => {
    for (const node of byParent.get(parentId) ?? []) {
      ordered.push({ ...node, depth });
      if (!state.componentTree.collapsed.has(node.id)) {
        walk(node.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return ordered;
}
```

Extend `ComponentTreeNode` with `depth?: number` (set only by `getComponentTreeNodes`) — or return `Array<ComponentTreeNode & { depth: number }>`; prefer the latter intersection type as the return type of `getComponentTreeNodes`.

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/devtools-extension`
Expected: PASS (existing tests constructing `PanelState` may need `componentTree` added where they build state literally — prefer routing them through `createPanelState`/`recordDevtoolsEvent`).

- [x] **Step 5: Commit**

```bash
git add examples/devtools-extension/src/panel/state.ts tests/unit/devtools-extension/state.test.ts
git commit -m "feat: track component tree in DevTools panel state"
```

---

### Task 3: Panel UI — Components tab

**Files:**

- Modify: `examples/devtools-extension/src/panel/components.tsx`
- Modify: `examples/devtools-extension/src/panel/main.tsx:19-22` (copy `componentTree` into reactive state)
- Modify: `examples/devtools-extension/src/panel/styles.css` (indentation + highlight styles)
- Test: `tests/unit/devtools-extension/panel.test.ts`

- [x] **Step 1: Write failing panel test**

Append to `tests/unit/devtools-extension/panel.test.ts`, following its existing render-into-container pattern:

```ts
it("renders the Components tab tree with update highlights", () => {
  let state = createPanelState();
  state = recordDevtoolsEvent(state, { type: "component:mount", id: 1, name: "App", parentId: null });
  state = recordDevtoolsEvent(state, { type: "component:mount", id: 2, name: "Child", parentId: 1 });
  state = recordDevtoolsEvent(state, { type: "component:update", id: 2, name: "Child", parentId: 1 });

  const container = document.createElement("div");
  render(<TimelinePanel state={state} onStateChange={() => undefined} />, container);

  const tabs = container.querySelector('[data-testid="panel-tabs"]');
  expect(tabs?.textContent).toContain("Components");

  tabs?.querySelectorAll("button")[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  const tree = container.querySelector('[data-testid="component-tree"]');
  expect(tree?.textContent).toContain("App");
  expect(tree?.textContent).toContain("Child");
  expect(tree?.querySelector(".component-node-updated")).not.toBeNull();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/devtools-extension/panel.test.ts`
Expected: FAIL — no "Components" tab.

- [x] **Step 3: Implement the tab and tree view**

In `state.ts`, extend `PanelView` to `"timeline" | "store" | "components"`. In `components.tsx`:

- Change the tab array to `(["timeline", "components", "store"] as const)` and label mapping: `view === "timeline" ? "Timeline" : view === "components" ? "Components" : "Store"`.
- Import `getComponentTreeNodes` from `./state` and add, alongside the store pane branch:

```tsx
export function ComponentTree(props: {
  state: PanelState;
  onStateChange(nextState: PanelState): void;
}) {
  return () => {
    const nodes = getComponentTreeNodes(props.state);
    return h(
      "ol",
      { class: "component-tree", "data-testid": "component-tree", "aria-label": "Component tree" },
      nodes.map((node) =>
        h(
          "li",
          {
            key: `component-${node.id}`,
            class:
              node.lastUpdateEventId !== null
                ? "component-node component-node-updated"
                : "component-node",
            style: { paddingLeft: `${node.depth * 16}px` },
          },
          h(
            "button",
            {
              class: "component-node-toggle",
              type: "button",
              "aria-expanded": String(!props.state.componentTree.collapsed.has(node.id)),
              onClick: () => props.onStateChange(toggleComponentNode(props.state, node.id)),
            },
            `${node.name} #${node.id}`,
          ),
        ),
      ),
    );
  };
}
```

- In `TimelinePanel`, add the branch `state.view === "components"` rendering `h("section", { class: "tree-pane", "aria-label": "Component tree" }, [ComponentTree({ state })])`.

In `main.tsx` `replacePanelState`, add `panelState.componentTree = nextState.componentTree;` next to the other field copies.

In `styles.css` add:

```css
.component-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--panel-font, monospace);
}
.component-node {
  padding-block: 2px;
}
.component-node-updated {
  background: rgba(255, 191, 0, 0.25);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/devtools-extension`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add examples/devtools-extension/src/panel tests/unit/devtools-extension/panel.test.ts
git commit -m "feat: add Components tree tab to DevTools panel"
```

---

### Task 4: Extension e2e test

**Files:**

- Test: `tests/e2e/devtools-extension-component-tree.spec.ts`

- [x] **Step 1: Write the e2e test**

Model on `tests/e2e/devtools-extension-store-timeline.spec.ts` (panel relayed via `window.postMessage` with `{ type: "devtools:event", event }` on `http://127.0.0.1:6177/panel.html`):

```ts
import { expect, test } from "@playwright/test";

test("panel Components tab renders a relayed component tree with updates", async ({ browser }) => {
  const page = await browser.newPage();

  await page.goto("http://127.0.0.1:6177/panel.html", { waitUntil: "commit" });
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="panel-tabs"]')),
    undefined,
    { timeout: 20000 },
  );

  const relay = (event: Record<string, unknown>) =>
    page.evaluate((payload) => {
      window.postMessage({ type: "devtools:event", event: payload }, window.location.origin);
    }, event);

  await relay({ type: "component:mount", id: 1, name: "App", parentId: null });
  await relay({ type: "component:mount", id: 2, name: "Child", parentId: 1 });
  await relay({ type: "component:mount", id: 3, name: "Grandchild", parentId: 2 });
  await relay({ type: "component:update", id: 2, name: "Child", parentId: 1 });

  await page.getByTestId("panel-tabs").getByRole("button", { name: "Components" }).click();
  const tree = page.getByTestId("component-tree");
  await expect(tree).toContainText("App #1");
  await expect(tree).toContainText("Child #2");
  await expect(tree).toContainText("Grandchild #3");
  await expect(tree.locator(".component-node-updated")).toHaveCount(1);

  await relay({ type: "component:unmount", id: 2, name: "Child", parentId: 1 });
  await expect(tree).not.toContainText("Child #2");
  await expect(tree).not.toContainText("Grandchild #3");
  await expect(tree).toContainText("App #1");

  await page.close();
});
```

Note: this test is Chromium-only by existing project convention — if the other extension specs rely on a projects filter, match their configuration (check `playwright.devtools-extension.config.ts` before running).

- [x] **Step 2: Run the e2e to verify it passes**

Run: `pnpm test:e2e:devtools-extension`
Expected: PASS including the new test (existing 4 + 1 new).

- [x] **Step 3: Commit**

```bash
git add tests/e2e/devtools-extension-component-tree.spec.ts
git commit -m "test: cover DevTools panel component tree e2e"
```

---

### Task 5: Docs, project log, and quality gates

**Files:**

- Modify: `docs/devtools.md` (event union ~line 72, panel section)
- Modify: `docs/project-status.md`, `docs/project-status.zh-CN.md` (DevTools row / next-steps note)
- Create: `solace-project-log/` entry following existing naming convention (check directory for the current date-prefix pattern)

- [x] **Step 1: Update `docs/devtools.md`**

In the `DevtoolsEvent` union code block, update the three component variants to include `parentId: number | null`. In the "Browser Extension Panel" section, add to the initial panel scope list:

```markdown
- A Components tab that incrementally builds the inspected page's component tree from
  `component:mount`/`update`/`unmount` events, highlighting updated nodes and pruning unmounted
  subtrees. The tree is derived from event summaries only (`id`, `name`, `parentId`); it does not
  read component instances, props, state, or DOM.
```

- [x] **Step 2: Update project status docs**

In `docs/project-status.md` Completion Map "DevTools subpath" row and the 2026-08-20 baseline paragraph, note that the example panel now includes a Components tree tab built from `parentId`-extended component events, with the payload policy unchanged. Mirror the same note in `docs/project-status.zh-CN.md`. Keep all release/coverage claims unchanged (only the full gate run in Task 5 Step 4 can back new numbers).

- [x] **Step 3: Add project log entry**

Create `solace-project-log/2026-08-20-devtools-component-tree.md` (match an existing entry's structure): what changed (runtime payload field, panel tab, tests), what gates ran, what was not changed (no manifest/origin widening, no props/state, no new runtime exports).

- [x] **Step 4: Run quality gates**

Run: `pnpm quality`
Expected: PASS (format, typecheck, jsxdev typecheck, lint, unit + integration tests).

Run: `pnpm test:e2e:devtools-extension`
Expected: PASS 5/5.

- [x] **Step 5: Commit and push**

```bash
git add docs/ solace-project-log/
git commit -m "docs: document DevTools component tree inspector"
git push origin main
```

(Pushing requires the branch to be synchronized; confirm `git status --short --branch` is clean and not ahead before pushing.)
