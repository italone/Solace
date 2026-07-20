# 2026-07-20-013：刷新发布后的 browser benchmark 趋势样本

## 基本信息

- 日期：2026-07-20
- 类型：browser benchmark / performance docs / project log
- 状态：已完成

## 变动摘要

追加 5 条 Chromium production large-list benchmark 本地样本，并刷新性能文档中的 full-history 与
latest-window 趋势数据。发布后包名已经变为 `@italone/solace`，本轮样本元数据同步记录新包名。

## 变动原因

第一版发布完成后，开发线回到性能计划。当前计划要求先补 browser benchmark 样本，拉新趋势窗口，再基于
新窗口选择下一个性能切片。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/browser.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                        |
| ------------------------------------------------------------------------------------- | ---- | --------------------------- |
| `docs/performance.md`                                                                 | 修改 | 刷新 browser history 趋势表 |
| `solace-project-log/solace-entries/2026-07-20-013-browser-benchmark-trend-refresh.md` | 新增 | 记录本次趋势刷新            |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-20 日志索引    |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                 | 结果                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Browser benchmark samples | `env SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，5 samples；latest median: 7.0 / 3.5 / 1.1 ms         |
| Full browser history      | `pnpm benchmark:history -- --min-browser-count 20 --json`                                                                                  | 通过，browser records 50；median: 7.55 / 3.55 / 1.2 ms     |
| Latest browser history    | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                          | 通过，latest browser records 5；median: 7.0 / 3.5 / 1.1 ms |

## 后续动作

- 基于本轮 browser window 选择下一个性能切片；候选方向是补 browser keyed reorder 场景，或直接分析 jsdom
  `10000 row keyed reorder` 热点。
