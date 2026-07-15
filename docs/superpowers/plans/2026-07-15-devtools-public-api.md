# DevTools Public API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a narrow `solace/devtools` public integration subpath while keeping DevTools internals out of the package root and out of the public subpath.

**Architecture:** Add a public barrel at `src/devtools/index.ts` that re-exports only listener and recorder APIs from the existing event bus. Add `./devtools` to the package export map and Rollup entry maps so ESM, CJS, and type artifacts are generated consistently. Update package boundary tests, packed consumer smoke, DevTools docs, package usage docs, README notes, and the project log.

**Tech Stack:** TypeScript, Rollup, package exports, Vitest, Node ESM/CJS interop, pnpm, Markdown, Prettier.

---

## File Structure

- Modify `tests/integration/package-exports.test.ts`: change the previous missing `solace/devtools` assertion into public ESM/CJS subpath assertions and keep root negative assertions.
- Create `src/devtools/index.ts`: public DevTools barrel with only approved exports.
- Modify `package.json`: add the `./devtools` export map.
- Modify `rollup.config.mjs`: add `devtools` to both JavaScript and declaration input maps.
- Modify `scripts/package-consumer-smoke.mjs`: verify packed consumer TypeScript, ESM, and CJS imports for `solace/devtools`.
- Modify `docs/devtools.md`: document the public subpath, private internals, lifecycle, and production boundary.
- Modify `docs/package-usage.md`: list `solace/devtools` as a public entry point.
- Modify `readme.md`: update the DevTools line and current public entry notes if they mention only evaluation.
- Add `solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md`: record this change after validation.
- Modify `solace-project-log/index.md`: add the `2026-07-15` `002` row after validation.

The workspace is not currently a Git repository, so omit commit steps unless Git is initialized before execution.

---

### Task 1: Add Failing Package Boundary Tests

**Files:**

- Modify: `tests/integration/package-exports.test.ts`

- [ ] **Step 1: Replace the missing subpath assertion with public ESM subpath assertions**

Replace this test:

```ts
it("does not expose an internal DevTools package subpath", async () => {
  const subpath = "solace/devtools";

  await expect(import(subpath)).rejects.toThrow();
});
```

with:

```ts
it("exports the public DevTools subpath without internal emit helpers", async () => {
  const devtools = await import("solace/devtools");

  expect(devtools).toMatchObject({
    createDevtoolsRecorder: expect.any(Function),
    onDevtoolsEvent: expect.any(Function),
  });
  expect(devtools).not.toHaveProperty("clearDevtoolsListeners");
  expect(devtools).not.toHaveProperty("emitDevtoolsEvent");
  expect(devtools).not.toHaveProperty("hasDevtoolsListeners");
  expect(devtools).not.toHaveProperty("serializeDevtoolsEvent");
});
```

- [ ] **Step 2: Extend the CommonJS package exports test**

In the `"supports CommonJS package exports"` test, add the DevTools require:

```ts
const devtools = require("solace/devtools") as Record<string, unknown>;
```

Then add these assertions after the existing runtime assertions:

```ts
expect(devtools.createDevtoolsRecorder).toEqual(expect.any(Function));
expect(devtools.onDevtoolsEvent).toEqual(expect.any(Function));
expect(devtools.clearDevtoolsListeners).toBeUndefined();
expect(devtools.emitDevtoolsEvent).toBeUndefined();
expect(devtools.hasDevtoolsListeners).toBeUndefined();
expect(devtools.serializeDevtoolsEvent).toBeUndefined();
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm test:package
```

Expected: fails because `solace/devtools` is not currently exported from `package.json`.

---

### Task 2: Add The Public DevTools Build Entry

**Files:**

- Create: `src/devtools/index.ts`
- Modify: `package.json`
- Modify: `rollup.config.mjs`

- [ ] **Step 1: Create the public DevTools barrel**

Create `src/devtools/index.ts`:

```ts
export { createDevtoolsRecorder, onDevtoolsEvent } from "./events";
export type {
  DevtoolsEvent,
  DevtoolsEventListener,
  DevtoolsRecorder,
  DevtoolsRecorderOptions,
} from "./events";
```

- [ ] **Step 2: Add the package export map**

In `package.json`, add `./devtools` between the JSX runtime exports and `./package.json`:

```json
    "./devtools": {
      "types": "./dist/devtools.d.ts",
      "import": "./dist/devtools.js",
      "require": "./dist/devtools.cjs"
    },
```

