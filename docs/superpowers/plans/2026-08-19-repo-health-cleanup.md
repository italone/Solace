# 仓库健康治理实施计划(diff 拆分 / 脚本精简 / 文档表述 / 产物清理)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拆分 897 行的 `src/renderer/diff.ts`、合并 scripts/ 下的 config 三件套、在文档中将功能边界明确表述为「定位决策」、把 AI 工作流日志目录移出 git 跟踪。

**Architecture:** diff.ts 按职责拆为 props / children / unmount / devtools-events 四个内部模块,diff.ts 保留 patch 主流程并作为唯一公共入口(外部导入路径不变);scripts 将 `-config.mjs` 常量内联进对应 runner 并导出,删除独立 config 文件;文档改动限于表述层;git 清理用 `git rm --cached` + .gitignore。

**Tech Stack:** TypeScript (ESM), vitest, pnpm。验证命令:`pnpm typecheck`、`pnpm lint`、`pnpm test`。

**重要约束:** 外部对 `src/renderer/diff.ts` 的导入(尤其是 `patch`)必须保持不变;所有既有测试不许删除断言,只能改导入路径。

---

## Task 1: 拆分 diff.ts — props 模块

**Files:**
- Create: `src/renderer/props.ts`
- Modify: `src/renderer/diff.ts`(删除被移出的函数,改为导入)

- [ ] **Step 1: 确认现有测试通过(基线)**

Run: `pnpm vitest run tests/unit/renderer 2>/dev/null || pnpm vitest run tests/unit | grep -i diff`
Expected: PASS(记录基线用例数)

- [ ] **Step 2: 创建 `src/renderer/props.ts`**

从 diff.ts 原样移出以下函数(保持签名与实现逐字不变,新增必要的 import):

```ts
import type { VNode, VNodeProps } from "./vnode";

export function havePropsChanged(oldProps: VNodeProps | null, newProps: VNodeProps | null): boolean
export function hasPatchableProps(props: VNodeProps | null): boolean
export function hasOwnProp(props: VNodeProps, key: string): boolean
export function mountInitialProps(el: Element, props: VNodeProps): void
export function mountInitialClass(el: Element, value: unknown): void
export function mightBeEventProp(key: string): boolean
export function patchProps(el: Element, oldProps: VNodeProps | null, newProps: VNodeProps | null): void
export function hasEventProps(props: VNodeProps | null): boolean
```

注意:这些函数内部若调用了 diff.ts 的其他函数(如事件绑定辅助),把那个辅助函数一并移入 props.ts 并导出。

- [ ] **Step 3: diff.ts 改为导入并删除原实现**

```ts
import {
  havePropsChanged, hasPatchableProps, mountInitialProps,
  patchProps, hasEventProps, mightBeEventProp,
} from "./props";
```

- [ ] **Step 4: 验证**

Run: `pnpm typecheck && pnpm vitest run tests/unit`
Expected: PASS,与基线用例数一致

- [ ] **Step 5: Commit**

```bash
git add src/renderer/props.ts src/renderer/diff.ts
git commit -m "refactor: extract props module from diff"
```

## Task 2: 拆分 diff.ts — unmount 模块

**Files:**
- Create: `src/renderer/unmount.ts`
- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: 创建 `src/renderer/unmount.ts`**

移出(diff.ts 行号参考:817-867):

```ts
export function unmountChildren(children: VNode[]): void
export function unmount(vnode: VNode): void
export function getFragmentRoot(vnode: VNode): Element | Text | null
```

`unmount` 内部若引用 patch/组件卸载逻辑,通过参数或从 diff.ts 导入的回调注入;优先选择「从 diff.ts import 具体函数」——ESM 函数声明的循环引用是安全的(function hoisting)。若引用了 children 卸载辅助(`unmountChildrenRange` 等),把它们一并移入并导出。

- [ ] **Step 2-4: 同 Task 1**(diff.ts 改导入 → `pnpm typecheck && pnpm vitest run tests/unit` 全绿)

