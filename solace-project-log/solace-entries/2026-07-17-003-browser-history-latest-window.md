# 2026-07-17-003：增加 browser history 最新窗口汇总

## 基本信息

- 日期：2026-07-17
- 类型：benchmark history CLI / 单元测试 / 性能文档 / 项目日志
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `pnpm benchmark:history` 增加 `--latest-browser-count <count>` 选项，用于按 browser benchmark scenario
只汇总最新 N 条记录。该选项保留 jsdom 记录计数，并在 browser 记录进入分组统计前按 JSONL 读取顺序裁剪每个 scenario
的尾部窗口。

## 变动原因

12 条 browser history 的全量 p95 仍由旧慢样本主导，不能直接说明最新 renderer/runtime 趋势仍存在同等程度热点。增加最新窗口汇总后，可以同时保留全量历史和近期窗口，避免下一轮优化选点被过期离群样本误导。

## 影响范围

- 影响模块：benchmark history CLI、脚本单元测试、性能文档、Changesets、项目日志。
- 行为变化：`pnpm benchmark:history -- --latest-browser-count N` 只统计每个 browser scenario 的最新 N 条记录。
- 风险等级：低；默认命令行为不变，非法参数继续非零退出。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                         |
| ----------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `scripts/summarize-benchmark-history.mjs`                                           | 修改 | 增加 `--latest-browser-count` 参数和裁剪逻辑 |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                              | 修改 | 覆盖 help、最新窗口统计、非法参数            |
| `docs/performance.md`                                                               | 修改 | 记录 latest-window 用法和本地最新 5 样本趋势 |
| `.changeset/performance-trend-readiness.md`                                         | 修改 | 补充 patch changeset 文案                    |
| `solace-project-log/solace-entries/2026-07-17-003-browser-history-latest-window.md` | 新增 | 记录本次变更                                 |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-17 日志索引                     |

## 验证记录

| 验证项                | 命令或方式                                                                        | 结果                                                                   |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED               | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`            | 按预期失败，help/summary/invalid count 均缺少 latest-window 支持       |
| Targeted script tests | `pnpm vitest run tests/unit/scripts/benchmark-history-summary.test.ts`            | 通过，1 个测试文件、9 个测试通过                                       |
| Latest browser window | `pnpm benchmark:history -- --latest-browser-count 5 --min-browser-count 5 --json` | 通过，latest browser `large-list` 记录数 5；median: 6.8 / 3.3 / 1.2 ms |
| 格式检查              | `pnpm format:check`                                                               | 通过                                                                   |
| Typecheck             | `pnpm typecheck`                                                                  | 通过                                                                   |
| Lint                  | `pnpm lint`                                                                       | 通过                                                                   |
| Full tests            | `pnpm test`                                                                       | 通过，22 个测试文件、173 个测试通过                                    |
| Build                 | `pnpm build`                                                                      | 通过                                                                   |
| Diff whitespace       | `git diff --check`                                                                | 通过                                                                   |

## 后续动作

- 下一轮性能开发应同时查看 full-history 和 `--latest-browser-count 5` 输出；如果 latest-window 继续稳定，优先进入 release readiness 收口，而不是继续 runtime 微优化。
