# 2026-07-17-020：持久化 jsdom benchmark task metrics

## 基本信息

- 日期：2026-07-17
- 类型：benchmark tooling / script tests / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 jsdom benchmark history 增加 task-level Tinybench metrics 持久化，并让 `pnpm benchmark:history` 可以按 jsdom task 汇总 median、p95 和 variance。

## 变动原因

browser history 已能汇总 timing metrics，但 jsdom history 之前只记录 metadata/status。补齐 jsdom task metrics 后，后续 renderer、Fragment 和 component 性能优化能获得更细的场景级趋势证据。

## 影响范围

- 影响模块：benchmark runner、benchmark history summarizer、performance benchmark tests、脚本单元测试、性能文档、项目日志。
- 行为变化：无 runtime public API 变化；`pnpm benchmark` 默认仍可运行，配置 history path 时会附带 `summary.tasks`。
- 风险等级：中；涉及 Node tooling、子进程 env、临时文件和 history JSONL 兼容性。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                                   |
| ------------------------------------------------------------------------------------- | ---- | -------------------------------------- |
| `tests/performance/benchmark-report.ts`                                               | 新增 | 统一 Tinybench report 和 metrics 写出  |
| `tests/performance/*.bench.ts`                                                        | 修改 | 复用共享 benchmark report helper       |
| `scripts/run-benchmark.mjs`                                                           | 修改 | history 记录附带 jsdom task metrics    |
| `scripts/summarize-benchmark-history.mjs`                                             | 修改 | 汇总 jsdom task metrics                |
| `tests/unit/scripts/run-benchmark.test.ts`                                            | 修改 | 覆盖 history record 中的 summary.tasks |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                                | 修改 | 覆盖 jsdom task metric summary         |
| `docs/performance.md`                                                                 | 修改 | 更新 jsdom history metrics 说明        |
| `solace-project-log/solace-entries/2026-07-17-020-jsdom-benchmark-metrics-history.md` | 新增 | 记录本次变更                           |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-17 日志索引               |

## 验证记录

| 验证项              | 命令或方式                                                                                                      | 结果                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------- |
| History summary RED | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`                                          | 按预期失败后转绿       |
| Runner RED          | `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts`                                                      | 按预期失败后转绿       |
| Script tests        | `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-history-summary.test.ts` | 通过，16 tests         |
| Benchmark smoke     | `pnpm benchmark`                                                                                                | 通过                   |
| Benchmark history   | `pnpm benchmark:history -- --json`                                                                              | 通过，含 task 组       |
| Tests               | `pnpm test`                                                                                                     | 通过，176 tests        |
| Typecheck           | `pnpm typecheck`                                                                                                | 通过                   |
| Lint                | `pnpm lint`                                                                                                     | 通过                   |
| Build               | `pnpm build`                                                                                                    | 通过                   |
| 格式检查            | `pnpm format:check`                                                                                             | 通过                   |
| Diff whitespace     | `git diff --check`                                                                                              | 通过                   |
| Private boundary    | `package.json`                                                                                                  | 保持 `"private": true` |

## 后续动作

- 后续可基于 jsdom task metrics 选择下一轮 renderer/Fragment/component 性能切片；仍不要加入绝对 timing threshold。
