# JSX-First Framework Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition Solace around JSX/TSX-first function components and explicit runtime APIs,
while keeping `.solace` SFC support optional, narrow, and experimental.

**Architecture:** This is a documentation and narrow JSX type-surface pass. Keep SFC
runtime/compiler behavior unchanged, preserve existing public SFC entry point docs, update
README/status/roadmap/package usage wording so Solace's primary identity is TSX-first rather than
Vue-like SFC-first, and harden JSX `key` as a framework-level attribute for keyed children.
Also harden TSX component children as Solace default slot input without requiring component props to
declare `children`.
Also harden JSX `onXxx` component event handlers as framework attributes that align with Solace
`emit()`, accepting functions or arrays of functions.
Also cover TSX fragment shorthand as part of the public JSX authoring contract.

**Tech Stack:** Markdown documentation, pnpm, Prettier.

---

## File Map

- Modify `readme.md`: make project status, current scope, examples, package entry, and roadmap language JSX/TSX-first.
- Modify `readme.zh-CN.md`: mirror the English README positioning in Chinese.
- Modify `docs/api.md`: state the React-style function component and JSX/TSX primary path; keep SFC auxiliary.
- Modify `docs/api.zh-CN.md`: mirror the API positioning in Chinese.
- Modify `docs/examples.md`: align example docs with JSX/TSX-first and optional SFC wording.
- Modify `docs/package-usage.md`: keep SFC usage docs accurate, but label `.solace` as optional and experimental; add JSX/TSX-first framing.
- Modify `docs/project-status.md`: update completion map, strengths/risks, known gaps, and next work language.
- Modify `docs/project-status.zh-CN.md`: mirror the English project status positioning in Chinese.
- Modify `docs/roadmap.md`: move SFC expansion out of top priority and make TSX-first runtime ergonomics the near-term direction.
- Modify `src/jsx-runtime.ts` and `src/jsx-dev-runtime.ts`: keep runtime behavior unchanged while
  allowing string/number JSX keys and default slot children at the type boundary.
  Also allow `onXxx` component event handler attributes at the same framework boundary.
- Add `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`: cover JSX key type
  expectations.
- Modify `vitest.config.ts`: alias JSX runtime subpaths so TSX tests resolve the local source.
- Do not modify SFC implementation, examples, package exports, or unrelated runtime modules for
  this pass.

## Task 1: Update README Positioning

**Files:**

- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Update English README status and scope language**

  In `readme.md`, update the project status/current scope wording so:

  - Solace is described as JSX/TSX-first.
  - Function components and explicit runtime APIs are the primary authoring model.
  - `.solace` is described as optional, narrow, and experimental.
  - SFC is not presented as a primary future direction.

- [x] **Step 2: Update English README example/package wording**

  In `readme.md`, update the SFC example and package entry descriptions:

  - `SFC counter` should say experimental `.solace` helper, not primary compiler surface.
  - `@italone/solace/vite` should say experimental narrow `.solace` plugin.
  - Roadmap language should prioritize TSX-first runtime ergonomics, examples, and public API clarity.

- [x] **Step 3: Mirror README changes in Chinese**

