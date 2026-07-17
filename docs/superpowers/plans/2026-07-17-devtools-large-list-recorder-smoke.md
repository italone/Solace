# DevTools Large List Recorder Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a large-list DevTools recorder smoke that validates public recorder payloads remain serializable and privacy-minimized during a 10,000-row keyed update.

**Architecture:** Add one integration test with an in-test large-list fixture, using the public DevTools barrel from `src/devtools/index.ts` and runtime APIs from `src/index.ts`. Keep runtime, package exports, and DevTools event shape unchanged unless the failing test exposes a real payload leak.

**Tech Stack:** TypeScript, Vitest, jsdom, Solace runtime APIs, Solace DevTools public barrel, pnpm, Prettier.

---

## File Structure

- Create `tests/integration/devtools-large-list-recorder-smoke.test.ts`: large-list recorder smoke using `createDevtoolsRecorder`, `reactive`, `h`, `render`, and `nextTick`.
- Modify `docs/devtools.md`: add one roadmap note that large-list recorder smoke validates payload stability in a high-volume keyed-list update.
- Add `solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md`: record implementation and validation.
- Modify `solace-project-log/index.md`: add row `011` under `2026-07-17`.

Do not modify `src/devtools/events.ts`, `src/devtools/index.ts`, `package.json`, Rollup config, or public package exports unless the RED test reveals an unsafe payload boundary that cannot be tested without a runtime fix.

---

### Task 1: Add The Failing Large-List Recorder Smoke

**Files:**

- Create: `tests/integration/devtools-large-list-recorder-smoke.test.ts`

- [ ] **Step 1: Create the test file**

Create `tests/integration/devtools-large-list-recorder-smoke.test.ts` with this content:

```ts
import { afterEach, describe, expect, it } from "vitest";

import { createDevtoolsRecorder } from "../../src/devtools/index";
import { clearDevtoolsListeners, type DevtoolsEvent } from "../../src/devtools/events";
import { h, nextTick, reactive, render } from "../../src/index";

const allowedKeysByType: Record<DevtoolsEvent["type"], string[]> = {
  "component:mount": ["id", "name", "type"],
  "component:update": ["id", "name", "type"],
  "component:unmount": ["id", "name", "type"],
  "component:emit": ["event", "handlerCount", "id", "name", "type"],
  "reactivity:trigger": [
    "effectCount",
    "keyType",
    "runEffects",
    "scheduledEffects",
    "targetType",
    "type",
  ],
  "renderer:element": ["operation", "tag", "type"],
  "scheduler:flush": ["dedupedJobs", "durationMs", "queuedJobs", "type"],
  "store:action": ["durationMs", "name", "status", "type"],
};

describe("devtools large-list recorder smoke", () => {
  afterEach(() => {
    clearDevtoolsListeners();
  });

  it("captures safe serialized summaries for a 10000 row keyed update", async () => {
    const recorder = createDevtoolsRecorder({ limit: 80 });
    const container = document.createElement("div");
    const state = reactive({ selected: 1 });
    const rows = Array.from({ length: 10_000 }, (_, index) => index + 1);
    const LargeList = () => () =>
      h(
        "section",
        null,
        rows.map((row) =>
          h(
            "p",
            {
              key: row,
              class: row === state.selected ? "selected" : "",
              "data-row": String(row),
            },
            row === state.selected ? `Row ${row} selected` : `Row ${row}`,
          ),
        ),
      );

    try {
      render(h(LargeList), container);
      recorder.clear();

      state.selected = 5000;
      await nextTick();

      expect(container.querySelector('[data-row="5000"]')?.textContent).toBe("Row 5000 selected");
      expect(container.querySelector('[data-row="1"]')?.textContent).toBe("Row 1");

      const snapshot = recorder.snapshot();
      expect(snapshot.length).toBeGreaterThan(0);
      expect(snapshot.some((event) => event.type === "scheduler:flush")).toBe(true);
      expect(
        snapshot.some((event) => event.type === "renderer:element" && event.operation === "update"),
      ).toBe(true);

      for (const event of snapshot) {
        expect(Object.keys(event).sort()).toEqual(allowedKeysByType[event.type].sort());
        expect(JSON.parse(JSON.stringify(event))).toEqual(event);

        for (const [key, value] of Object.entries(event)) {
          if (key === "type") {
            continue;
          }
          expect(typeof value).not.toBe("object");
          expect(typeof value).not.toBe("function");
        }

        const serialized = JSON.stringify(event);
        expect(serialized).not.toContain("Row 5000");
        expect(serialized).not.toContain("selected");
        expect(serialized).not.toContain("data-row");
        expect(event).not.toHaveProperty("target");
        expect(event).not.toHaveProperty("node");
        expect(event).not.toHaveProperty("vnode");
        expect(event).not.toHaveProperty("component");
        expect(event).not.toHaveProperty("props");
        expect(event).not.toHaveProperty("state");
        expect(event).not.toHaveProperty("args");
        expect(event).not.toHaveProperty("children");
      }
    } finally {
      recorder.stop();
    }
  });
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run:

```bash
pnpm vitest run tests/integration/devtools-large-list-recorder-smoke.test.ts
```

Expected: If current payload boundaries already satisfy this smoke, the test may pass immediately. Treat that as acceptable because this task adds missing coverage rather than forcing a runtime change. If it fails, the failure should be about missing broad update evidence or unsafe payload shape, not a TypeScript import error.

- [ ] **Step 3: Fix import or fixture mistakes only if RED errors before exercising behavior**

If the test errors because of a typo, fix only the typo. Keep imports limited to:

```ts
import { createDevtoolsRecorder } from "../../src/devtools/index";
import { clearDevtoolsListeners, type DevtoolsEvent } from "../../src/devtools/events";
import { h, nextTick, reactive, render } from "../../src/index";
```

Run the same command again until the test either passes or fails on payload/update behavior.

---

### Task 2: Apply Minimal Runtime Fix Only If The Smoke Exposes A Payload Leak

**Files:**

- Modify only if needed: `src/devtools/events.ts`
- Modify only if needed: runtime module that emits the unsafe event
- Test: `tests/integration/devtools-large-list-recorder-smoke.test.ts`
- Test: `tests/integration/devtools-payload-stability.test.ts`

- [ ] **Step 1: Inspect the first behavioral failure**

If Task 1 fails, read the first assertion failure:

- If allowed keys fail, identify which event type has extra keys.
- If JSON serialization fails, identify the non-serializable value.
- If a forbidden string appears, identify which event included user/list content.
- If no scheduler or renderer update appears, inspect whether the update did not schedule or the recorder limit dropped the event.

- [ ] **Step 2: Fix unsafe payloads at the serializer boundary**

If an event leaks raw data through `serializeDevtoolsEvent`, keep the serializer explicit. For example, a safe renderer event must remain:

```ts
case "renderer:element":
  return {
    type: event.type,
    operation: event.operation,
    tag: event.tag,
  };
```

Do not add fields such as `el`, `node`, `vnode`, `props`, `children`, `text`, `class`, `dataset`, `state`, or `args`.

- [ ] **Step 3: Fix missing broad update evidence without widening payloads**

If the only failure is that the recorder limit drops update-window events, increase the test limit from `80` to `160` in `tests/integration/devtools-large-list-recorder-smoke.test.ts`.

If no `renderer:element` update event is emitted, inspect `src/renderer/diff.ts` for the guarded `emitDevtoolsEvent` calls and ensure update operations still emit the documented summary:

```ts
emitDevtoolsEvent({
  type: "renderer:element",
  operation: "update",
  tag,
});
```

Do not emit DOM nodes, VNodes, props, class names, text, or dataset values.

- [ ] **Step 4: Run targeted tests after any fix**

Run:

```bash
pnpm vitest run tests/integration/devtools-large-list-recorder-smoke.test.ts
pnpm vitest run tests/integration/devtools-payload-stability.test.ts
```

Expected: both commands exit with code 0.

---

### Task 3: Document The New DevTools Smoke

**Files:**

- Modify: `docs/devtools.md`
- Add: `solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update DevTools roadmap**

In `docs/devtools.md`, add a new roadmap item after the bounded recorder captures item and before the public package boundary items:

```md
13. **Large-list recorder smoke**: a 10,000-row keyed update validates public recorder snapshots remain serialized summaries without DOM, VNode, raw state, or row data.
```

Renumber the following roadmap items by adding 1 to their current numbers.

- [ ] **Step 2: Add project log entry**

Create `solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md`:

```md
# 2026-07-17-011：补充 DevTools large-list recorder smoke

## 基本信息

- 日期：2026-07-17
- 类型：DevTools recorder smoke / integration test / docs / project log
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

新增 large-list 形态的 DevTools recorder smoke，验证 10,000 行 keyed update 后 public recorder snapshot 仍是 JSON-safe、privacy-minimized summary。

## 变动原因

todo-style recorder smoke 已覆盖小交互。近期 renderer keyed list 路径完成多轮性能优化，因此需要补一个真实大列表更新窗口的 DevTools payload 稳定性覆盖。

## 影响范围

- 影响模块：DevTools recorder integration test、DevTools 文档、项目日志。
- 行为变化：无 public API 扩展；如测试已通过，则无运行时代码变化。
- 风险等级：低；主要增加测试覆盖。

## 涉及文件

| 文件                                                                                     | 动作 | 说明                                    |
| ---------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `tests/integration/devtools-large-list-recorder-smoke.test.ts`                           | 新增 | 覆盖 large-list update recorder payload |
| `docs/devtools.md`                                                                       | 修改 | 记录 large-list recorder smoke roadmap  |
| `solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md` | 新增 | 记录本次变更                            |
| `solace-project-log/index.md`                                                            | 修改 | 追加 2026-07-17 日志索引                |

## 验证记录

| 验证项                    | 命令或方式                                                                     | 结果       |
| ------------------------- | ------------------------------------------------------------------------------ | ---------- |
| Large-list recorder smoke | `pnpm vitest run tests/integration/devtools-large-list-recorder-smoke.test.ts` | 待最终验证 |
| Payload stability         | `pnpm vitest run tests/integration/devtools-payload-stability.test.ts`         | 待最终验证 |
| Tests                     | `pnpm test`                                                                    | 待最终验证 |
| Typecheck                 | `pnpm typecheck`                                                               | 待最终验证 |
| Lint                      | `pnpm lint`                                                                    | 待最终验证 |
| Build                     | `pnpm build`                                                                   | 待最终验证 |
| 格式检查                  | `pnpm format:check`                                                            | 待最终验证 |
| Diff whitespace           | `git diff --check`                                                             | 待最终验证 |

## 后续动作

- 若继续扩展 DevTools，应继续优先选择真实示例 smoke，不扩大 public API 或暴露 raw runtime objects。
```

- [ ] **Step 3: Add project log index row**

In `solace-project-log/index.md`, add row `011` under `2026-07-17`:

```md
| 011 | 补充 DevTools large-list recorder smoke | DevTools recorder、integration test、文档、项目日志 | `tests/integration/devtools-large-list-recorder-smoke.test.ts`, `docs/devtools.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md) |
```

---

### Task 4: Validate And Commit

**Files:**

- All changed files

- [ ] **Step 1: Format touched Markdown and test files**

Run:

```bash
pnpm exec prettier --write tests/integration/devtools-large-list-recorder-smoke.test.ts docs/devtools.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted DevTools tests**

Run:

```bash
pnpm vitest run tests/integration/devtools-large-list-recorder-smoke.test.ts
pnpm vitest run tests/integration/devtools-payload-stability.test.ts
```

Expected: both commands exit with code 0.

- [ ] **Step 3: Run full default test suite**

Run:

```bash
pnpm test
```

Expected: exits with code 0. Test count should increase by one test file and at least one test compared with the previous baseline.

- [ ] **Step 4: Run static and build checks**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 5: Run package checks only if public import paths changed**

If any of `package.json`, `rollup.config.mjs`, `src/devtools/index.ts`, or package exports tests changed, run:

```bash
pnpm test:package
pnpm package:smoke
```

Expected: both commands exit with code 0. If none of those files changed, skip this step and state that package checks were not required because public package boundaries were unchanged.

- [ ] **Step 6: Update the project log validation table**

Replace each `待最终验证` in `solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md` with the observed command result. Include the final `pnpm test` file/test counts.

- [ ] **Step 7: Commit**

Run:

```bash
git status --short --branch
git add tests/integration/devtools-large-list-recorder-smoke.test.ts docs/devtools.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-17-011-devtools-large-list-recorder-smoke.md
git commit -m "test: add large list devtools recorder smoke"
```

Expected: commit succeeds. Do not push.