- [ ] **Step 5: Commit** `git commit -m "refactor: extract unmount module from diff"`

## Task 3: 拆分 diff.ts — children 模块(最大块)

**Files:**
- Create: `src/renderer/children.ts`
- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: 创建 `src/renderer/children.ts`**

移出(diff.ts:400-813 中的 children 相关部分):

```ts
export function patchChildren(n1: VNode, n2: VNode, container: ParentNode, anchor: Node | null): void   // 按实际签名
export function patchArrayChildren(...)
export function patchUnkeyedChildren(...)
export function patchKeyedChildren(...)          // 含 LIS 优化,~190 行,保持逐字不动
export function getNewRunStart(...)
export function unmountUnusedKeyedChildren(...)
export function mountNewChildren(...)
export function canBatchMountChildren(...)
export function unmountChildrenRange(...)
export function canBatchRemoveChildren(...)
export function getAnchor(...)
```

这些函数互相调用 mount/patch/unmount(diff.ts / unmount.ts / props.ts 中的),全部通过 import 解决。**逐字移动,禁止顺手重构**——这是纯机械拆分,LIS 逻辑有性能基准守护。

- [ ] **Step 2: 同前,diff.ts 改导入**

- [ ] **Step 3: 验证(必须含性能基准)**

Run: `pnpm typecheck && pnpm vitest run tests/unit && pnpm benchmark`
Expected: 测试全绿;benchmark 与历史基线在噪声范围内(现有 `performance:regression` 门禁不报警)

- [ ] **Step 4: Commit** `git commit -m "refactor: extract children diff module"`

## Task 4: 拆分 diff.ts — devtools 事件模块 + 收尾

**Files:**
- Create: `src/renderer/devtools-events.ts`
- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: 移出 `emitComponentDevtoolsEvent`、`emitRendererElementDevtoolsEvent`(diff.ts:869-897)到 `devtools-events.ts`**

- [ ] **Step 2: 确认 diff.ts 最终只剩 patch 主流程 + mount*/updateComponent/isSameVNodeType 等(目标 <350 行),`wc -l src/renderer/*.ts` 记录新行数**

- [ ] **Step 3: 全量验证**

Run: `pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`
Expected: 全部 PASS

- [ ] **Step 4: Commit** `git commit -m "refactor: extract renderer devtools events"`

## Task 5: 精简 scripts/ — 内联 config 三件套

**背景:** scripts/ 38 个文件中有 8 组「runner.mjs + X-config.mjs + X-config.d.mts(或 .d.mts)」模式,config 文件只是常量清单。合并后 38 → ~22 个文件,门禁功能不减少。

**合并清单(runner ← config):**

| runner(保留) | 内联后删除 |
|---|---|
| `one-zero-readiness.mjs` | `one-zero-readiness-config.mjs`、`one-zero-readiness-config.d.mts` |
| `performance-cross-commit.mjs` | `performance-cross-commit-config.mjs`、`performance-cross-commit-config.d.mts` |
| `performance-history-evidence.mjs` | `performance-history-evidence-config.mjs`、`performance-history-evidence-config.d.mts` |
| `performance-regression-check.mjs` | `performance-regression-config.mjs`、`performance-regression-config.d.mts` |
| `public-contract-check.mjs` | `public-contract-check-config.mjs`、`public-contract-check-config.d.mts` |
| `registry-contract-smoke.mjs` | `registry-contract-smoke-config.mjs`、`registry-contract-smoke-config.d.mts` |
| `adoption-consumer-smoke.mjs` | `adoption-consumer-smoke-config.mjs`、`adoption-consumer-smoke-config.d.mts` |
| `operations-console-smoke.mjs` | `operations-console-smoke-config.mjs`、`operations-console-smoke-config.d.mts` |
| (无 runner) | `release-readiness-check-commands.d.mts`(若 release-readiness-check.mjs 已内含命令则直接删) |

逐组执行,每组:

