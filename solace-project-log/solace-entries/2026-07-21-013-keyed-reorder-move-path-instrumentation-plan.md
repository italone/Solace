# 2026-07-21-013：编写 keyed reorder move path instrumentation 实现计划

## 基本信息

- 日期：2026-07-21
- 类型：implementation plan / renderer performance instrumentation / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder move path instrumentation 实现计划，明确先写 renderer RED tests，再实现默认关闭的内部 counters，
最后扩展 browser benchmark result/history 和 performance docs。

## 变动原因

设计规格已确认。下一步需要把 move-path instrumentation 拆成可执行、可验证的 TDD 任务，避免直接进入 renderer
优化或改变 keyed diff 行为。

## 影响范围

- 影响模块：implementation planning、renderer performance、browser benchmark planning、项目日志。
- 行为变化：无运行时代码变化；本次只新增计划文档。
- 风险等级：低；计划明确不修改 package exports，不提交 `.benchmark-history/**`。

## 涉及文件

| 文件                                                                                               | 动作 | 说明                                |
| -------------------------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-move-path-instrumentation.md`                     | 新增 | 记录 move path instrumentation 计划 |
| `solace-project-log/solace-entries/2026-07-21-013-keyed-reorder-move-path-instrumentation-plan.md` | 新增 | 记录本次计划变更                    |
| `solace-project-log/index.md`                                                                      | 修改 | 追加 2026-07-21 日志索引            |

## 验证记录

| 验证项           | 命令或方式                   | 结果 |
| ---------------- | ---------------------------- | ---- |
| Spec coverage    | 对照 012 design spec         | 通过 |
| Placeholder scan | 检查计划文档占位符和模糊指令 | 通过 |
| Format check     | `pnpm format:check`          | 通过 |
| Whitespace check | `git diff --check`           | 通过 |

## 后续动作

- 用户选择执行方式后，按计划进入实现：RED tests、renderer counters、browser `movePathCounts`、trend refresh。
