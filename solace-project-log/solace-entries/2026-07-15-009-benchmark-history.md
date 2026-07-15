# 2026-07-15-009：增加 jsdom benchmark history 记录

## 基本信息

- 日期：2026-07-15
- 类型：benchmark runner / metadata helper / 脚本测试 / 性能文档 / README
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `pnpm benchmark` 增加 opt-in JSONL history 记录。默认 benchmark 行为不写文件；设置
`SOLACE_BENCHMARK_HISTORY_PATH` 后，runner 会在所有 jsdom benchmark samples 成功后追加一条
`jsdom-benchmark` history record。

## 变动原因

README 已将 benchmark 趋势记录列为后续方向。直接默认写历史文件会造成工作树噪音，因此本次只提供显式
环境变量入口，并继续避免 timing 聚合和性能阈值。

## 影响范围

- 影响模块：benchmark runner、metadata helper、脚本单元测试、性能文档、README、项目日志。
- 行为变化：`SOLACE_BENCHMARK_HISTORY_PATH=<path> pnpm benchmark` 会在成功后追加 JSONL；默认 `pnpm benchmark` 不写历史文件。
- 风险等级：低；不改 runtime framework source，不改 browser benchmark harness，不设置性能阈值。

## 涉及文件

| 文件                                                                    | 动作 | 说明                                      |
| ----------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `scripts/run-benchmark.mjs`                                             | 修改 | 增加 opt-in history path 和 JSONL append  |
| `scripts/benchmark-metadata.mjs`                                        | 修改 | 导出 metadata helper，保留 CLI 行为       |
| `tests/unit/scripts/run-benchmark.test.ts`                              | 修改 | 覆盖 dry-run、空路径错误和 history append |
| `tests/unit/scripts/benchmark-metadata.test.ts`                         | 修改 | 验证 metadata CLI 仍正常                  |
| `.gitignore`                                                            | 修改 | 忽略默认示例 history 目录                 |
| `docs/performance.md`                                                   | 修改 | 记录 history 环境变量和边界               |
| `readme.md`                                                             | 修改 | 更新 benchmark trend 后续建议             |
| `docs/superpowers/specs/2026-07-15-benchmark-history-design.md`         | 新增 | 记录设计                                  |
| `docs/superpowers/plans/2026-07-15-benchmark-history.md`                | 新增 | 记录实施计划                              |
| `solace-project-log/index.md`                                           | 修改 | 追加 2026-07-15 日志索引                  |
| `solace-project-log/solace-entries/2026-07-15-009-benchmark-history.md` | 新增 | 记录本次变更                              |

## 验证记录

| 验证项         | 命令或方式                                                                                            | 结果                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| TDD RED        | `pnpm test -- tests/unit/scripts/run-benchmark.test.ts`                                               | 按预期失败，runner 尚不输出 historyPath，也不写 JSONL            |
| Targeted tests | `pnpm test -- tests/unit/scripts/run-benchmark.test.ts tests/unit/scripts/benchmark-metadata.test.ts` | 通过，20 个测试文件、148 个测试通过                              |
| Benchmark      | `pnpm benchmark`                                                                                      | 通过，5 个 benchmark 文件、5 个测试通过，默认不要求 history path |
| Tests          | `pnpm test`                                                                                           | 通过，20 个测试文件、148 个测试通过                              |
| Typecheck      | `pnpm typecheck`                                                                                      | 通过                                                             |
| Lint           | `pnpm lint`                                                                                           | 通过                                                             |
| Build          | `pnpm build`                                                                                          | 通过                                                             |
| 格式检查       | `pnpm format:check`                                                                                   | 通过                                                             |

## 后续动作

- 后续可以为 browser benchmark 增加独立 history 记录，但应先设计 Playwright summary 的稳定 schema。
- 如果要发布性能结论，应增加 median、p95 和 variance 聚合，而不是直接使用单条 history record。
