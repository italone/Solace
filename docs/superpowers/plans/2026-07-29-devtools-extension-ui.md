# DevTools Browser Extension UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser DevTools extension UI that shows a filterable Solace event timeline on top of `@italone/solace/devtools` without changing runtime event payloads.

**Architecture:** Keep the runtime contract frozen and move all UI behavior into an extension app that consumes only the public DevTools subpath. Use a page bridge to forward serialized events into a session recorder, then render the panel from local state. Keep SSR/SSG/hydration visualization out of scope for this first panel and make the UI operate on the existing component, scheduler, reactivity, renderer, and store summaries only.

**Tech Stack:** TypeScript, Solace runtime, Vite, Rollup, Vitest, Playwright, Chrome extension manifest v3, pnpm, Markdown, Prettier.

---

## File Structure

- Create `examples/devtools-extension/manifest.json`: extension metadata and panel wiring.
- Create `examples/devtools-extension/index.html`: local preview entry page.
- Create `examples/devtools-extension/devtools.html`: DevTools page entry.
- Create `examples/devtools-extension/panel.html`: extension panel entry page.
- Create `examples/devtools-extension/src/devtools-page.ts`: DevTools panel registration.
- Create `examples/devtools-extension/src/background.ts`: extension background message relay.
- Create `examples/devtools-extension/src/content-script.ts`: inspected-page bridge injection.
- Create `examples/devtools-extension/src/bridge.ts`: serialized event forwarding helpers.
- Create `examples/devtools-extension/src/panel/main.tsx`: Solace app root for the panel.
- Create `examples/devtools-extension/src/panel/state.ts`: timeline, filters, pause, clear, and limit state.
- Create `examples/devtools-extension/src/panel/components.tsx`: timeline list, detail pane, and control bar.
- Create `examples/devtools-extension/src/panel/styles.css`: restrained panel styling.
- Create `examples/devtools-extension/src/panel/transport.ts`: panel runtime transport and local smoke fallback.
- Create `examples/devtools-extension/vite.config.ts`: panel build config for local development.
- Modify `src/devtools/events.ts`: install the non-exported page-local DevTools hook used by the classic-script bridge.
- Modify `package.json`: add `dev:devtools-extension`, `build:devtools-extension`, and `test:e2e:devtools-extension`.
- Modify `playwright.config.ts`: keep the default e2e suite independent from the extension preview.
- Create `playwright.devtools-extension.config.ts`: add web server entries for the extension smoke.
- Create `tests/unit/devtools-extension/state.test.ts`: reducer and filter coverage.
- Create `tests/unit/devtools-extension/panel.test.ts`: panel rendering coverage.
- Create `tests/integration/devtools-extension-bridge.test.ts`: bridge and recorder relay coverage.
- Create `tests/e2e/devtools-extension.spec.ts`: browser smoke for the panel workflow.
- Modify `docs/devtools.md`: remove the old "do not implement a UI yet" recommendation and describe the first panel scope.
- Modify `docs/package-usage.md`: note the extension UI as the next consumer-facing layer after the public subpath.
- Modify `docs/roadmap.md`: move the extension UI from planned to in-progress once the implementation lands.
- Modify `docs/project-status.md`: record the DevTools panel as implemented after validation.
- Modify `docs/project-status.zh-CN.md`: mirror the status update in Chinese.
- Modify `readme.md`: update the top-level feature summary and future work note.
- Add `solace-project-log/solace-entries/2026-07-29-001-devtools-extension-ui.md`: record the implementation.
- Modify `solace-project-log/index.md`: add the 2026-07-29 `001` row.

---

### Task 1: Scaffold The Extension App And Panel State

**Files:**

