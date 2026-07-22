# Solace Alpha 稳定化与发布就绪计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前 `pnpm test` 因工作树 node_modules 被误包含而导致的失败，重新拉通 `pnpm quality` 与发布门禁，并理清 `package.json` 的 `private` 标志与实际文档的一致性。

**Architecture:** 单包 TypeScript 前端框架，测试矩阵由 Vitest（jsdom 单元/集成）+ Playwright（浏览器 e2e/基准）组成。本次稳定化不改动运行时架构，只调整测试范围配置、补齐配置级测试，并处理发布前文档/配置一致性。

**Tech Stack:** TypeScript 5.x, pnpm, Vitest, jsdom, Playwright, Rollup, ESLint, Prettier, Changesets.

---

## 项目完成度快照（执行本计划前）

| 模块                                              | 状态           | 说明                                                                                                                          |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 响应式系统 (`src/reactivity/*`)                   | 已完成         | `reactive`/`effect`/`computed`/`ref`/`watch`/`watchEffect` 均已实现并测试                                                     |
| VNode 与渲染器 (`src/vnode/*`, `src/renderer/*`)  | 已完成         | `h`、VNode、DOM renderer、keyed/non-keyed diff、Fragment                                                                      |
| 组件与事件 (`src/component/*`, `src/event/*`)     | 已完成         | 函数式组件、props、emit、slots、异步组件、生命周期、provide/inject、事件修饰                                                  |
| 调度器与 Store (`src/scheduler/*`, `src/store/*`) | 已完成         | `nextTick`、批处理调度、`createStore`                                                                                         |
| JSX Runtime 与包构建                              | 已完成         | `jsx-runtime`/`jsx-dev-runtime`/`devtools` 子路径、ESM/CJS/dts 产物                                                           |
| 示例应用 (`examples/*`)                           | 已完成         | basic-counter、todo-app、large-list、performance-benchmark                                                                    |
| 文档 (`docs/*`)                                   | 已完成         | architecture、api、devtools、examples、package-usage、performance、release                                                    |
| 单元/集成/性能测试                                | 测试本身全过   | 383 个 tests 全部通过，47 个框架测试文件通过                                                                                  |
| 覆盖率                                            | 超过阈值       | statements 96.1% / branches 89.9% / functions 98.9%，均高于 vitest.config.ts 阈值                                             |
| `pnpm format:check`                               | 通过           | Prettier 无异常                                                                                                               |
| `pnpm typecheck` / `pnpm typecheck:jsxdev`        | 通过           | TypeScript 无错误                                                                                                             |
| `pnpm lint`                                       | 通过           | ESLint 无错误                                                                                                                 |
| `pnpm test`                                       | **失败**       | Vitest 把 `.worktrees/keyed-reorder-move-path-instrumentation/node_modules/` 下的第三方测试文件也纳入，导致 71 个文件解析失败 |
| `pnpm quality`                                    | **失败**       | 依赖 `pnpm test`                                                                                                              |
| `pnpm release:check`                              | **未实际验证** | 因 `pnpm quality` 失败，完整发布门禁当前无法跑通                                                                              |
| `package.json` `private` 字段                     | **缺失**       | README 与项目计划声称 `"private": true`，但实际 `package.json` 未设置，存在误发布风险                                         |
| Git worktrees                                     | 存在 3 个      | main、detached review worktree、`perf/keyed-reorder-move-path-instrumentation`                                                |

**核心结论：** 框架功能、测试、文档、示例均已闭环；当前唯一的发布前阻塞项是 Vitest 配置对工作树目录的排除不完整，以及 `private` 标志与文档不一致。

---

## 文件结构变更

- 新增测试：`tests/unit/vitest-config.test.ts` —— 验证 Vitest 配置正确排除 `.worktrees/**` 与 `**/node_modules/**`。
- 修改配置：`vitest.config.ts` —— 调整 `exclude` 数组，避免扫描任何工作树或嵌套 node_modules 中的测试文件。
- 修改配置：`package.json` —— 明确设置 `private` 字段（推荐在正式发布前保持 `true`）。
- 修改文档：`solace-project-plan/README.md` 与 `readme.md` —— 若 `private` 决策与现有描述一致，则无需改动；若决策相反，同步更新描述。
- 可选清理：移除或归档 `.worktrees/keyed-reorder-move-path-instrumentation` 等已完成分支的本地工作树。

---

### Task 1: 修复 Vitest 工作树测试文件泄漏

**Files:**

- Create: `tests/unit/vitest-config.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: 编写失败的配置测试**

```ts
import { describe, expect, it } from "vitest";
import config from "../../vitest.config";