The surrounding `exports` object should become:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./jsx-runtime": {
      "types": "./dist/jsx-runtime.d.ts",
      "import": "./dist/jsx-runtime.js",
      "require": "./dist/jsx-runtime.cjs"
    },
    "./jsx-dev-runtime": {
      "types": "./dist/jsx-dev-runtime.d.ts",
      "import": "./dist/jsx-dev-runtime.js",
      "require": "./dist/jsx-dev-runtime.cjs"
    },
    "./devtools": {
      "types": "./dist/devtools.d.ts",
      "import": "./dist/devtools.js",
      "require": "./dist/devtools.cjs"
    },
    "./package.json": "./package.json"
  },
```

- [ ] **Step 3: Add Rollup JavaScript input**

In the first `input` map in `rollup.config.mjs`, add:

```js
      devtools: "src/devtools/index.ts",
```

The map should become:

```js
    input: {
      index: "src/index.ts",
      "jsx-runtime": "src/jsx-runtime.ts",
      "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
      devtools: "src/devtools/index.ts",
    },
```

- [ ] **Step 4: Add Rollup declaration input**

In the second `input` map in `rollup.config.mjs`, add the same entry:

```js
      devtools: "src/devtools/index.ts",
```

The map should become:

```js
    input: {
      index: "src/index.ts",
      "jsx-runtime": "src/jsx-runtime.ts",
      "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
      devtools: "src/devtools/index.ts",
    },
```

- [ ] **Step 5: Verify GREEN for package exports**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0 and verifies `dist/devtools.js`, `dist/devtools.cjs`, and `dist/devtools.d.ts` through package subpath imports.

---

### Task 3: Extend Packed Consumer Smoke

**Files:**

- Modify: `scripts/package-consumer-smoke.mjs`

- [ ] **Step 1: Add public DevTools imports to the generated TypeScript consumer**

Inside the generated `src/main.tsx` template string, after the root Solace imports, add:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "solace/devtools";
import type { DevtoolsEvent } from "solace/devtools";
```

- [ ] **Step 2: Add a typechecked public DevTools usage snippet**

Inside the same generated `src/main.tsx` template string, after `type CounterState = { count: number };`, add:

```ts
const observedDevtoolsEvents: DevtoolsEvent[] = [];
const stopDevtoolsListener = onDevtoolsEvent((event) => {
  observedDevtoolsEvents.push(event);
});
const devtoolsRecorder = createDevtoolsRecorder({ limit: 2 });
devtoolsRecorder.clear();
devtoolsRecorder.stop();
stopDevtoolsListener();
```

This verifies the public API and types without requiring a public event emitter.

- [ ] **Step 3: Extend the ESM runtime smoke command**

Replace the ESM `node --input-type=module -e` string with:

```js
"const api = await import('solace'); const runtime = await import('solace/jsx-runtime'); const dev = await import('solace/jsx-dev-runtime'); const devtools = await import('solace/devtools'); if (!api.createApp || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent) process.exit(1);";
```

- [ ] **Step 4: Extend the CJS runtime smoke command**

Replace the CJS `node -e` string with:

```js
"const api = require('solace'); const runtime = require('solace/jsx-runtime'); const dev = require('solace/jsx-dev-runtime'); const devtools = require('solace/devtools'); if (!api.createApp || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent) process.exit(1);";
```

- [ ] **Step 5: Verify packed consumer smoke**

Run:

```bash
pnpm package:smoke
```

Expected: exits with code 0 and prints `package consumer smoke passed`.

---

### Task 4: Update DevTools And Package Docs

**Files:**

- Modify: `docs/devtools.md`
- Modify: `docs/package-usage.md`
- Modify: `readme.md`

- [ ] **Step 1: Update DevTools overview**

In `docs/devtools.md`, replace the opening paragraph:

```md
Solace does not currently expose DevTools hooks. This document evaluates candidate capabilities and safe boundaries
for future instrumentation.
```

with:

```md
Solace exposes a narrow public DevTools integration surface through `solace/devtools`. This document records the
public lifecycle, private runtime boundary, and safe constraints for future instrumentation.
```

- [ ] **Step 2: Update DevTools non-goals**

Replace:

```md
- No public DevTools API yet.
```

with:

```md
- No browser extension, custom panel, network transport, storage persistence, or automatic telemetry in the current phase.
```

