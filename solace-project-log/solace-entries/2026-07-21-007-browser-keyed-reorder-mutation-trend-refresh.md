# 2026-07-21-007：刷新 browser keyed reorder mutation 趋势样本

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance docs / project log
- 状态：已完成

## 变动摘要

追加 5 个带 `domMutationCounts` 的 Chromium production browser benchmark samples。当前本地 ignored browser history
包含 60 条 `large-list` records 和 10 条 `keyed-reorder` records，其中最新 5 条 `keyed-reorder` records 都包含 DOM
mutation counters。

## 变动原因

keyed reorder browser benchmark 已补充 mutation instrumentation。需要刷新趋势窗口，确认新字段在真实 browser run 中稳定，
并基于 counters 判断下一轮 renderer 性能切片不应继续围绕 props / text patch skip 展开。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/browser.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                               | 动作 | 说明                                           |
| -------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `docs/performance.md`                                                                              | 修改 | 刷新 browser keyed reorder 最新趋势与 counters |
| `solace-project-log/solace-entries/2026-07-21-007-browser-keyed-reorder-mutation-trend-refresh.md` | 新增 | 记录本次趋势刷新                               |
| `solace-project-log/index.md`                                                                      | 修改 | 追加 2026-07-21 日志索引                       |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                 | 结果                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Browser benchmark samples | `env SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，追加 5 条 `large-list` 与 5 条 `keyed-reorder` records                               |
| Full browser history      | `pnpm benchmark:history -- --json`                                                                                                         | 通过，browser records: `large-list` 60，`keyed-reorder` 10；`keyed-reorder` median 4.75 ms |
| Latest browser history    | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                          | 通过，latest `keyed-reorder` median 4.9 ms；counters 为 `insertBefore: 9999`，其余为 0     |

## 后续动作

- 新 counters 显示稳定 reverse reorder 没有重复 props/text/remove DOM mutation；下一轮设计应优先分析 keyed diff
  bookkeeping 或 DOM move 路径，而不是继续推进 generic matched element patch skip。
