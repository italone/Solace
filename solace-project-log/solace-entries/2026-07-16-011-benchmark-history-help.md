# 2026-07-16-011：增加 benchmark history help 输出

## 基本信息

- 日期：2026-07-16
- 类型：benchmark history CLI / 脚本测试 / 性能文档 / 项目日志
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `scripts/summarize-benchmark-history.mjs` 增加 `--help` / `-h` 输出。`pnpm benchmark:history -- --help` 会打印
usage、`--json`、`--min-browser-count <count>` 和 help 选项说明，并以 0 退出，不读取 history 文件。

## 变动原因

benchmark history CLI 已有 JSON 输出和最小 browser 样本数门禁，继续只依赖文档发现参数会降低可用性。新增 help 输出让
本地和 CI 使用者能从 CLI 自身确认支持的参数。

## 影响范围

- 影响模块：benchmark history CLI、脚本单元测试、性能文档、项目日志。
- 行为变化：`pnpm benchmark:history -- --help` 和 `-h` 现在打印帮助并退出。
- 风险等级：低；普通 summary、`--json` 和 `--min-browser-count` 行为不变。

## 涉及文件

| 文件                                                                         | 动作 | 说明                        |
| ---------------------------------------------------------------------------- | ---- | --------------------------- |
| `scripts/summarize-benchmark-history.mjs`                                    | 修改 | 增加 help 参数和 usage 输出 |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                       | 修改 | 覆盖 help stdout 和 stderr  |
| `docs/performance.md`                                                        | 修改 | 记录 help 命令              |
| `solace-project-log/solace-entries/2026-07-16-011-benchmark-history-help.md` | 新增 | 记录本次变更                |
| `solace-project-log/index.md`                                                | 修改 | 追加 2026-07-16 日志索引    |

## 验证记录

| 验证项             | 命令或方式                                                             | 结果                                                |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------- |
| TDD RED            | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts` | 按预期失败，`--help` 输出空 summary                 |
| Targeted unit test | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts` | 通过，1 个测试文件、7 个测试通过                    |
| Help command       | `pnpm benchmark:history -- --help`                                     | 通过，输出 usage、`--json` 和 `--min-browser-count` |
| Typecheck          | `pnpm typecheck`                                                       | 通过                                                |
| Lint               | `pnpm lint`                                                            | 通过                                                |
| 格式检查           | `pnpm format:check`                                                    | 通过                                                |

## 后续动作

- 如果继续扩展 benchmark history CLI 参数，应同步更新 help 输出和 CLI 测试。