describe("vitest config", () => {
  it("excludes worktree directories and nested node_modules", () => {
    const excludes = config.test?.exclude ?? [];
    expect(excludes).toContain(".worktrees/**");
    expect(excludes.some((pattern: string) => pattern.includes("node_modules"))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/vitest-config.test.ts -v`

Expected: FAIL —— `Expected "#".worktrees/**" to be in the array` 或类似断言失败。

- [ ] **Step 3: 修改 Vitest 配置**

在 `vitest.config.ts` 中，将 `exclude` 数组更新为：

```ts
exclude: [
  "tests/e2e/**",
  "tests/integration/package-exports.test.ts",
  "node_modules/**",
  ".worktrees/**",
  "**/node_modules/**",
  "dist/**",
],
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/vitest-config.test.ts -v`

Expected: PASS。

- [ ] **Step 5: 运行完整测试套件**

Run: `pnpm test`

Expected: 118 test files 中仅框架相关 47+1 个文件被识别，71 个工作树第三方测试文件不再被扫描，全部 tests 通过。

- [ ] **Step 6: 提交**

```bash
git add vitest.config.ts tests/unit/vitest-config.test.ts
git commit -m "fix: exclude worktree and nested node_modules from vitest"
```

---

### Task 2: 重新验证质量门禁

**Files:**

- 无文件变更，仅验证命令。

- [ ] **Step 1: 运行 format 检查**

Run: `pnpm format:check`

Expected: `All matched files use Prettier code style!`

- [ ] **Step 2: 运行类型检查**

Run: `pnpm typecheck && pnpm typecheck:jsxdev`

Expected: 两条命令均无输出错误，退出码 0。

- [ ] **Step 3: 运行 lint**

Run: `pnpm lint`

Expected: 无错误，退出码 0。

- [ ] **Step 4: 运行完整测试**

Run: `pnpm test`

Expected: `Test Files  48 passed`（47 原框架测试文件 + 1 新增 vitest-config 测试），`Tests  384 passed`。

- [ ] **Step 5: 运行 package 构建与导出测试**

Run: `pnpm test:package`

Expected: Rollup 构建成功，package-exports 测试通过。

- [ ] **Step 6: 运行 quality 聚合命令**

Run: `pnpm quality`

Expected: format、typecheck、jsxdev typecheck、lint、test、test:package 全部通过。

- [ ] **Step 7: 提交**

若只有验证无代码变更，此步骤可跳过；若期间因格式化产生变更，则：

```bash
git add -A
git commit -m "chore: verify quality gate after vitest exclusion fix"
```

---

### Task 3: 明确 `package.json` 的 `private` 字段

**Files:**

- Modify: `package.json`
- Modify（如需要）: `readme.md`, `solace-project-plan/README.md`

- [ ] **Step 1: 决策确认**

与用户确认：在获得明确批准前，`@italone/solace` 是否应保持不可发布？

- 推荐：**保持 `private: true`**，避免误触发 `changeset publish`。
- 若用户决定进入发布流程，则改为 `private: false` 并同步配置 npm registry、access、changeset 版本。

- [ ] **Step 2: 写入配置**

在 `package.json` 顶部增加：

```json
{
  "name": "@italone/solace",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  ...
}
```

- [ ] **Step 3: 验证 release readiness（非发布模式）**

Run: `pnpm release:readiness`

Expected: 非发布模式下通过，publishability 检查因 `private: true` 按预期跳过。

- [ ] **Step 4: 运行 quality 确认无回归**

Run: `pnpm quality`

Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add package.json
git commit -m "chore: mark package as private until release is approved"
```

---

### Task 4: 清理已完成的工作树（可选但推荐）

**Files:**

- 无仓库文件变更，仅删除本地 git worktree。

- [ ] **Step 1: 列出工作树**

Run: `git worktree list`

Expected: 看到 main、`/private/tmp/solace-review-08387ce`、`/Users/alone/Desktop/TEST/Solace/.worktrees/keyed-reorder-move-path-instrumentation`。

- [ ] **Step 2: 确认分支状态**

Run: `git branch -a | grep keyed-reorder`

Expected: 本地/远程分支 `perf/keyed-reorder-move-path-instrumentation` 已合并或已推送。

- [ ] **Step 3: 移除本地工作树**

Run:

```bash
git worktree remove .worktrees/keyed-reorder-move-path-instrumentation
```

Expected: 工作树目录被移除，`git worktree list` 不再列出。

- [ ] **Step 4: 验证测试不再扫描工作树**

Run: `pnpm test`

Expected: 通过，且不再出现 `.worktrees/...` 路径的测试文件。

- [ ] **Step 5: 提交**

此步骤无仓库文件变更，无需提交；若 `.worktrees/` 目录本身被移除，.gitignore 已覆盖，也无需提交。

---

### Task 5: 同步更新项目完成度文档

**Files:**

- Modify: `solace-project-plan/README.md`
- Modify（如需要）: `readme.md`

- [ ] **Step 1: 更新 `solace-project-plan/README.md` 的「当前收口状态」**

将当前状态补充为：

```markdown
## 当前收口状态

- `vitest.config.ts` 已排除 `.worktrees/**` 与 `**/node_modules/**`，`pnpm test` 仅扫描框架测试文件。
- `pnpm quality` 已通过 format、typecheck、JSX dev typecheck、lint、默认测试、package build 和 package exports 测试。
- `package.json` 已设置 `"private": true`，在用户明确批准前不执行 `release:version` 或 `release:publish`。
- `pnpm release:readiness` 已在默认非发布模式通过，publishability 在 private 状态下按预期跳过。
- browser benchmark history 已支持 full-history、minimum count gate 和 latest-window summary，用于后续性能趋势判断。
```

- [ ] **Step 2: 如有必要，同步 `readme.md` 第 14 节**

确保「发布前运行 release readiness」与当前配置一致。

- [ ] **Step 3: 运行 quality 确认文档变更不破坏构建**

Run: `pnpm quality`

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add solace-project-plan/README.md
git commit -m "docs: update project status after alpha stabilization"
```

---

## 自我审查

**1. Spec coverage:**

- 修复 `pnpm test` 失败：Task 1 完成。
- 验证 `pnpm quality` 绿：Task 2 完成。
- 处理 `private` 标志：Task 3 完成。
- 清理工作树：Task 4 完成。
- 文档同步：Task 5 完成。

**2. Placeholder scan:**

- 无 TBD/TODO。
- 所有代码块包含实际内容。
- 所有命令包含预期输出。

**3. Type consistency:**

- `vitest.config.ts` 的 `exclude` 类型为 `string[]`，新增条目均为字符串。
- `package.json` 的 `private` 为布尔值。

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-07-22-alpha-stabilization-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