- [ ] **Step 3: Add public API section**

After `## Non-Goals`, add:

````md
## Public API

DevTools integrations should import from the `solace/devtools` subpath:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "solace/devtools";
import type { DevtoolsEvent } from "solace/devtools";
```

The public subpath exports listener and recorder APIs only. It does not export emit helpers, listener-state helpers,
global cleanup helpers, serializers, DOM nodes, VNode trees, component instances, props, reactive targets, store state,
action arguments, or action results.
````

- [ ] **Step 4: Update hook boundary wording**

In `docs/devtools.md`, replace:

```md
Solace now has an internal event bus in `src/devtools/events.ts`. It is intentionally not exported from the package root
and is wired only into selected internal runtime modules.
```

with:

```md
Solace has an internal event bus in `src/devtools/events.ts`. Runtime modules emit through that internal bus, while
public integrations subscribe through `solace/devtools`. The package root intentionally does not export DevTools APIs.
```

- [ ] **Step 5: Update recorder wording**

Replace the paragraph that starts with `` `createDevtoolsRecorder()` is also internal.`` with:

```md
`createDevtoolsRecorder()` is public through `solace/devtools`. It installs a listener, stores serialized events in
memory, exposes `snapshot()` for a copy of collected events, exposes `clear()` to reset the current capture window, and
exposes `stop()` to remove the listener. Pass `{ limit }` to keep only the latest N events in memory. It does not
persist data, send data over the network, write to storage, or install third-party scripts.
```

- [ ] **Step 6: Update roadmap**

In `docs/devtools.md`, replace roadmap item 12:

```md
12. **Public package boundary guard**: package exports tests verify DevTools internals are not available from root or subpath exports.
```

with:

```md
12. **Public package boundary guard**: package exports tests verify DevTools internals are not available from the package root.
13. **Public DevTools subpath**: `solace/devtools` exposes listener and recorder APIs without internal emit helpers.
```

Then renumber the previous item 13 to item 14.

- [ ] **Step 7: Update recommendation**

Replace the recommendation:

```md
Do not implement a DevTools UI yet. The next step should design public API lifecycle and production-build boundaries
before adding a public integration surface or browser extension.
```

with:

```md
Do not implement a DevTools UI yet. The public `solace/devtools` subpath is a low-level integration surface for examples,
tests, and future inspector tooling. Build a browser extension or custom panel only after more payloads prove stable in
real examples.
```

- [ ] **Step 8: Update package usage entry points**

In `docs/package-usage.md`, under `## Public Entry Points`, add:

```md
- `solace/devtools`: low-level DevTools listener and recorder APIs.
```

after the `solace/jsx-dev-runtime` bullet.

- [ ] **Step 9: Update README DevTools summary**

In `readme.md`, replace:

```md
更多示例说明见 [`docs/examples.md`](./docs/examples.md)。DevTools 候选能力评估见 [`docs/devtools.md`](./docs/devtools.md)。
```

with:

```md
更多示例说明见 [`docs/examples.md`](./docs/examples.md)。DevTools public subpath 和安全边界见 [`docs/devtools.md`](./docs/devtools.md)。
```

Replace:

```md
当前 README 中列出的候选 API 已完成首轮 root export 收口；后续可继续评估 DevTools。
```

with:

```md
当前 README 中列出的候选 API 已完成首轮 root export 收口；DevTools 通过 `solace/devtools` 子路径提供低层集成入口。
```

Replace the DevTools bullet under `## 14. 后续建议`:

```md
- 根据 [`docs/devtools.md`](./docs/devtools.md) 的评估结果，优先设计 development-only DevTools event model，再决定是否实现调试 hook。
```

with:

```md
- 根据 [`docs/devtools.md`](./docs/devtools.md) 的边界继续扩展 DevTools summary payload；浏览器扩展或可视化面板应在更多真实示例验证后再实现。
```

- [ ] **Step 10: Format documentation**

Run:

```bash
pnpm exec prettier --write docs/devtools.md docs/package-usage.md readme.md
```

Expected: exits with code 0.

---

### Task 5: Add Project Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add the project log entry after validation commands have run**

Create `solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md` with this structure, replacing each validation result row with the observed command result from Task 6:

