# 2026-07-16-009：使用 repeated samples 刷新 browser trend

## 基本信息

- 日期：2026-07-16
- 类型：browser benchmark / benchmark history / 性能文档 / 项目日志
- 状态：已完成
- 关联提交：本条日志随文档提交一并提交

## 变动摘要

使用 `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=3` 运行 Chromium production browser benchmark，一次命令追加 3 条本地
browser history record。随后使用 `pnpm benchmark:history -- --json` 汇总本地 ignored history，并将
`docs/performance.md` 的 latest browser trend 从 4 条样本更新为 7 条样本。

## 本次新增样本

| Sample | `initialRenderMs` | `updateMs` | `unmountMs` |
| ------ | ----------------- | ---------- | ----------- |
| 1      | 14.4              | 5.7        | 1.3         |
| 2      | 8.0               | 3.6        | 1.2         |
| 3      | 6.0               | 3.3        | 1.2         |

## 汇总结果

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 7     | 14.0   | 28.7 | 45.3     |
| `updateMs`        | 7     | 5.7    | 15.9 | 15.59    |
| `unmountMs`       | 7     | 1.3    | 3.5  | 0.62     |

## 影响范围

- 影响模块：性能文档、项目日志、本地 ignored benchmark history。
- 行为变化：无 runtime 行为变化。
- 风险等级：低；仍明确这些样本是本地趋势上下文，不作为 release threshold。

## 涉及文件

| 文件                                                                                | 动作 | 说明                               |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------- |
| `docs/performance.md`                                                               | 修改 | 更新 latest local browser trend 表 |
| `solace-project-log/solace-entries/2026-07-16-009-browser-repeated-sample-trend.md` | 新增 | 记录 repeated sample trend refresh |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-16 日志索引           |
| `.benchmark-history/browser.jsonl`                                                  | 忽略 | 追加本地样本，不提交               |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                             | 结果                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Browser repeated samples  | `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=3 SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 通过，1 个 Chromium benchmark 测试通过并输出 3 条 summary |
| Benchmark history summary | `pnpm benchmark:history -- --json`                                                                                                     | 通过，browser `large-list` 样本数为 7                     |

## 后续动作

- 继续观察多样本 trend；如果 repeated samples 成为常规流程，再考虑非阻塞趋势告警。
- 不要从当前 7 条本地样本设置 release threshold。
