# 2026-07-15-006：优化 keyed children diff 的 DOM move

## 基本信息

- 日期：2026-07-15
- 类型：renderer diff / LIS / 单元测试 / 架构文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

在 keyed unique-key 的 children diff 中引入 LIS 计算，只对不在稳定子序列中的节点执行移动，从而减少
`insertBefore` 调用。实现保留现有前后缀收缩、重复 key 回退和 unkeyed diff 语义不变。

## 变动原因

现有 keyed diff 在中段会把每个节点都重新插入一次，虽然最终 DOM 正确，但对已经处于稳定相对顺序的
节点会做多余移动。LIS 可以在不牺牲 DOM 复用的前提下减少这些 move。

## 影响范围

- 影响模块：renderer diff、架构文档、单元测试、项目日志。
- 行为变化：对稳定 keyed reorders，`insertBefore` 次数下降；最终 DOM 顺序与节点复用语义不变。
- 风险等级：中；只影响 keyed unique-key 的中段路径，fallback 逻辑保持不变。

## 涉及文件

| 文件                                                                              | 动作 | 说明                       |
| --------------------------------------------------------------------------------- | ---- | -------------------------- |
| `src/renderer/diff.ts`                                                            | 修改 | keyed-middle LIS 优化      |
| `tests/unit/renderer/diff.test.ts`                                                | 修改 | 增加 move 计数回归测试     |
| `docs/architecture.md`                                                            | 修改 | 记录 keyed-middle LIS 说明 |
| `docs/superpowers/specs/2026-07-15-renderer-keyed-children-lis-design.md`         | 新增 | 记录设计                   |
| `docs/superpowers/plans/2026-07-15-renderer-keyed-children-lis.md`                | 新增 | 记录实施计划               |
| `solace-project-log/index.md`                                                     | 修改 | 追加 2026-07-15 日志索引   |
| `solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md` | 新增 | 记录本次变更               |

## 验证记录

| 验证项         | 命令或方式                                              | 结果                                        |
| -------------- | ------------------------------------------------------- | ------------------------------------------- |
| TDD RED        | `pnpm exec vitest run tests/unit/renderer/diff.test.ts` | 按预期失败，insertBefore 调用 4 次而非 2 次 |
| Targeted tests | `pnpm exec vitest run tests/unit/renderer/diff.test.ts` | 通过，1 个测试文件、11 个测试通过           |
| Tests          | `pnpm test`                                             | 通过，18 个测试文件、139 个测试通过         |
| Typecheck      | `pnpm typecheck`                                        | 通过                                        |
| Lint           | `pnpm lint`                                             | 通过                                        |
| Build          | `pnpm build`                                            | 通过                                        |
| 格式检查       | `pnpm format:check`                                     | 通过                                        |

## 后续动作

- 后续 keyed diff 若继续扩展，应保持 duplicate-key fallback 和 unkeyed fallback 的语义不变。
- 如果未来需要进一步优化，优先从更细的 move 计数或 keyed patch 热点入手，而不是改动 public API。
