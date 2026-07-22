# 2026-07-21-014：补充 keyed reorder move path instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance instrumentation / browser benchmark / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder move-path 内部诊断 counters，并在 browser `keyed-reorder` summary/history 中记录
`movePathCounts`。该字段与 `domMutationCounts` 并列，用于区分 browser-visible DOM writes 与 renderer move-loop
intent。

## 变动原因

当前 keyed reorder browser baseline 已证明 reverse reorder 的 DOM 写入主要是 `insertBefore: 9999`，props/text/remove
写入为 0。full-match bookkeeping skip 后，下一步需要先量化 LIS、stable skip、move insert、mount/remove 和 anchor
lookup 的分布，再决定是否进入 move-path 优化。

## 影响范围

- 影响模块：renderer keyed diff、browser benchmark fixture、browser history types/tests、performance docs、项目日志。
- 行为变化：默认 renderer 行为不变；只有 benchmark/test 显式开启 instrumentation 时才记录 counters。
- 风险等级：中低；风险集中在 instrumentation 泄漏和 benchmark result shape 变更，已通过默认关闭测试和 browser shape 测试覆盖。

## 涉及文件

| 文件                                                                                          | 动作 | 说明                                                |
| --------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `src/renderer/keyed-reorder-instrumentation.ts`                                               | 新增 | 内部 move-path counter helpers                      |
| `src/renderer/diff.ts`                                                                        | 修改 | 在 keyed middle move path 中记录 aggregate counters |
| `tests/unit/renderer/diff.test.ts`                                                            | 修改 | 覆盖默认关闭、full reverse 和 mixed counters        |
| `examples/performance-benchmark/src/main.tsx`                                                 | 修改 | 将 `movePathCounts` 写入 keyed benchmark result     |
| `tests/e2e/browser-benchmark-history.ts`                                                      | 修改 | 扩展 browser history 类型                           |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                                        | 修改 | 覆盖 JSONL 保留 `movePathCounts`                    |
| `tests/e2e/browser-benchmark.spec.ts`                                                         | 修改 | 校验 browser `keyed-reorder` move-path shape        |
| `docs/performance.md`                                                                         | 修改 | 记录诊断字段含义                                    |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-move-path-instrumentation.md`                | 新增 | 记录实施计划                                        |
| `solace-project-log/solace-entries/2026-07-21-014-keyed-reorder-move-path-instrumentation.md` | 新增 | 记录本次实现变更                                    |
| `solace-project-log/index.md`                                                                 | 修改 | 追加 2026-07-21 日志索引                            |

## 验证记录

| 验证项                | 命令                                                                   | 结果 |
| --------------------- | ---------------------------------------------------------------------- | ---- |
| Renderer unit tests   | `pnpm vitest run tests/unit/renderer/diff.test.ts`                     | 通过 |
| Browser history tests | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts` | 通过 |
| Browser benchmark     | `pnpm benchmark:browser`                                               | 通过 |
| Typecheck             | `pnpm typecheck`                                                       | 通过 |
| Lint                  | `pnpm lint`                                                            | 通过 |
| Build                 | `pnpm build`                                                           | 通过 |
| Format check          | `pnpm format:check`                                                    | 通过 |
| Whitespace check      | `git diff --check`                                                     | 通过 |

## 后续动作

- 刷新 browser benchmark trend window，观察 `movePathCounts` 与 `reorderMs` 的关系。
- 基于新样本决定下一轮性能切片是否瞄准 anchor lookup、move-loop branching，或扩展更多 reorder shapes。
