# 2026-07-14-003：补充 jsdom benchmark 元数据

## 基本信息

- 日期：2026-07-14
- 类型：工具 / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `scripts/benchmark-metadata.mjs`，让 `pnpm benchmark` 在运行 jsdom Tinybench smoke suite 前输出 `benchmark metadata` JSON。metadata 包含 package、Node、OS、CPU、memory、benchmark runner、benchmark environment、sample size 和 run timestamp。

## 变动原因

Chromium browser benchmark 已经输出可复现元数据，但 jsdom benchmark 仍缺少同类环境上下文。补充 metadata 后，两个 benchmark 命令都能提供机器、运行时和样本量信息，便于后续趋势记录，同时仍不引入阈值或性能宣称。

## 影响范围

- 影响模块：benchmark tooling、package scripts、性能文档、README、项目日志。
- 行为变化：`pnpm benchmark` 会先输出 `benchmark metadata` JSON，再运行现有 Vitest benchmark suite。
- 风险等级：低；新增只读 metadata 脚本，不修改 runtime 或 benchmark 场景。

## 涉及文件

| 文件                                                                           | 动作 | 说明                               |
| ------------------------------------------------------------------------------ | ---- | ---------------------------------- |
| `scripts/benchmark-metadata.mjs`                                               | 新增 | jsdom benchmark metadata CLI       |
| `tests/unit/scripts/benchmark-metadata.test.ts`                                | 新增 | 验证 CLI JSON 输出                 |
| `package.json`                                                                 | 修改 | `benchmark` script 先输出 metadata |
| `docs/performance.md`                                                          | 修改 | 记录 jsdom benchmark metadata 语义 |
| `readme.md`                                                                    | 修改 | 更新后续 benchmark 建议            |
| `docs/superpowers/specs/2026-07-14-jsdom-benchmark-metadata-design.md`         | 新增 | 记录设计                           |
| `docs/superpowers/plans/2026-07-14-jsdom-benchmark-metadata.md`                | 新增 | 记录实施计划                       |
| `solace-project-log/index.md`                                                  | 修改 | 追加本次日志索引                   |
| `solace-project-log/solace-entries/2026-07-14-003-jsdom-benchmark-metadata.md` | 新增 | 记录本次变更                       |

## 验证记录

| 验证项             | 命令或方式                                                           | 结果                                                                 |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TDD red            | `pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts` | 通过，脚本缺失时测试按预期失败                                       |
| Targeted test      | `pnpm exec vitest run tests/unit/scripts/benchmark-metadata.test.ts` | 通过，1 个目标测试通过                                               |
| Benchmark metadata | `node scripts/benchmark-metadata.mjs`                                | 通过，输出 `benchmark metadata` JSON                                 |
| Benchmark          | `pnpm benchmark`                                                     | 通过，先输出 metadata，5 个 benchmark 文件、5 个 benchmark 测试通过  |
| Typecheck          | `pnpm typecheck`                                                     | 通过，无类型错误                                                     |
| Lint               | `pnpm lint`                                                          | 通过，无 ESLint 错误                                                 |
| Tests              | `pnpm test`                                                          | 通过，15 个测试文件、115 个测试通过                                  |
| Build              | `pnpm build`                                                         | 通过，Rollup 产物构建成功                                            |
| E2E                | `pnpm test:e2e`                                                      | 通过，提升权限允许本地 dev server 监听端口后，3 个普通 e2e spec 通过 |
| 格式检查           | `pnpm format:check`                                                  | 通过，所有匹配文件符合 Prettier 风格                                 |

## 后续动作

- 后续可评估历史结果文件或自定义 reporter，但本次不引入。
