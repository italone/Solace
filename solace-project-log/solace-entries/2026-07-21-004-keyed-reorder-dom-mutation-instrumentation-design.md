# 2026-07-21-004：设计 keyed reorder DOM mutation instrumentation

## 基本信息

- 日期：2026-07-21
- 类型：performance design / browser benchmark instrumentation / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder DOM mutation instrumentation 设计规格，明确 supersede 旧的 matched patch skip 方向。新设计先在
browser benchmark 中统计 reorder update window 内的 DOM mutation counters，再基于真实信号选择下一轮 renderer
优化切片。

## 变动原因

旧计划的临时 RED test 已被验证为无效：当前 `patchElement()` 已经会在 props 与 children 都未变化时早退。继续执行
旧计划会重复现有比较逻辑，可能增加 changed node 的开销。下一步应先证明剩余成本来自 DOM move、keyed diff
bookkeeping，还是 props / children patch 重复成本。

## 影响范围

- 影响模块：performance 设计、browser benchmark planning、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档并标记旧设计为 superseded。
- 风险等级：低；不改 renderer、不改 benchmark runtime、不改 public API。

## 涉及文件

| 文件                                                                                                    | 动作 | 说明                          |
| ------------------------------------------------------------------------------------------------------- | ---- | ----------------------------- |
| `docs/superpowers/specs/2026-07-21-keyed-reorder-matched-patch-skip-design.md`                          | 修改 | 标记旧设计已被取代            |
| `docs/superpowers/specs/2026-07-21-keyed-reorder-dom-mutation-instrumentation-design.md`                | 新增 | 记录新的 instrumentation 设计 |
| `solace-project-log/solace-entries/2026-07-21-004-keyed-reorder-dom-mutation-instrumentation-design.md` | 新增 | 记录本次设计纠偏              |
| `solace-project-log/index.md`                                                                           | 修改 | 追加 2026-07-21 日志索引      |

## 验证记录

| 验证项           | 命令或方式         | 结果 |
| ---------------- | ------------------ | ---- |
| Placeholder scan | 检查设计稿占位符   | 通过 |
| Scope review     | 对照 renderer 现状 | 通过 |

## 后续动作

- 基于本设计写新的 implementation plan，先补 benchmark-facing RED tests，再实现 benchmark-only DOM mutation counters。
