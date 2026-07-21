# 2026-07-21-009：编写 keyed reorder full-match bookkeeping skip 实现计划

## 基本信息

- 日期：2026-07-21
- 类型：implementation plan / renderer performance / project log
- 状态：已完成

## 变动摘要

补写 keyed reorder full-match bookkeeping skip 的 implementation plan。计划要求先用 `globalThis.Set` spy 写出 RED
测试，证明 fully matched keyed reorder 当前仍构造 unused tracking Set，再实现 `matchedOldCount` 与
`newIndexToOldIndexMap` 派生 unused detection。

## 变动原因

设计规格已经明确下一刀不动 DOM move / LIS path，而是减少全匹配 keyed middle segment 的内部 bookkeeping 成本。进入
renderer 改动前，需要把测试、实现、文档、日志和 benchmark 验证拆成可执行步骤。

## 影响范围

- 影响模块：implementation plan、renderer keyed diff、项目日志。
- 行为变化：无运行时代码变化；本次仅新增计划文档与日志。
- 风险等级：低；不改 renderer、不改 benchmark、不改 public API。

## 涉及文件

| 文件                                                                                                 | 动作 | 说明                                  |
| ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| `docs/superpowers/plans/2026-07-21-keyed-reorder-full-match-bookkeeping-skip.md`                     | 新增 | 记录 full-match bookkeeping skip 计划 |
| `solace-project-log/solace-entries/2026-07-21-009-keyed-reorder-full-match-bookkeeping-skip-plan.md` | 新增 | 记录本次计划变更                      |
| `solace-project-log/index.md`                                                                        | 修改 | 追加 2026-07-21 日志索引              |

## 验证记录

| 验证项           | 命令或方式     | 结果 |
| ---------------- | -------------- | ---- |
| Placeholder scan | 检查计划占位符 | 通过 |
| Scope review     | 对照设计规格   | 通过 |

## 后续动作

- 按计划进入 implementation 阶段：先补 failing renderer test，再实现 full-match bookkeeping skip，最后运行 renderer
  tests、benchmark 与质量门禁。
