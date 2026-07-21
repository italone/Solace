# 2026-07-21-005：编写 keyed reorder DOM mutation instrumentation 实现计划

## 基本信息

- 日期：2026-07-21
- 类型：implementation plan / browser benchmark instrumentation / project log
- 状态：已完成

## 变动摘要

补写 keyed reorder DOM mutation instrumentation 的 implementation plan。计划要求先扩展 browser benchmark 和 history
测试，让 `keyed-reorder` summary 必须携带 `domMutationCounts`，再在 benchmark fixture 中实现只覆盖 reorder update
window 的 DOM mutation 计数。

## 变动原因

项目当前目标已经从发布转回性能深度开发。由于旧 renderer patch skip 计划不可产生有效 RED test，本轮需要先把测量面
补齐，避免在 renderer 中做没有数据支撑的优化。

## 影响范围

- 影响模块：implementation plan、browser benchmark instrumentation、项目日志。
- 行为变化：无运行时代码变化；本次仅新增计划文档并标记旧计划为 superseded。
- 风险等级：低；不改 renderer、不改 public API、不改 release flow。

## 涉及文件

| 文件                                                                                                  | 动作 | 说明                          |
| ----------------------------------------------------------------------------------------------------- | ---- | ----------------------------- |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-matched-patch-skip.md`                               | 修改 | 标记旧计划不应执行            |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-dom-mutation-instrumentation.md`                     | 新增 | 记录新的 instrumentation 计划 |
| `solace-project-log/solace-entries/2026-07-21-005-keyed-reorder-dom-mutation-instrumentation-plan.md` | 新增 | 记录本次计划变更              |
| `solace-project-log/index.md`                                                                         | 修改 | 追加 2026-07-21 日志索引      |

## 验证记录

| 验证项           | 命令或方式     | 结果 |
| ---------------- | -------------- | ---- |
| Placeholder scan | 检查计划占位符 | 通过 |
| Scope review     | 对照新设计目标 | 通过 |

## 后续动作

- 按计划进入 implementation 阶段：先写 failing benchmark/history assertions，再实现 benchmark-only counters，最后刷新
  browser benchmark 趋势窗口。
