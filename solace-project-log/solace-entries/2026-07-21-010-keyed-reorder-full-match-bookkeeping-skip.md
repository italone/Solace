# 2026-07-21-010：优化 keyed reorder full-match bookkeeping

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance / keyed diff / project log
- 状态：已完成

## 变动摘要

优化 `patchKeyedChildren()` 的 fully matched keyed middle segment：使用 `matchedOldCount` 判断是否存在旧节点需要卸载，
在全匹配场景跳过 unused-old `Set` tracking 和 unmount scan；在 remove/mixed 场景通过 `newIndexToOldIndexMap`
派生 used old indexes，继续正确卸载消失的 keyed children。

## 变动原因

最新 browser keyed reorder mutation counters 显示 stable reverse reorder 没有重复 props/text/remove DOM mutation，
但当前 keyed diff 仍在全匹配场景执行 unused-old bookkeeping。该优化减少 full reorder 的内部 bookkeeping 成本，同时不改变
LIS move path 或 DOM ordering。

## 影响范围

- 影响模块：renderer keyed children diff、renderer unit tests、performance docs、项目日志。
- 行为变化：full matched keyed reorder 少做内部 bookkeeping；DOM 输出、节点复用、move ordering 与 public API 不变。
- 风险等级：中；remove/mixed keyed 场景依赖新的 index-map-derived unused detection，必须通过现有 keyed diff 测试。

## 涉及文件

| 文件                                                                                            | 动作 | 说明                                 |
| ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `src/renderer/diff.ts`                                                                          | 修改 | 优化 fully matched keyed bookkeeping |
| `tests/unit/renderer/diff.test.ts`                                                              | 修改 | 增加 full-match Set skip 回归测试    |
| `docs/performance.md`                                                                           | 修改 | 记录 renderer 性能优化               |
| `solace-project-log/solace-entries/2026-07-21-010-keyed-reorder-full-match-bookkeeping-skip.md` | 新增 | 记录本次实现变更                     |
| `solace-project-log/index.md`                                                                   | 修改 | 追加 2026-07-21 日志索引             |

## 验证记录

| 验证项                | 命令或方式                                                                                      | 结果                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Renderer RED          | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 失败符合预期，full-match reorder 在 `patchKeyedChildren()` 内构造 unused tracking `Set` |
| Renderer diff unit    | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，27 tests                                                                          |
| List diff benchmark   | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过                                                                                    |
| Browser benchmark     | `pnpm benchmark:browser`                                                                        | 通过，`keyed-reorder` counters 保持 `insertBefore: 9999`，其余为 0                      |
| Browser latest window | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`               | 通过                                                                                    |
| Typecheck             | `pnpm typecheck`                                                                                | 通过                                                                                    |
| Lint                  | `pnpm lint`                                                                                     | 通过                                                                                    |
| Build                 | `pnpm build`                                                                                    | 通过                                                                                    |
| Format check          | `pnpm format:check`                                                                             | 通过                                                                                    |
| Diff whitespace       | `git diff --check`                                                                              | 通过                                                                                    |

## 后续动作

- 刷新 browser benchmark 趋势样本，观察 keyed reorder `reorderMs` 是否有稳定变化。