- [ ] **Step 1: 把 config.mjs 的导出常量原样移到 runner.mjs 顶部并 `export`**(供测试导入),删除 runner 中的 `import ... from "./X-config.mjs"`
- [ ] **Step 2: 更新对应测试**:`tests/unit/scripts/X.test.ts` 中 `from "../../scripts/X-config.mjs"` 改为 `from "../../scripts/X-runner.mjs"`,断言不动
- [ ] **Step 3: 删除 config 文件对**
- [ ] **Step 4: 验证该组**

Run: `pnpm vitest run tests/unit/scripts/X.test.ts`
Expected: PASS

- [ ] **Step 5: 每组合并成一个 commit** `git commit -m "refactor: inline <name> config into runner script"`

全部完成后:

- [ ] **Step 6: 全量验证** `pnpm typecheck && pnpm lint && pnpm test`(注意 tests/unit/scripts 有 15 个测试文件,8 个需改导入路径)
- [ ] **Step 7: 抽查一个门禁真实可用** `pnpm release:contract:check`
Expected: 正常输出,行为与合并前一致

## Task 6: 文档 — 把功能边界表述为定位决策

**Files:**
- Modify: `docs/project-status.md:95-105` 附近、`readme.md:60-68` 附近、`docs/roadmap.md`

- [ ] **Step 1: 在 docs/project-status.md 边界小节开头加一段定位说明(中英文档同步):**

> These exclusions are deliberate scope decisions for a readable, teaching-oriented runtime — not incomplete work. Revisit criteria are recorded in `docs/roadmap.md`; each would require a dedicated design doc before implementation.

- [ ] **Step 2: 确认 docs/roadmap.md 已有对应条目,若无则补一条「Streaming SSR / Suspense / selective hydration — revisit after 1.0, requires design doc」**
- [ ] **Step 3: 验证文档一致性测试** `pnpm vitest run tests/unit/docs`
Expected: PASS(docs 内容有测试锁定,若断言失败按测试期望修正表述)

- [ ] **Step 4: Commit** `git commit -m "docs: frame feature boundary as deliberate scope"`

## Task 7: 产物目录清理

**背景:** `coverage/`、`test-results/`、`dist/` 已在 .gitignore 且未被跟踪(仅本地产物);`solace-project-log/`(167 文件)和 `solace-project-plan/`(25 文件)被 git 跟踪,是 AI 工作流日志,无任何代码/脚本/测试引用(已 grep 验证)。

- [ ] **Step 1: .gitignore 增加规则**

```
# AI workflow logs (kept locally, not versioned)
solace-project-log/
solace-project-plan/
```

- [ ] **Step 2: 移出 git 跟踪但保留本地文件**

```bash
git rm -r --cached solace-project-log solace-project-plan
```

- [ ] **Step 3: 删除可再生产物目录(coverage/test-results/dist 均可由命令重新生成)**

```bash
rm -rf coverage test-results dist
```

注意:执行前用 `git status` 确认这三个目录确实未被跟踪。

- [ ] **Step 4: 验证** `git status` 只显示 .gitignore 与两个目录的删除;`pnpm vitest run tests/unit/ci-workflow.test.ts` PASS
- [ ] **Step 5: Commit** `git commit -m "chore: stop tracking ai workflow logs and clean artifacts"`

## Task 8: 终验

- [ ] **Step 1:** `pnpm quality`(format:check + contract + build + 双 typecheck + lint + test + test:package)
- [ ] **Step 2:** `wc -l src/renderer/diff.ts` 确认 <350;`ls scripts | wc -l` 确认 ≤24
- [ ] **Step 3:** `git log --oneline` 确认各任务独立提交
- [ ] **Step 4:** 推送前与用户确认,再 `git push origin main`(SSH 已配好)

## 风险与回滚

- diff.ts 拆分是纯机械移动,任何测试/基准回退 → `git revert` 单个 commit 即可,各 Task 独立成提交正是为此
- scripts 内联若某 config 被 CI workflow 直接引用(`.github/workflows/ci.yml`),该组跳过内联并在 commit message 中说明——执行 Task 5 前先 `grep -n "config.mjs\|config.d.mts" .github/workflows/ci.yml`
