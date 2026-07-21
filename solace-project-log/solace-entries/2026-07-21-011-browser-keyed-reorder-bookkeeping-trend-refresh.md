# 2026-07-21-011：刷新 keyed reorder bookkeeping 优化后趋势样本

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance docs / project log
- 状态：已完成

## 变动摘要

在 full-match keyed bookkeeping skip 实现后，追加 5 个 Chromium production browser benchmark samples。当前本地
ignored browser history 包含 65 条 `large-list` records 和 15 条 `keyed-reorder` records。

## 变动原因

renderer 已跳过 fully matched keyed middle segment 的 unused-old `Set` tracking 和 unmount scan。需要刷新 browser
趋势窗口，观察 keyed reorder `reorderMs` 是否有稳定变化，并确认 `domMutationCounts` 仍显示 DOM move path 不变。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/browser.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                                  | 动作 | 说明                              |
| ----------------------------------------------------------------------------------------------------- | ---- | --------------------------------- |
| `docs/performance.md`                                                                                 | 修改 | 刷新 bookkeeping 优化后的趋势窗口 |
| `solace-project-log/solace-entries/2026-07-21-011-browser-keyed-reorder-bookkeeping-trend-refresh.md` | 新增 | 记录本次趋势刷新                  |
| `solace-project-log/index.md`                                                                         | 修改 | 追加 2026-07-21 日志索引          |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                 | 结果                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Browser benchmark samples | `env SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，追加 5 条 `large-list` 与 5 条 `keyed-reorder` records                              |
| Full browser history      | `pnpm benchmark:history -- --json`                                                                                                         | 通过，browser records: `large-list` 65，`keyed-reorder` 15；`keyed-reorder` median 4.7 ms |
| Latest browser history    | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                          | 通过，latest `keyed-reorder` median 4.7 ms；counters 为 `insertBefore: 9999`，其余为 0    |

## 后续动作

- 本轮优化减少 bookkeeping，但 browser counters 仍显示 DOM move path 固定为 9999 次 `insertBefore`。下一轮如果继续性能线，
  应进入新的设计周期，优先围绕 move path / anchor lookup 或更细的 keyed diff instrumentation，而不是继续优化 props/text patch。
