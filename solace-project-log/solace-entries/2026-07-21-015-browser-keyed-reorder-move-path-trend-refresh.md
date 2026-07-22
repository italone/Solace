# 2026-07-21-015：刷新 keyed reorder move-path 趋势样本

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance trend / project log
- 状态：已完成

## 变动摘要

刷新 browser benchmark latest window，并记录 keyed reorder `movePathCounts` 诊断数据。

## 变动原因

move-path instrumentation 已接入 browser benchmark。需要用新样本确认 `movePathCounts` 能解释当前
`keyed-reorder` reorder cost，并为下一轮性能切片选择提供依据。

## 影响范围

- 影响模块：performance docs、browser benchmark local history、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/**` 仍保持本地 ignored。
- 风险等级：低；只更新趋势记录。

## 涉及文件

| 文件                                                                                                | 动作 | 说明                       |
| --------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| `docs/performance.md`                                                                               | 修改 | 更新 browser latest window |
| `solace-project-log/solace-entries/2026-07-21-015-browser-keyed-reorder-move-path-trend-refresh.md` | 新增 | 记录趋势刷新               |
| `solace-project-log/index.md`                                                                       | 修改 | 追加 2026-07-21 日志索引   |

## 验证记录

| 验证项                 | 命令                                                                                                                                   | 结果 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Browser benchmark run  | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过 |
| Browser history window | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                      | 通过 |
| Format check           | `pnpm format:check`                                                                                                                    | 通过 |
| Whitespace check       | `git diff --check`                                                                                                                     | 通过 |

## 后续动作

- 基于新 trend window 选择下一轮性能切片：anchor lookup、move-loop branching，或新增 reorder shape benchmark。
