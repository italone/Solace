# 2026-07-17-017：刷新 jsdom benchmark 趋势记录

## 基本信息

- 日期：2026-07-17
- 类型：jsdom benchmark / performance docs / project log
- 状态：已完成
- 关联提交：本条日志随趋势刷新提交一并提交

## 变动摘要

使用 3-sample jsdom benchmark 追加本地 history 记录，并更新性能文档中的 Latest Local Benchmark Run 说明。

## 变动原因

browser benchmark history 已刷新到 22 条记录，但 jsdom history 仍只有 1 条旧记录。继续推进性能工作前，需要补充当前 runtime 状态下的 jsdom benchmark 运行证据，确认 `pnpm benchmark` 覆盖的 5 个 Tinybench smoke 文件仍可重复通过。

## 影响范围

- 影响模块：jsdom benchmark history、性能文档、项目日志。
- 行为变化：无运行时代码变化；`.benchmark-history/jsdom.jsonl` 为本地 ignored 数据，不纳入提交。
- 风险等级：低；仅更新本地趋势记录与文档。

## 涉及文件

| 文件                                                                                | 动作 | 说明                          |
| ----------------------------------------------------------------------------------- | ---- | ----------------------------- |
| `docs/performance.md`                                                               | 修改 | 刷新 jsdom benchmark 运行说明 |
| `solace-project-log/solace-entries/2026-07-17-017-jsdom-benchmark-trend-refresh.md` | 新增 | 记录本次 jsdom benchmark 刷新 |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-17 日志索引      |

## 验证记录

| 验证项                  | 命令或方式                                                                                                   | 结果                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| jsdom benchmark samples | `SOLACE_BENCHMARK_HISTORY_PATH=.benchmark-history/jsdom.jsonl SOLACE_BENCHMARK_SAMPLE_SIZE=3 pnpm benchmark` | 通过，3 samples；每次 5 files / 5 tests   |
| Benchmark history       | `pnpm benchmark:history -- --min-browser-count 20 --json`                                                    | 通过，jsdom records 2；browser records 22 |
| 格式检查                | `pnpm format:check`                                                                                          | 通过                                      |
| Diff whitespace         | `git diff --check`                                                                                           | 通过                                      |
| Private boundary        | `package.json`                                                                                               | 保持 `"private": true`                    |

## 后续动作

- 下一轮如要继续做 runtime 性能优化，应先从最新 browser window、jsdom smoke 覆盖和现有 benchmark 缺口中选择一个最窄切片。