- Create: `examples/devtools-extension/manifest.json`
- Create: `examples/devtools-extension/index.html`
- Create: `examples/devtools-extension/vite.config.ts`
- Create: `examples/devtools-extension/src/panel/main.tsx`
- Create: `examples/devtools-extension/src/panel/state.ts`
- Create: `tests/unit/devtools-extension/state.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write the failing panel-state tests**

Create tests that assert the panel state layer can:

- Normalize incoming `DevtoolsEvent` items into timeline rows with a timestamp and compact summary.
- Filter rows by family: `component`, `scheduler`, `reactivity`, `renderer`, `store`.
- Preserve chronological ordering after repeated inserts.
- Toggle pause/resume without losing the current event buffer.
- Apply a numeric recorder limit by trimming the oldest buffered rows first.

Use a shape like this in the test file:

```ts
expect(filterTimeline(rows, { family: "component" }).map((row) => row.event.type)).toEqual([
  "component:mount",
  "component:update",
]);
```

- [x] **Step 2: Run the focused tests**

Run:

```bash
pnpm vitest run tests/unit/devtools-extension/state.test.ts
```

Expected: the new tests fail because the panel state layer does not exist yet.

- [x] **Step 3: Implement the panel state model**

Add a small state module that owns:

- `paused`
- `limit`
- `filter`
- `selectedEventId`
- `events`

Use the existing `DevtoolsEvent` union as the only event input. Do not add derived runtime objects, raw payload expansion, or SSR/hydration-specific rows.

- [x] **Step 4: Add the extension app scripts**

Add scripts for panel development, panel build, and the extension browser smoke so the new app can be run and validated without changing the root package exports.

- [x] **Step 5: Verify the state layer**

Run:

```bash
pnpm vitest run tests/unit/devtools-extension/state.test.ts
pnpm exec prettier --write examples/devtools-extension/manifest.json examples/devtools-extension/index.html examples/devtools-extension/vite.config.ts examples/devtools-extension/src/panel/main.tsx examples/devtools-extension/src/panel/state.ts tests/unit/devtools-extension/state.test.ts
```

Expected: the state tests pass and the new example files format cleanly.

- [x] **Step 6: Commit**

Run:

```bash
git add examples/devtools-extension package.json tests/unit/devtools-extension/state.test.ts
git commit -m "feat: scaffold devtools extension panel"
```

Expected: one scaffold commit.

---

### Task 2: Add The Bridge And Session Relay

**Files:**

- Create: `examples/devtools-extension/src/background.ts`
- Create: `examples/devtools-extension/src/content-script.ts`
- Create: `examples/devtools-extension/src/bridge.ts`
- Create: `tests/integration/devtools-extension-bridge.test.ts`

- [x] **Step 1: Write the failing bridge tests**

Add tests that prove the bridge:

- Subscribes through `@italone/solace/devtools` only.
- Relays serialized `DevtoolsEvent` payloads without raw DOM nodes, VNodes, or reactive targets.
- Keeps event capture local to the browser session.
- Stops forwarding when paused or disconnected.

Use an assertion shape like this:

```ts
expect(messages).toEqual([
  { type: "devtools:event", event: { type: "component:mount", id: 1, name: "Counter" } },
]);
```

- [x] **Step 2: Run the focused integration test**

Run:

```bash
pnpm vitest run tests/integration/devtools-extension-bridge.test.ts
```

Expected: fails before the bridge and relay helpers exist.

- [x] **Step 3: Implement the bridge**

Implement a message relay with three responsibilities:

- Inject a page bridge into the inspected page.
- Subscribe to `onDevtoolsEvent()` or `createDevtoolsRecorder()` at the page boundary only.
- Forward serialized events into the extension background/panel transport.

Keep the bridge agnostic about runtime internals. It should never inspect component instances, reactive targets, or DOM state.

- [x] **Step 4: Verify the bridge**

Run:

```bash
pnpm vitest run tests/integration/devtools-extension-bridge.test.ts
pnpm quality
```

Expected: the bridge test passes and the root quality gate still passes.

- [x] **Step 5: Commit**

Run:

```bash
git add examples/devtools-extension/src/background.ts examples/devtools-extension/src/content-script.ts examples/devtools-extension/src/bridge.ts tests/integration/devtools-extension-bridge.test.ts
git commit -m "feat: relay devtools events into the extension"
```

Expected: one bridge commit.

---

### Task 3: Build The Timeline Panel UI

**Files:**

- Create: `examples/devtools-extension/src/panel/components.tsx`
- Create: `examples/devtools-extension/src/panel/styles.css`
- Create: `tests/unit/devtools-extension/panel.test.ts`
- Modify: `examples/devtools-extension/src/panel/main.tsx`
- Modify: `tests/unit/devtools-extension/state.test.ts`

- [x] **Step 1: Add panel rendering tests**

Add tests that assert the panel renders:

- A timeline list.
- A family filter row.
- A pause/resume control.
- A clear control.
- A selected-event details pane.
- A recorder limit control.

The detail pane should display the serialized payload exactly as received. The tests should also assert that the panel does not render hidden fields that are not present in `DevtoolsEvent`.

- [x] **Step 2: Run the focused panel tests**

Run:

```bash
pnpm vitest run tests/unit/devtools-extension/state.test.ts tests/unit/devtools-extension/panel.test.ts
```

Expected: panel tests fail until the components exist.

- [x] **Step 3: Implement the panel UI**

Build the panel as a small Solace app with:

- A compact event timeline ordered by arrival time.
- Family filters for `component`, `scheduler`, `reactivity`, `renderer`, and `store`.
- Pause/resume so the current capture window can be frozen.
- Clear so the current session view can be reset.
- Details so the selected event can be inspected verbatim.
- Limit control so capture size stays bounded.

Use restrained styling and keep the panel dense and utilitarian. Do not add charts, trees, flame graphs, hydration views, or hidden-value inspection.

- [x] **Step 4: Verify the panel**

Run:

```bash
pnpm vitest run tests/unit/devtools-extension/state.test.ts tests/unit/devtools-extension/panel.test.ts
pnpm build:devtools-extension
```

Expected: the Solace panel builds successfully and the tests pass.

- [x] **Step 5: Commit**

Run:

```bash
git add examples/devtools-extension/src/panel/main.tsx examples/devtools-extension/src/panel/components.tsx examples/devtools-extension/src/panel/styles.css tests/unit/devtools-extension/state.test.ts tests/unit/devtools-extension/panel.test.ts
git commit -m "feat: build devtools timeline panel"
```

Expected: one panel commit.

---

### Task 4: Add Smoke Coverage And Update Docs

**Files:**

- Create: `tests/e2e/devtools-extension.spec.ts`
- Modify: `playwright.config.ts`
- Create: `playwright.devtools-extension.config.ts`
- Modify: `docs/devtools.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `readme.md`
- Add: `solace-project-log/solace-entries/2026-07-29-001-devtools-extension-ui.md`
- Modify: `solace-project-log/index.md`

