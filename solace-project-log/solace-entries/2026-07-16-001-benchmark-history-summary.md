# 2026-07-16-001：增加 benchmark history 汇总命令

## 基本信息

- 日期：2026-07-16
- 类型：benchmark history CLI / 脚本测试 / 性能文档 / README
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

新增 `pnpm benchmark:history` 命令，用于读取本地 `.benchmark-history/*.jsonl` 文件并输出 benchmark history
汇总。JSON 输出包含 record count、分组信息，以及 browser benchmark timing metrics 的 median、p95 和 variance。

## 变动原因

jsdom 与 browser benchmark 都已经支持 opt-in JSONL history，但缺少本地聚合工具。新增只读汇总命令可以开始
比较趋势，同时不引入阈值、不修改 history 文件，也不改变 benchmark 运行路径。

## 影响范围

- 影响模块：benchmark history CLI、package scripts、脚本单元测试、性能文档、README、项目日志。
- 行为变化：新增 `pnpm benchmark:history`；默认读取 `.benchmark-history/jsdom.jsonl` 和 `.benchmark-history/browser.jsonl`，缺失文件会被忽略。
- 风险等级：低；脚本只读 history，不改 runtime source，不运行 benchmark，不写结果文件。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                     |
| ------------------------------------------------------------------------------- | ---- | ---------------------------------------- |
| `scripts/summarize-benchmark-history.mjs`                                       | 新增 | JSONL parser、分组与统计汇总 CLI         |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                          | 新增 | 覆盖 browser metrics、jsdom count 和错误 |
| `package.json`                                                                  | 修改 | 新增 `benchmark:history` script          |
| `docs/performance.md`                                                           | 修改 | 记录汇总命令和统计边界                   |
| `readme.md`                                                                     | 修改 | 更新 benchmark trend 后续建议            |
| `docs/superpowers/specs/2026-07-16-benchmark-history-summary-design.md`         | 新增 | 记录设计                                 |
| `docs/superpowers/plans/2026-07-16-benchmark-history-summary.md`                | 新增 | 记录实施计划                             |
| `solace-project-log/index.md`                                                   | 修改 | 新增 2026-07-16 日志索引                 |
| `solace-project-log/solace-entries/2026-07-16-001-benchmark-history-summary.md` | 新增 | 记录本次变更                             |

## 验证记录

| 验证项         | 命令或方式                                                          | 结果                                        |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| TDD RED        | `pnpm test -- tests/unit/scripts/benchmark-history-summary.test.ts` | 按预期失败，summary CLI 尚不存在            |
| Targeted tests | `pnpm test -- tests/unit/scripts/benchmark-history-summary.test.ts` | 通过，22 个测试文件、154 个测试通过         |
| CLI smoke      | `pnpm benchmark:history -- --json`                                  | 通过，缺失默认 history 文件时输出空 summary |
| Tests          | `pnpm test`                                                         | 通过，22 个测试文件、154 个测试通过         |
| Typecheck      | `pnpm typecheck`                                                    | 通过                                        |
| Lint           | `pnpm lint`                                                         | 通过                                        |
| Build          | `pnpm build`                                                        | 通过                                        |
| 格式检查       | `pnpm format:check`                                                 | 通过                                        |

## 后续动作

- 后续如需自动判断性能回归，应先确定 threshold policy，再将 `benchmark:history` 输出接入 CI。
- jsdom history 当前没有 Tinybench timing metrics；如果要汇总 jsdom 具体场景耗时，需要先扩展 history record schema。