## Task 1.5: Update API And Example Entry Points

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/examples.md`

- [x] **Step 1: Reframe API docs**

  In `docs/api.md` and `docs/api.zh-CN.md`, make the top-level API framing explicit:

  - React-style function components, JSX/TSX, and runtime APIs are the primary authoring path.
  - `.solace` tooling entries are optional experimental helpers.
  - The first `createApp()`, component, lifecycle, scheduler, and router examples use TSX, while
    `h()` remains documented as a rendering and server/VNode API.

- [x] **Step 2: Reframe examples docs**

  In `docs/examples.md`, describe examples as exercising the JSX/TSX-first runtime and keep the SFC
  example as an auxiliary compiler/Vite plugin smoke path.

  In `readme.zh-CN.md`, mirror the same positioning:

  - JSX/TSX-first.
  - 函数组件作为主要组件模型。
  - `.solace` 是可选、窄、实验性的辅助能力。
  - 路线图重点从 SFC 扩展转向 TSX-first runtime ergonomics。

## Task 2: Update Package Usage And Project Status

**Files:**

- Modify: `docs/package-usage.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`

- [x] **Step 1: Update package usage SFC section**

  In `docs/package-usage.md`, keep the existing `.solace` syntax details, but change the framing:

  - Add that JSX/TSX is the primary authoring path.
  - State `.solace` is optional and experimental.
  - Keep current limitations accurate: one template, optional script/style, no options, no query transforms, `map: null`.

- [x] **Step 2: Update English project status**

  In `docs/project-status.md`, update:

  - Overview to say Solace is a JSX/TSX-first beta runtime.
  - Completion table SFC row to say optional experimental compiler surface.
  - Strengths to emphasize function components, JSX/TSX, and explicit runtime APIs.
  - Risks to keep SFC narrowness visible without making it the framework direction.
  - Recommended next work to prioritize TSX-first runtime ergonomics and examples.

- [x] **Step 3: Mirror project status in Chinese**

  In `docs/project-status.zh-CN.md`, mirror the English status changes with equivalent Chinese wording.

## Task 3: Update Roadmap

**Files:**

- Modify: `docs/roadmap.md`

- [x] **Step 1: Reorder near-term roadmap**

  In `docs/roadmap.md`, make the first beta priority:

  - TSX-first runtime ergonomics.
  - Function component examples.
  - Public API clarity.
  - React-influenced authoring without React compatibility mode or wholesale React API cloning.

- [x] **Step 2: Reframe SFC roadmap item**

  Keep an SFC item, but make it explicitly about maintaining the existing optional experimental contract:

  - No syntax expansion in this pass.
  - No public compiler subpath.
  - No block attributes, custom blocks, plugin options, or query transforms unless separately designed.

## Task 4: Validate Documentation Positioning

**Files:**

- Check: `readme.md`
- Check: `readme.zh-CN.md`
- Check: `docs/package-usage.md`
- Check: `docs/project-status.md`
- Check: `docs/project-status.zh-CN.md`
- Check: `docs/roadmap.md`

- [x] **Step 1: Run format check**

  Run:

  ```bash
  pnpm format:check
  ```

  Expected: exits `0` and prints `All matched files use Prettier code style!`.

- [x] **Step 2: Confirm JSX/TSX-first language appears**

  Run:

  ```bash
  rg -n "JSX/TSX-first|TSX-first|JSX-first|函数组件|可选、窄、实验|optional, narrow, experimental" readme.md readme.zh-CN.md docs/package-usage.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md
  ```

  Expected: matches appear across README, package usage, project status, and roadmap docs.

- [x] **Step 3: Confirm runtime code was not touched**

  Run:

  ```bash
  git diff --name-only
  ```

  Expected: changed files include documentation plus the narrow JSX key type boundary. Existing
  unrelated pending changes from earlier turns may still appear: `package.json`, `readme.md`,
  `readme.zh-CN.md`, and `docs/examples.md`.

## Task 5: Harden JSX Key Type Boundary

**Files:**

- Modify: `src/jsx-runtime.ts`
- Modify: `src/jsx-dev-runtime.ts`
- Modify: `vitest.config.ts`
- Add: `tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx`

- [x] **Step 1: Add failing JSX key type contract**

  Add a TSX type contract proving function components can receive framework-level `key` without
  declaring `key` in their props, while required component props remain required.

- [x] **Step 2: Implement JSX key typing**

  Add `JSX.IntrinsicAttributes.key` and allow `string | number` key values through the JSX runtime
  helper type signatures.

- [x] **Step 2.5: Implement TSX default slot children typing**

  Allow JSX component children through `JSX.IntrinsicAttributes.children` so component tags can pass
  default slot children without declaring `children` in component props.

- [x] **Step 2.6: Implement JSX component event handler typing**

  Allow JSX `onXxx` framework attributes so TSX component usage can pass function or
  function-array event handlers consumed by Solace `emit()`, while rejecting non-function values.

- [x] **Step 2.7: Cover TSX fragment shorthand**

  Add a focused TSX runtime contract proving `<>...</>` renders without an extra wrapper.

- [x] **Step 3: Keep TSX tests runnable**

  Add Vitest aliases for `@italone/solace/jsx-runtime` and `@italone/solace/jsx-dev-runtime` so
  TSX tests resolve local source subpaths.

- [x] **Step 4: Validate JSX key boundary**

  Run:

  ```bash
  pnpm typecheck
  pnpm typecheck:jsxdev
  pnpm test tests/unit/renderer/jsx-runtime.test.ts tests/unit/renderer/jsx-runtime-public-contract-types.test.tsx
  ```

## Self-Review

- Spec coverage: The plan covers README, package usage, project status, roadmap, SFC demotion,
  TSX-first positioning, and the narrow JSX key type boundary.
- Placeholder scan: No unresolved placeholder markers are used.
- Type consistency: JSX key, default slot children, and `onXxx` component event handler typing are
  covered by typecheck and a focused TSX public contract test. The handler contract includes
  function, function-array, and non-function rejection cases. Fragment shorthand is covered by the
  same runtime contract.
