# 2026-07-16-008：增加 browser benchmark sample size

## 基本信息

- 日期：2026-07-16
- 类型：browser benchmark / Playwright helper / 脚本测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 Chromium production browser benchmark 增加 `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE` 配置。默认值仍为 `1`，保持
`pnpm benchmark:browser` 作为快速 smoke benchmark；设置为正整数时，同一个 Playwright benchmark 会重复运行对应次数，
逐样本校验、输出 `browser benchmark summary`，并在配置 history path 时为每个样本追加独立 JSONL record。

## 变动原因

此前 browser benchmark history 只能通过多次手动运行累积样本。新增 sample size 后，可以用一次命令收集多个独立样本，
后续 `pnpm benchmark:history` 能直接基于更多原始记录计算 median、p95 和 variance。

## 影响范围

- 影响模块：browser benchmark Playwright spec、browser benchmark history helper、脚本单元测试、性能文档、Changesets。
- 行为变化：`SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=N pnpm benchmark:browser` 会运行 N 个 browser benchmark 样本。
- 风险等级：中低；默认仍为 1，非法 env 值会明确失败，不改变 benchmark app 和 release 默认耗时。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                      |
| ----------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `tests/e2e/browser-benchmark.spec.ts`                                               | 修改 | 按 sample size 循环运行 browser benchmark |
| `tests/e2e/browser-benchmark-history.ts`                                            | 修改 | 增加 sample size env 解析                 |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                              | 修改 | 覆盖默认、合法和非法 sample size          |
| `docs/performance.md`                                                               | 修改 | 记录 browser benchmark sample size 用法   |
| `.changeset/performance-trend-readiness.md`                                         | 修改 | 补充 patch changeset 文案                 |
| `solace-project-log/solace-entries/2026-07-16-008-browser-benchmark-sample-size.md` | 新增 | 记录本次变更                              |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-16 日志索引                  |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                                                             | 结果                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TDD RED                   | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`                                                                                                 | 按预期失败，新增 sample size parser 不存在                                 |
| Targeted unit test        | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts`                                                                                                 | 通过，1 个测试文件、5 个测试通过                                           |
| Typecheck                 | `pnpm typecheck`                                                                                                                                                       | 通过                                                                       |
| Lint                      | `pnpm lint`                                                                                                                                                            | 通过                                                                       |
| 格式检查                  | `pnpm format:check`                                                                                                                                                    | 通过                                                                       |
| Browser sample size       | `SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE=2 SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=.benchmark-history/browser-sample-size-stable-prefix-check.jsonl pnpm benchmark:browser` | 通过，输出 2 条 `browser benchmark summary`，且 `metadata.sampleSize` 为 2 |
| Benchmark history summary | `pnpm benchmark:history -- --json .benchmark-history/browser-sample-size-stable-prefix-check.jsonl`                                                                    | 通过，browser `large-list` record count 为 2                               |

## 后续动作

- 如果多样本运行成为常用 release 前检查，再考虑文档化推荐样本数和非阻塞趋势告警。
