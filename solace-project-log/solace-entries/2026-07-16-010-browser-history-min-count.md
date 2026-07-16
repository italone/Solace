# 2026-07-16-010：增加 browser history 最小样本数门禁

## 基本信息

- 日期：2026-07-16
- 类型：benchmark history CLI / 脚本测试 / 性能文档 / 项目日志
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `pnpm benchmark:history` 增加 opt-in `--min-browser-count` 参数。启用后，CLI 会要求每个 browser benchmark scenario
至少拥有指定数量的 history record；不足时以非零退出并输出明确错误。默认不启用，不改变普通 summary 行为。

## 变动原因

browser benchmark 已支持 repeated samples，但当前 history summary 只报告已有数据，不会提醒样本数过低。本次增加最小
record count 检查，用于本地或 CI 显式要求趋势数据达到最低样本数。该门禁只检查样本数量，不比较 timing，也不设置 release
performance threshold。

## 影响范围

- 影响模块：benchmark history CLI、脚本单元测试、性能文档、Changesets、项目日志。
- 行为变化：`pnpm benchmark:history -- --min-browser-count 5` 会在 browser history 样本数不足时失败。
- 风险等级：低；默认路径不启用该门禁，现有 `--json <path>` 用法保持兼容。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                  |
| ------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| `scripts/summarize-benchmark-history.mjs`                                       | 修改 | 增加 `--min-browser-count` 参数和校验 |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                          | 修改 | 覆盖满足、不足和非法参数路径          |
| `docs/performance.md`                                                           | 修改 | 记录 opt-in 最小 browser 样本数门禁   |
| `.changeset/performance-trend-readiness.md`                                     | 修改 | 补充 patch changeset 文案             |
| `solace-project-log/solace-entries/2026-07-16-010-browser-history-min-count.md` | 新增 | 记录本次变更                          |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-16 日志索引              |

## 验证记录

| 验证项             | 命令或方式                                                             | 结果                                         |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------------- |
| TDD RED            | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts` | 按预期失败，低样本和非法参数未被拒绝         |
| Targeted unit test | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts` | 通过，1 个测试文件、6 个测试通过             |
| Min-count success  | `pnpm benchmark:history -- --json --min-browser-count 7`               | 通过，browser `large-list` record count 为 7 |
| Min-count failure  | `pnpm benchmark:history -- --min-browser-count 8`                      | 按预期失败，提示当前 7 条低于要求 8 条       |
| Typecheck          | `pnpm typecheck`                                                       | 通过                                         |
| Lint               | `pnpm lint`                                                            | 通过                                         |
| 格式检查           | `pnpm format:check`                                                    | 通过                                         |

## 后续动作

- 如需把该门禁纳入 CI，应先选择明确的最低样本数，并避免把 timing p95/median 当作硬阈值。
