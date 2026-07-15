# 2026-07-15-010：增加 browser benchmark history 记录

## 基本信息

- 日期：2026-07-15
- 类型：browser benchmark / Playwright helper / 脚本测试 / 性能文档 / README
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `pnpm benchmark:browser` 增加 opt-in JSONL history 记录。默认浏览器 benchmark 不写文件；设置
`SOLACE_BROWSER_BENCHMARK_HISTORY_PATH` 后，Playwright benchmark 会在 summary 断言通过后追加一条
`browser-benchmark` history record。

## 变动原因

jsdom benchmark 已支持本地 JSONL history，README 中仍保留 Chromium 生产构建 benchmark 趋势记录缺口。
浏览器 benchmark 已有稳定 summary object，本次直接持久化该 summary，不改变测量场景或引入统计聚合。

## 影响范围

- 影响模块：browser benchmark spec、Playwright helper、脚本单元测试、性能文档、README、项目日志。
- 行为变化：`SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=<path> pnpm benchmark:browser` 会在成功后追加 JSONL；默认 `pnpm benchmark:browser` 不写历史文件。
- 风险等级：低；不改 runtime framework source，不改 benchmark 场景，不设置性能阈值。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                |
| ------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `tests/e2e/browser-benchmark.spec.ts`                                           | 修改 | 成功 summary 后按需写入 history     |
| `tests/e2e/browser-benchmark-history.ts`                                        | 新增 | browser benchmark history helper    |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                          | 新增 | 覆盖路径解析和 JSONL append         |
| `docs/performance.md`                                                           | 修改 | 记录 browser history 环境变量和边界 |
| `readme.md`                                                                     | 修改 | 更新 benchmark trend 后续建议       |
| `docs/superpowers/specs/2026-07-15-browser-benchmark-history-design.md`         | 新增 | 记录设计                            |
| `docs/superpowers/plans/2026-07-15-browser-benchmark-history.md`                | 新增 | 记录实施计划                        |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-15 日志索引            |
| `solace-project-log/solace-entries/2026-07-15-010-browser-benchmark-history.md` | 新增 | 记录本次变更                        |

## 验证记录

| 验证项          | 命令或方式                                                                                                 | 结果                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TDD RED         | `pnpm test -- tests/unit/scripts/browser-benchmark-history.test.ts`                                        | 按预期失败，helper 模块尚不存在                   |
| Helper tests    | `pnpm test -- tests/unit/scripts/browser-benchmark-history.test.ts`                                        | 通过，21 个测试文件、151 个测试通过               |
| Browser history | `SOLACE_BROWSER_BENCHMARK_HISTORY_PATH=/tmp/solace-browser-benchmark-history.jsonl pnpm benchmark:browser` | 通过，Chromium benchmark 1 个测试通过并写入 JSONL |
| E2E             | `pnpm test:e2e`                                                                                            | 通过，3 个 Playwright 测试通过                    |
| Tests           | `pnpm test`                                                                                                | 通过，21 个测试文件、151 个测试通过               |
| Typecheck       | `pnpm typecheck`                                                                                           | 通过                                              |
| Lint            | `pnpm lint`                                                                                                | 通过                                              |
| Build           | `pnpm build`                                                                                               | 通过                                              |
| 格式检查        | `pnpm format:check`                                                                                        | 通过                                              |

## 后续动作

- 后续如果需要比较性能趋势，应在 JSONL history 之上增加 median、p95 和 variance 聚合。
- browser benchmark sample size 仍为 1；如需多样本，应单独设计 Playwright 侧采样和输出 schema。