- [x] **Step 1: Write the browser smoke**

Add a Playwright smoke that:

- Opens the extension panel.
- Drives an example app until it emits a visible timeline event.
- Confirms the new event appears in the list.
- Confirms filter toggles hide and reveal rows.
- Confirms pause/resume and clear update the capture window.

- [x] **Step 2: Run the smoke red-green**

Run:

```bash
pnpm test:e2e:devtools-extension
```

Expected: fails before the Playwright wiring and smoke page exist.

- [x] **Step 3: Update the docs**

Update the DevTools and status docs so they say the first browser extension panel is the timeline view, the UI consumes only `@italone/solace/devtools`, and SSR/SSG/hydration-specific panels remain deferred.

- [x] **Step 4: Verify delivery gates**

Run:

```bash
pnpm quality
pnpm test:e2e
pnpm test:e2e:devtools-extension
pnpm build:devtools-extension
```

Expected: the extension build, tests, and smoke all pass.

- [x] **Step 5: Commit**

Run:

```bash
git add tests/e2e/devtools-extension.spec.ts playwright.config.ts docs/devtools.md docs/package-usage.md docs/roadmap.md docs/project-status.md docs/project-status.zh-CN.md readme.md solace-project-log/solace-entries/2026-07-29-001-devtools-extension-ui.md solace-project-log/index.md
git commit -m "docs: add devtools extension timeline panel"
```

Expected: one docs and smoke commit.
