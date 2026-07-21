# 2026-07-21-001：刷新 browser keyed reorder 趋势样本

## 基本信息

- 日期：2026-07-21
- 类型：browser benchmark / performance docs / project log
- 状态：已完成

## 变动摘要

追加 5 个 Chromium production browser benchmark samples。当前 browser benchmark 已包含 `large-list` 与
`keyed-reorder` 两个场景，因此本次运行向本地 ignored history 追加 10 条 browser records，并刷新性能文档中的
full-history 与 latest-window 趋势表。

## 变动原因

第一版发布后，性能线继续按计划深度开发。上一轮已经补齐 browser keyed reorder 场景；本轮需要先补样本窗口，
让后续 renderer 优化切片基于真实浏览器趋势选择。

## 影响范围

- 影响模块：browser benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/browser.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                      | 动作 | 说明                              |
| ----------------------------------------------------------------------------------------- | ---- | --------------------------------- |
| `docs/performance.md`                                                                     | 修改 | 刷新 browser keyed reorder 趋势表 |
| `solace-project-log/solace-entries/2026-07-21-001-browser-keyed-reorder-trend-refresh.md` | 新增 | 记录本次趋势刷新                  |
| `solace-project-log/index.md`                                                             | 修改 | 新增 2026-07-21 日志索引          |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                 | 结果                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Browser benchmark samples | `env SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=5 pnpm benchmark:browser` | 通过，5 samples；追加 5 条 `large-list` 与 5 条 `keyed-reorder` records                  |
| Full browser history      | `pnpm benchmark:history -- --json`                                                                                                         | 通过，browser records: `large-list` 55，`keyed-reorder` 5；`keyed-reorder` median 4.6 ms |
| Latest browser history    | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json`                                                          | 通过，两个 browser scenario 均满足 latest count 5                                        |

## 后续动作

- 基于新 browser keyed reorder baseline 进入下一轮性能切片设计；候选方向是分析 keyed reorder DOM move / patch 路径，
  但需要先写设计规格再进入实现计划。
