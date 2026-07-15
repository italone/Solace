# 2026-07-15-007：增加 benchmark sample size 配置

## 基本信息

- 日期：2026-07-15
- 类型：benchmark runner / metadata / 脚本测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

新增 `scripts/run-benchmark.mjs` 作为 `pnpm benchmark` 入口，默认仍执行 1 次 jsdom
benchmark smoke run。通过 `SOLACE_BENCHMARK_SAMPLE_SIZE` 可以显式配置独立 Vitest benchmark
样本次数，metadata 会记录实际 sample size。

## 变动原因

性能文档已经记录 jsdom benchmark 只有单次样本，无法支持重复采样。新增轻量 runner 可以在不放慢默认
benchmark 命令、不引入统计聚合或阈值的前提下，让本地性能验证按需重复执行。

## 影响范围

- 影响模块：benchmark package script、metadata CLI、runner CLI、脚本单元测试、性能文档、项目日志。
- 行为变化：`pnpm benchmark` 仍默认执行 1 次；设置 `SOLACE_BENCHMARK_SAMPLE_SIZE=N` 时执行 N 次。
- 风险等级：低；不改变 runtime framework source、browser benchmark harness 或 benchmark 阈值。

## 涉及文件

| 文件                                                                        | 动作 | 说明                             |
| --------------------------------------------------------------------------- | ---- | -------------------------------- |
| `scripts/run-benchmark.mjs`                                                 | 新增 | benchmark runner 和 dry-run 模式 |
| `scripts/benchmark-metadata.mjs`                                            | 修改 | 解析并记录 sample size           |
| `tests/unit/scripts/benchmark-metadata.test.ts`                             | 修改 | 覆盖 metadata sample size        |
| `tests/unit/scripts/run-benchmark.test.ts`                                  | 新增 | 覆盖 runner dry-run 和错误参数   |
| `package.json`                                                              | 修改 | `pnpm benchmark` 改走 runner     |
| `docs/performance.md`                                                       | 修改 | 记录 sample size 配置            |
| `docs/superpowers/specs/2026-07-15-benchmark-sample-size-design.md`         | 新增 | 记录设计                         |
| `docs/superpowers/plans/2026-07-15-benchmark-sample-size.md`                | 新增 | 记录实施计划                     |
| `solace-project-log/index.md`                                               | 修改 | 追加 2026-07-15 日志索引         |
| `solace-project-log/solace-entries/2026-07-15-007-benchmark-sample-size.md` | 新增 | 记录本次变更                     |

## 验证记录

| 验证项         | 命令或方式                                                                                            | 结果                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TDD RED        | `pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts` | 按预期失败，metadata 未解析 sample size，runner 文件缺失          |
| Error RED      | `pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts`                                          | 按预期失败，无效 sample size stderr 包含堆栈                      |
| Targeted tests | `pnpm test -- tests/unit/scripts/benchmark-metadata.test.ts tests/unit/scripts/run-benchmark.test.ts` | 通过，19 个测试文件、144 个测试通过                               |
| Benchmark      | `pnpm benchmark`                                                                                      | 通过，metadata 记录 `"sampleSize":1`，执行 `benchmark sample 1/1` |
| Tests          | `pnpm test`                                                                                           | 通过，19 个测试文件、144 个测试通过                               |
| Typecheck      | `pnpm typecheck`                                                                                      | 通过                                                              |
| Lint           | `pnpm lint`                                                                                           | 通过                                                              |
| Build          | `pnpm build`                                                                                          | 通过                                                              |
| 格式检查       | `pnpm format:check`                                                                                   | 通过                                                              |

## 后续动作

- 如果后续要发布性能结论，应在 runner 之外增加 median、p95 和 variance 聚合，而不是把多次 smoke run 当作统计结果。
- browser benchmark 仍保持独立 harness；如需同样支持多样本，应单独设计 Playwright 侧采样与摘要格式。
