# Solace Alpha 完成度梳理与后续路线图

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `/Users/alone/Desktop/TEST/Solace` 当前状态，梳理项目完成度，明确 alpha 收尾、发布就绪与 beta 路线图的下一步可执行任务。

**Architecture:** 单包 TypeScript 前端框架 `@italone/solace`，由响应式核心、VNode/渲染器、组件系统、JSX 运行时、调度器、Store、DevTools 低阶 API 与发布门禁组成。本计划不涉及新运行时架构，只聚焦完成度确认、alpha 收尾、发布准备与后续路线图文档化。

**Tech Stack:** TypeScript 5.x, pnpm, Vite, Rollup, Vitest, jsdom, Playwright, ESLint, Prettier, Changesets.

---

## 项目完成度快照（执行本计划前）

| 模块                                             | 状态         | 说明                                                                                                                                |
| ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| App API (`src/app.ts`)                           | 已完成       | `createApp`、`mount`、`use`、app-level `provide` 已导出并文档化                                                                     |
| 响应式系统 (`src/reactivity/*`)                  | 已完成       | `reactive`/`ref`/`effect`/`computed`/`watch`/`watchEffect` 均已实现并测试                                                           |
| Scheduler (`src/scheduler/*`)                    | 已完成       | `nextTick`、批量组件更新与调度器测试                                                                                                |
| VNode 与渲染器 (`src/vnode/*`, `src/renderer/*`) | 已完成       | `h`、VNode、DOM renderer、Fragment、keyed/non-keyed diff、move-path instrumentation                                                 |
| 组件与事件 (`src/component/*`, `src/event/*`)    | 已完成       | 函数式组件、props、emit、slots、异步组件、生命周期、provide/inject、事件修饰符                                                      |
| Store (`src/store/*`)                            | 已完成       | `createStore`、reactive state、computed getters、named actions、DevTools action summaries                                           |
| JSX Runtime (`src/jsx-runtime.ts` 等)            | 已完成       | `jsx-runtime`/`jsx-dev-runtime` 子路径、类型检查与示例                                                                              |
| DevTools subpath (`src/devtools/*`)              | 已完成       | `@italone/solace/devtools` 暴露 listener/recorder API，非浏览器扩展 UI                                                              |
| 示例应用 (`examples/*`)                          | 已完成       | basic-counter、todo-app、large-list、performance-benchmark                                                                          |
| 包输出与导出测试                                 | 已完成       | Rollup ESM/CJS/dts 产物、package-exports 测试、packed-consumer smoke test                                                           |
| 文档 (`docs/*`)                                  | 基本完成     | README（中/英）、api、architecture、devtools、examples、package-usage、performance、project-status、release、CONTRIBUTING、SECURITY |
| 单元/集成/e2e/性能测试                           | 全部通过     | 24 个测试文件，195 tests 全部通过                                                                                                   |
| 覆盖率                                           | 超过阈值     | statements 96.28% / branches 90.09% / functions 98.97% / lines 96.21%，均高于 `vitest.config.ts` 阈值                               |
| 质量门禁                                         | 当前通过     | `pnpm format:check`、`pnpm typecheck`、`pnpm typecheck:jsxdev`、`pnpm lint`、`pnpm test`、`pnpm test:package` 均通过                |
| 发布门禁                                         | 当前通过     | `pnpm quality`、`pnpm release:check`、`pnpm release:readiness -- --publishable` 均通过                                              |
| Git 状态                                         | 本地领先远程 | `main` 分支干净，领先 `origin/main` 2 个 release-preparation 提交                                                                   |

**核心结论：** 框架功能、测试、文档、示例、发布门禁均已闭环；当前处于 alpha 稳定化末期，可进入发布收尾与路线图规划阶段。

---

## 文件结构变更

- 新增文档：`docs/superpowers/plans/2026-07-24-solace-completion-and-roadmap.md` —— 本计划文件。
- 修改文档：`docs/project-status.md` —— 将「Recommended Next Work」更新为可执行任务，并补充当前 Git/npm 状态。
- 修改文档：`readme.md`、`readme.zh-CN.md` —— 若发布状态或版本号与当前分支不一致，同步更新。
- 修改配置：`package.json` —— 确认 `private` 字段与发布意图一致（当前为 `false`，已可发布）。
- 可选新增文档：`docs/roadmap.md` —— 独立的 beta 路线图文档。

---

## Task 1: 确认并记录当前完成度基线

**Files:**

