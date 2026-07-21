# 2026-07-21-012：设计 keyed reorder move path instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance design / browser benchmark instrumentation / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder move path instrumentation 设计规格。设计要求在不改变 renderer 行为的前提下，为 keyed middle move
path 增加临时诊断 counters，并在 browser `keyed-reorder` summary 中记录 `movePathCounts`。

## 变动原因

最新 browser 数据显示 stable reverse reorder 的 DOM mutation 仍固定为 `insertBefore: 9999`，props/text/remove 均为
0；full-match bookkeeping skip 后 latest `reorderMs` median 为 4.7 ms。下一轮不应直接改 move 算法，而应先测清楚
LIS 长度、stable skip、move insert、mount/remove 和 anchor lookup 的实际分布。

## 影响范围

- 影响模块：renderer performance 设计、browser benchmark planning、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档。
- 风险等级：低；后续实现必须保证 counters 默认关闭，不改变 keyed diff 输出和 public API。

## 涉及文件

| 文件                                                                                                 | 动作 | 说明                                |
| ---------------------------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `docs/superpowers/specs/2026-07-21-keyed-reorder-move-path-instrumentation-design.md`                | 新增 | 记录 move path instrumentation 设计 |
| `solace-project-log/solace-entries/2026-07-21-012-keyed-reorder-move-path-instrumentation-design.md` | 新增 | 记录本次设计变更                    |
| `solace-project-log/index.md`                                                                        | 修改 | 追加 2026-07-21 日志索引            |

## 验证记录

| 验证项           | 命令或方式                                      | 结果 |
| ---------------- | ----------------------------------------------- | ---- |
| Context review   | 对照 latest browser counters 与 keyed diff 实现 | 通过 |
| Placeholder scan | 检查设计稿占位符                                | 通过 |

## 后续动作

- 用户确认设计后，进入 implementation plan：先补 renderer move-path counter RED tests，再实现默认关闭的内部 counters，
  最后扩展 browser benchmark result/history。
