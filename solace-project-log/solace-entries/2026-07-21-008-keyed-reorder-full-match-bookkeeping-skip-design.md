# 2026-07-21-008：设计 keyed reorder full-match bookkeeping skip

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance design / keyed reorder / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder full-match bookkeeping skip 设计规格。设计基于最新 browser mutation counters，将下一轮 renderer
性能切片收窄到 fully matched keyed middle segment 的 unused-old tracking：避免在没有旧节点需要卸载时仍分配
`Set<VNode>`、执行 `Set.add()` 和扫描 old children。

## 变动原因

最新 keyed reorder browser samples 显示 stable reverse reorder 中 props/text/remove DOM mutation 均为 0，主要 DOM
信号是 `insertBefore: 9999`。这说明下一轮不应继续推进 matched element patch skip，而应优先减少 keyed diff
bookkeeping 或单独设计 move path。当前 `patchKeyedChildren()` 的全匹配场景存在明确可测的 bookkeeping 成本，因此先设计
小范围优化。

## 影响范围

- 影响模块：renderer performance 设计、keyed diff planning、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档。
- 风险等级：低；后续实现必须保持 keyed LIS、DOM move ordering、insert/remove/mixed keyed behavior 不变。

## 涉及文件

| 文件                                                                                                   | 动作 | 说明                                  |
| ------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------- |
| `docs/superpowers/specs/2026-07-21-keyed-reorder-full-match-bookkeeping-skip-design.md`                | 新增 | 记录 full-match bookkeeping skip 设计 |
| `solace-project-log/solace-entries/2026-07-21-008-keyed-reorder-full-match-bookkeeping-skip-design.md` | 新增 | 记录本次设计变更                      |
| `solace-project-log/index.md`                                                                          | 修改 | 追加 2026-07-21 日志索引              |

## 验证记录

| 验证项           | 命令或方式                         | 结果 |
| ---------------- | ---------------------------------- | ---- |
| Context review   | 对照 browser counters 与 diff 实现 | 通过 |
| Placeholder scan | 检查设计稿占位符                   | 通过 |

## 后续动作

- 基于本设计写 implementation plan：先补 full matched keyed reorder RED test，再实现跳过 unused-old tracking 的小范围
  renderer 改动。