- Create: `docs/superpowers/plans/2026-07-24-solace-completion-and-roadmap.md`（本文件）

- [ ] **Step 1: 运行完整发布门禁并捕获输出**

Run:

```bash
pnpm release:check
```

Expected: 所有子命令通过，最终输出包含 `release:check passed` 或等价成功提示。

- [ ] **Step 2: 运行发布就绪检查（发布模式）**

Run:

```bash
pnpm release:readiness -- --publishable
```

Expected: 通过，`--publishable` 模式下不提示阻塞项。

- [ ] **Step 3: 记录 Git 状态**

Run:

```bash
git status
git log --oneline -5
```

Expected: working tree clean，当前为 `main` 分支，最近 5 条提交包含 release-preparation 相关提交。

- [ ] **Step 4: 记录 npm 包版本与 private 状态**

Run:

```bash
cat package.json | grep -E '"version"|"private"'
```

Expected: `"version": "0.0.3"`，`"private": false`。

- [ ] **Step 5: 提交本计划文件**

```bash
git add docs/superpowers/plans/2026-07-24-solace-completion-and-roadmap.md
git commit -m "docs: add Solace completion assessment and roadmap plan"
```

---

## Task 2: 更新 `docs/project-status.md` 完成度与后续工作

**Files:**

- Modify: `docs/project-status.md`

- [ ] **Step 1: 更新 Summary 与本地状态**

将 `docs/project-status.md` 中 `Current local repository state` 区块替换为：

```markdown
Current local repository state:

- Package name: `@italone/solace`
- Local package version: `0.0.3`
- Public package metadata: enabled with `"private": false`
- Current branch: `main`
- Local branch state: ahead of `origin/main` by two release-preparation commits
- Publishing phase: ready for intentional release on user approval
```

- [ ] **Step 2: 将 Recommended Next Work 改为可执行任务列表**

替换为：

```markdown
## Recommended Next Work

1. **Push release-preparation commits to `origin/main`** before publishing.
2. **Collect browser benchmark history** for keyed reorder and large-list scenarios before making performance claims.
3. **Stabilize the public API surface** before expanding compiler, router, SSR, hydration, or DevTools UI work.
4. **Keep package export tests and packed-consumer smoke tests mandatory** for any public API change.
5. **Publish v0.0.3 only after explicit user approval**, npm authentication, organization access, and dry-run validation.
6. **Add a public roadmap document** for beta priorities (compiler/router/SSR/DevTools UI) once alpha is tagged.
```

- [ ] **Step 3: 运行 quality 确认文档变更无破坏**

Run:

```bash
pnpm quality
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add docs/project-status.md
git commit -m "docs: update project status with current completion baseline"
```

---

## Task 3: 同步 README 版本与发布状态

**Files:**

- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [ ] **Step 1: 检查 README 中的版本号**

Run:

```bash
grep -n "0\.0" readme.md readme.zh-CN.md
```

Expected: 找到所有出现的版本号，确认是否与 `package.json` 的 `0.0.3` 一致。

- [ ] **Step 2: 统一版本号**

若不一致，将所有 `readme.md` 与 `readme.zh-CN.md` 中的版本号替换为 `0.0.3`。

- [ ] **Step 3: 检查 README 中的 private/发布描述**

Run:

```bash
grep -n -i "private\|publish\|npm" readme.md readme.zh-CN.md
```

Expected: 描述与 `"private": false`、可发布状态一致；若仍有“未发布/私有”描述，更新为“已准备发布，需显式批准”。

- [ ] **Step 4: 运行 quality 确认无破坏**

Run:

```bash
pnpm quality
```

Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add readme.md readme.zh-CN.md
git commit -m "docs: sync README version and publish readiness state"
```

---

## Task 4: 推送本地 release-preparation 提交到 origin

**Files:**

- 无仓库文件变更。

- [ ] **Step 1: 确认远程状态**

Run:

```bash
git status
```

Expected: `Your branch is ahead of 'origin/main' by 2 commits`。

- [ ] **Step 2: 推送提交**

Run:

```bash
git push origin main
```

Expected: 推送成功，本地与 `origin/main` 一致。

- [ ] **Step 3: 验证远程状态**

Run:

```bash
git status
```

Expected: `Your branch is up to date with 'origin/main'`。

---

## Task 5: 创建 Beta 路线图文档

**Files:**

- Create: `docs/roadmap.md`

- [ ] **Step 1: 创建路线图文档**

写入 `docs/roadmap.md`：

```markdown
# Solace Roadmap

## Current Phase: Alpha (completed)

