# 2026-07-16-007：更新 browser benchmark history trend

## 基本信息

- 日期：2026-07-16
- 类型：browser benchmark / benchmark history / 性能文档 / 项目日志
- 状态：已完成
- 关联提交：本条日志随文档提交一并提交

## 变动摘要

运行一轮 Chromium production browser benchmark，并将新样本追加到本地忽略的 `.benchmark-history/browser.jsonl`。随后使用
`pnpm benchmark:history -- --json` 汇总本地 history，将 `docs/performance.md` 的 latest browser trend 从 3 条样本更新为
4 条样本。

## 本次样本

| Metric            | Value |
| ----------------- | ----- |
| `initialRenderMs` | 14.0  |
| `updateMs`        | 5.6   |
| `unmountMs`       | 1.3   |

## 汇总结果

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 4     | 14.6   | 28.7 | 38.99    |
| `updateMs`        | 4     | 6.35   | 15.9 | 18.31    |
| `unmountMs`       | 4     | 1.35   | 3.5  | 0.91     |

## 影响范围

- 影响模块：性能文档、项目日志、本地 ignored benchmark history。
- 行为变化：无 runtime 行为变化。
- 风险等级：低；仍明确这些样本是本地趋势上下文，不作为 release threshold。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                               |
| ------------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `docs/performance.md`                                                                 | 修改 | 更新 latest local browser trend 表 |
| `solace-project-log/solace-entries/2026-07-16-007-browser-benchmark-trend-refresh.md` | 新增 | 记录本次 benchmark trend refresh   |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-16 日志索引           |
| `.benchmark-history/browser.jsonl`                                                    | 忽略 | 追加本地样本，不提交               |

## 验证记录

| 验证项                    | 命令或方式                                                                                      | 结果                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| Browser benchmark         | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 通过，1 个 Chromium benchmark 测试通过 |
| Benchmark history summary | `pnpm benchmark:history -- --json`                                                              | 通过，browser `large-list` 样本数为 4  |

## 后续动作

- 继续累积 browser benchmark history，再决定是否设计非阻塞趋势告警或 release 阈值。
- 若要把 keyed local update 优化效果做成更强证据，应增加 browser benchmark 的 repeated samples，而不是从单次样本推结论。
