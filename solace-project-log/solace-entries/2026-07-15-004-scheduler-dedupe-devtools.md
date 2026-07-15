# 2026-07-15-004：补充 scheduler dedupe DevTools summary

## 基本信息

- 日期：2026-07-15
- 类型：DevTools runtime hook / scheduler / payload stability / 文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

扩展 `scheduler:flush` DevTools summary，新增 `dedupedJobs` 标量字段，用于记录同一 flush 周期内被 scheduler 去重跳过的 queue attempts。payload 不包含 scheduler job 函数、函数名、调用栈、component instance、reactive effect、VNode、DOM 或用户数据。

## 变动原因

DevTools 文档已将 scheduler 的 queued jobs、flush duration 和 skipped stale jobs 列为有用信号。现有 `scheduler:flush` 仅记录实际执行 job 数和耗时，本次补充 dedupe count，帮助调试重复调度，同时保持 payload summary-only。

## 影响范围

- 影响模块：scheduler runtime、DevTools event union、DevTools serializer、scheduler 单元测试、payload stability 集成测试、DevTools 文档、项目日志。
- 行为变化：存在 DevTools listener 时，重复 queue attempts 会计入 `dedupedJobs` 并随 `scheduler:flush` 派发；无 listener 时保持轻量路径。
- 风险等级：中；涉及 scheduler 热路径，但只在 duplicate branch 中做 listener guard 和计数。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                  |
| ------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| `src/scheduler/scheduler.ts`                                                    | 修改 | 统计并派发 guarded dedupe summary     |
| `src/devtools/events.ts`                                                        | 修改 | 扩展 `scheduler:flush` 类型和序列化   |
| `tests/unit/scheduler/scheduler.test.ts`                                        | 修改 | 覆盖 deduped jobs summary             |
| `tests/integration/devtools-payload-stability.test.ts`                          | 修改 | 验证 scheduler payload allowed fields |
| `docs/devtools.md`                                                              | 修改 | 记录 scheduler dedupe summary 边界    |
| `docs/superpowers/specs/2026-07-15-scheduler-dedupe-devtools-design.md`         | 新增 | 记录设计                              |
| `docs/superpowers/plans/2026-07-15-scheduler-dedupe-devtools.md`                | 新增 | 记录实施计划                          |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-15 日志索引              |
| `solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md` | 新增 | 记录本次变更                          |

## 验证记录

| 验证项            | 命令或方式                                                                                                 | 结果                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Targeted tests    | `pnpm test -- tests/unit/scheduler/scheduler.test.ts tests/integration/devtools-payload-stability.test.ts` | 通过，18 个测试文件、138 个测试通过 |
| Tests             | `pnpm test`                                                                                                | 通过                                |
| Typecheck         | `pnpm typecheck`                                                                                           | 通过                                |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                                                                    | 通过                                |
| Lint              | `pnpm lint`                                                                                                | 通过                                |
| Build             | `pnpm build`                                                                                               | 通过                                |
| 格式检查          | `pnpm format:check`                                                                                        | 通过                                |

## 后续动作

- 后续 scheduler DevTools 扩展应继续只暴露 summary scalar，不暴露 job 函数或 runtime references。
- 可继续评估 renderer diff count 或 scheduler error summary。