```md
# 2026-07-15-002：新增 DevTools public subpath

## 基本信息

- 日期：2026-07-15
- 类型：包导出 / DevTools public API / 文档 / package smoke
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `solace/devtools` public subpath，暴露 DevTools listener、recorder 和相关类型。package root 继续不暴露
DevTools API，public subpath 也不暴露内部 emit、listener-state、clear 或 serializer helpers。

## 变动原因

DevTools internal recorder、payload stability smoke 和 public boundary guard 已完成。继续推进 DevTools 需要一个可验证的低层 public integration surface，同时保持 runtime internals 和隐私边界稳定。

## 影响范围

- 影响模块：package exports、Rollup 构建入口、DevTools public barrel、package consumer smoke、DevTools 文档、README、项目日志。
- 行为变化：新增 `solace/devtools` 子路径；无 listener 时 runtime 仍保持 DevTools dormant。
- 风险等级：中；涉及 package export map、ESM/CJS/type 产物一致性和 public API 边界。

## 涉及文件

| 文件                                                                      | 动作 | 说明                                      |
| ------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `src/devtools/index.ts`                                                   | 新增 | DevTools public barrel                    |
| `package.json`                                                            | 修改 | 新增 `./devtools` package export          |
| `rollup.config.mjs`                                                       | 修改 | 新增 devtools JS/CJS/type 构建入口        |
| `tests/integration/package-exports.test.ts`                               | 修改 | 验证 public subpath 和 private internals  |
| `scripts/package-consumer-smoke.mjs`                                      | 修改 | 验证 packed consumer 的 DevTools subpath  |
| `docs/devtools.md`                                                        | 修改 | 记录 public API lifecycle 和生产边界      |
| `docs/package-usage.md`                                                   | 修改 | 列出 `solace/devtools` public entry point |
| `readme.md`                                                               | 修改 | 更新 DevTools 当前状态和后续建议          |
| `docs/superpowers/specs/2026-07-15-devtools-public-api-design.md`         | 新增 | 记录设计                                  |
| `docs/superpowers/plans/2026-07-15-devtools-public-api.md`                | 新增 | 记录实施计划                              |
| `solace-project-log/index.md`                                             | 修改 | 追加 2026-07-15 日志索引                  |
| `solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md` | 新增 | 记录本次变更                              |

## 验证记录

| 验证项            | 命令或方式              | 结果 |
| ----------------- | ----------------------- | ---- |
| Package exports   | `pnpm test:package`     | 通过 |
| Package smoke     | `pnpm package:smoke`    | 通过 |
| Tests             | `pnpm test`             | 通过 |
| Typecheck         | `pnpm typecheck`        | 通过 |
| JSX dev typecheck | `pnpm typecheck:jsxdev` | 通过 |
| Lint              | `pnpm lint`             | 通过 |
| Build             | `pnpm build`            | 通过 |
| 格式检查          | `pnpm format:check`     | 通过 |

## 后续动作

- 后续 DevTools 扩展应继续通过 summary payload 暴露信息，避免输出 raw runtime objects、用户内容或敏感数据。
- 浏览器扩展或可视化面板应在更多真实示例验证后再实现。
```

- [ ] **Step 2: Add the log index row**

Under `## 2026-07-15` in `solace-project-log/index.md`, add this row after `001`:

```md
| 002 | 新增 DevTools public subpath | package exports、DevTools public API、文档、package smoke | `src/devtools/index.ts`, `package.json`, `rollup.config.mjs`, `tests/integration/package-exports.test.ts`, `scripts/package-consumer-smoke.mjs`, `docs/devtools.md`, `docs/package-usage.md`, `readme.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-002-devtools-public-api.md) |
```

- [ ] **Step 3: Format project log files**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md solace-project-log/solace-entries/2026-07-15-002-devtools-public-api.md docs/superpowers/plans/2026-07-15-devtools-public-api.md
```

Expected: exits with code 0.

---

### Task 6: Final Validation

**Files:**

- All touched files.

- [ ] **Step 1: Run package exports**

Run:

```bash
pnpm test:package
```

Expected: exits with code 0.

- [ ] **Step 2: Run package consumer smoke**

Run:

```bash
pnpm package:smoke
```

Expected: exits with code 0.

- [ ] **Step 3: Run default tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 4: Run TypeScript checks**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both commands exit with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0 and includes `dist/devtools.js`, `dist/devtools.cjs`, and `dist/devtools.d.ts`.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Inspect final public boundary**

Run:

```bash
pnpm test:package
```

Expected: package exports still pass after documentation and log formatting.