The alpha runtime is feature-complete for its declared scope:

- Reactive core, scheduler, renderer, components, events, store, JSX runtime, DevTools API, examples, and release gates.
- All tests passing, coverage above thresholds, package exports validated.

## Next Phase: Beta

Planned work, in rough priority order:

1. **Template / SFC compiler** — explore a compile-time template or single-file component format that targets the existing VNode/runtime.
2. **First-party router** — design and implement a minimal, reactive router for SPAs.
3. **SSR / SSG / hydration** — add server-side rendering, static generation, and client hydration capabilities.
4. **Browser DevTools extension UI** — build a panel on top of the existing `@italone/solace/devtools` API.
5. **Production adoption guidance** — large-app patterns, performance tuning, migration notes.

## Out of Scope (for now)

- First-party UI component library.
- Stable plugin ecosystem.
- Long-term compatibility policy for internal modules.

## How to Propose Changes

Open an issue or discussion on the project repository with the problem, proposed API, and affected public surface.
```

- [ ] **Step 2: 在 README 中链接路线图**

在 `readme.md` 与 `readme.zh-CN.md` 的合适位置（例如“文档”列表后）添加：

```markdown
- [Roadmap](./docs/roadmap.md)
```

- [ ] **Step 3: 运行 quality 确认无破坏**

Run:

```bash
pnpm quality
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add docs/roadmap.md readme.md readme.zh-CN.md
git commit -m "docs: add beta roadmap and link from README"
```

---

## Task 6: 收集浏览器基准历史数据

**Files:**

- 无仓库文件变更，仅运行命令并记录结果。

- [ ] **Step 1: 运行浏览器基准测试**

Run:

```bash
pnpm benchmark:browser
```

Expected: 测试通过，输出包含 keyed reorder 与 large-list 的基准数据。

- [ ] **Step 2: 保存基准结果到本地日志**

将输出复制到 `solace-project-log/` 下的新文件，例如 `solace-project-log/2026-07-24-browser-benchmark.md`。

```markdown
# Browser Benchmark — 2026-07-24

## Environment

- Date: 2026-07-24
- Command: `pnpm benchmark:browser`

## Results

（粘贴 pnpm benchmark:browser 的完整输出）
```

- [ ] **Step 3: 提交**

```bash
git add solace-project-log/2026-07-24-browser-benchmark.md
git commit -m "chore: record browser benchmark history"
```

---

## Task 7: 发布 v0.0.3（仅在用户明确批准后执行）

**Files:**

- Modify: `CHANGELOG.md`（添加发布日期）

- [ ] **Step 1: 确认 npm 认证与权限**

Run:

```bash
npm whoami
```

Expected: 输出已登录用户名，且具备 `@italone` 组织的 publish 权限。

- [ ] **Step 2: 运行发布前 dry-run**

Run:

```bash
npm publish --dry-run --access public --cache /private/tmp/npm-cache
```

Expected: dry-run 成功，包内容与版本号正确。

- [ ] **Step 3: 发布到 npm**

Run:

```bash
npm publish --access public
```

Expected: 发布成功，返回新包版本 `@italone/solace@0.0.3`。

- [ ] **Step 4: 更新 CHANGELOG**

在 `CHANGELOG.md` 顶部添加：

```markdown
## 0.0.3 — 2026-07-24

- Alpha runtime release.
- Reactive core, renderer, components, scheduler, store, JSX runtime, and DevTools API.
- Full test coverage and release gates passing.
```

- [ ] **Step 5: 提交并推送**

```bash
git add CHANGELOG.md
git commit -m "chore: release @italone/solace@0.0.3"
git push origin main
```

---

## 自我审查

**1. Spec coverage:**

- 完成度梳理与基线确认：Task 1 完成。
- 项目状态文档更新：Task 2 完成。
- README 同步：Task 3 完成。
- 本地提交推送：Task 4 完成。
- Beta 路线图：Task 5 完成。
- 浏览器基准历史：Task 6 完成。
- v0.0.3 发布：Task 7 完成（用户批准后执行）。

**2. Placeholder scan:**

- 无 TBD/TODO。
- 所有代码块包含实际内容或明确命令。
- 所有命令包含预期输出。

**3. Type consistency:**

- `package.json` 的 `version` 为字符串，`private` 为布尔值。
- 文档中的版本号与 `package.json` 保持一致。

---

## 执行交接

**Plan complete and saved to `docs/superpowers/plans/2026-07-24-solace-completion-and-roadmap.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
