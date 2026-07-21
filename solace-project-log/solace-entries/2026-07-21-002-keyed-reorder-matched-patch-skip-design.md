# 2026-07-21-002：设计 keyed reorder matched patch skip

## 基本信息

- 日期：2026-07-21
- 类型：renderer performance design / keyed reorder / project log
- 状态：已完成

## 变动摘要

新增 keyed reorder matched patch skip 设计规格，明确下一轮 renderer 性能切片不继续压 DOM move 数量，而是针对
keyed reorder 中已匹配且 DOM 输出不变的 element VNode，设计保守的 no-op patch skip。

## 变动原因

最新 browser keyed reorder baseline 已建立：`reorderMs` median 4.6 ms，p95 6.2 ms。当前 renderer 已有 LIS move
优化；全反转场景本身稳定子序列很短，继续优化 move 数量收益不明确。更合适的下一步是减少 matched keyed rows
在 patch 阶段的重复 props / children 检查成本。

## 影响范围

- 影响模块：renderer performance 设计、项目日志。
- 行为变化：无运行时代码变化；本次只新增设计文档。
- 风险等级：低；后续实现必须保持 public API、keyed LIS、DOM move ordering、component 和 Fragment 行为不变。

## 涉及文件

| 文件                                                                                          | 动作 | 说明                                       |
| --------------------------------------------------------------------------------------------- | ---- | ------------------------------------------ |
| `docs/superpowers/specs/2026-07-21-keyed-reorder-matched-patch-skip-design.md`                | 新增 | 记录 matched keyed element patch skip 设计 |
| `solace-project-log/solace-entries/2026-07-21-002-keyed-reorder-matched-patch-skip-design.md` | 新增 | 记录本次设计变更                           |
| `solace-project-log/index.md`                                                                 | 修改 | 追加 2026-07-21 日志索引                   |

## 验证记录

| 验证项           | 命令或方式          | 结果 |
| ---------------- | ------------------- | ---- |
| Placeholder scan | 检查设计稿占位符    | 通过 |
| 格式检查         | `pnpm format:check` | 通过 |
| Diff whitespace  | `git diff --check`  | 通过 |

## 后续动作

- 用户确认设计后，进入 implementation plan：先补 renderer diff 单元测试，再实现保守 predicate 和 no-op element patch
  skip，最后跑 browser benchmark 验证趋势。
