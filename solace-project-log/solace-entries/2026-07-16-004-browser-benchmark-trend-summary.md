# 2026-07-16-004：记录 browser benchmark trend summary

## 基本信息

- 日期：2026-07-16
- 类型：performance docs / benchmark history / 本地验证 / 项目日志
- 状态：已完成
- 关联提交：本条日志随文档提交一并提交

## 变动摘要

记录本地 Chromium production benchmark history 的 3-run 汇总结果。原始 `.benchmark-history/*.jsonl` 文件继续保持
ignored，不进入版本库；文档只记录 median、p95 和 variance 作为趋势上下文。

## 变动原因

Fragment 初始挂载批量插入和稳定子组件 update skip 已完成后，需要先积累 browser benchmark trend，再讨论是否引入
性能阈值。三条 browser 样本仍不足以形成发布门槛，因此本次只记录趋势，不新增阈值或性能承诺。

## 影响范围

- 影响模块：性能文档、benchmark history 本地样本、项目日志。
- 行为变化：无 runtime 行为变化；无 benchmark 脚本变化。
- 风险等级：低；仅文档化本地趋势，且明确不作为 release threshold。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                          |
| ------------------------------------------------------------------------------------- | ---- | ----------------------------- |
| `docs/performance.md`                                                                 | 修改 | 增加本地 browser history 汇总 |
| `docs/superpowers/specs/2026-07-16-browser-benchmark-trend-summary-design.md`         | 新增 | 记录设计                      |
| `docs/superpowers/plans/2026-07-16-browser-benchmark-trend-summary.md`                | 新增 | 记录实施计划                  |
| `solace-project-log/solace-entries/2026-07-16-004-browser-benchmark-trend-summary.md` | 新增 | 记录本次变更                  |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-16 日志索引      |

## 本地趋势摘要

| Metric            | Count | Median | p95  | Variance |
| ----------------- | ----- | ------ | ---- | -------- |
| `initialRenderMs` | 3     | 15.2   | 28.7 | 45.14    |
| `updateMs`        | 3     | 7.0    | 15.9 | 20.55    |
| `unmountMs`       | 3     | 1.4    | 3.5  | 1.08     |

## 验证记录

| 验证项                  | 命令或方式                                                                                      | 结果                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| jsdom benchmark history | `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl pnpm benchmark`                   | 通过，写入 1 条 ignored jsdom history record     |
| Browser sample 1        | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 通过，large-list benchmark 通过                  |
| Browser sample 2        | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 通过，large-list benchmark 通过                  |
| Browser sample 3        | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser.jsonl pnpm benchmark:browser` | 通过，large-list benchmark 通过                  |
| History summary         | `pnpm benchmark:history -- --json`                                                              | 通过，4 条记录；browser large-list 3 条          |
| Ignored output check    | `git status --short --branch --ignored=matching`                                                | `.benchmark-history/` 显示为 ignored，不进入提交 |

## 后续动作

- 继续积累 browser benchmark history；至少多轮不同负载/环境样本后再评估阈值。
- 若后续要把趋势纳入 CI，应先设计波动容忍策略，避免单次 browser 抖动导致误报。
