# 2026-07-16-012：优化 keyed mixed insert/move 挂载

## 基本信息

- 日期：2026-07-16
- 类型：renderer keyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 keyed children diff 的未知序列分支：新 keyed child 不再先以 `anchor=null` append 到容器尾部，再在反向放置阶段移动到
目标位置；现在会延迟到反向放置阶段，直接使用最终 anchor 挂载。这样 mixed insert/move 场景可以减少一次多余 DOM
`insertBefore`。

## 变动原因

近期 keyed list 优化已经减少稳定 sibling 的无效 patch，但在包含新增节点和移动节点的 mixed patch 中，新节点仍会经历
append + move 两次插入操作。本次保留现有 LIS 移动策略，只调整新增节点的挂载时机，改动面小且可用 DOM 操作计数回归。

## 影响范围

- 影响模块：renderer keyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：mixed keyed insert/move 中的新节点会直接挂载到最终 anchor，减少多余 DOM insert。
- 风险等级：中低；只改变未知 keyed 序列中新节点的挂载时机，已存在节点 patch、remove 和 LIS move 路径保持不变。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                       |
| ----------------------------------------------------------------------------- | ---- | ------------------------------------------ |
| `src/renderer/diff.ts`                                                        | 修改 | 延迟新 keyed child 挂载到反向放置阶段      |
| `tests/unit/renderer/diff.test.ts`                                            | 修改 | 覆盖 mixed insert/move 的 DOM insert 计数  |
| `tests/performance/list-diff.bench.ts`                                        | 修改 | 增加 keyed mixed insert and move benchmark |
| `docs/performance.md`                                                         | 修改 | 记录 keyed mixed insert/move 覆盖和优化    |
| `.changeset/performance-trend-readiness.md`                                   | 修改 | 补充 patch changeset 文案                  |
| `solace-project-log/solace-entries/2026-07-16-012-keyed-mixed-insert-move.md` | 新增 | 记录本次变更                               |
| `solace-project-log/index.md`                                                 | 修改 | 追加 2026-07-16 日志索引                   |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，mixed insert/move 实际 3 次 insert，期望 2 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、14 个测试通过                      |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                   |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                   |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、164 个测试通过                    |
| Build                  | `pnpm build`                                                                                    | 通过                                                   |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                   |

## 后续动作

- 继续用 browser benchmark history 观察 keyed list trend，不从单次 jsdom smoke benchmark 推断绝对性能。
