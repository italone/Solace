# 2026-07-16-013：批量插入 keyed 连续新增段

## 基本信息

- 日期：2026-07-16
- 类型：renderer keyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 keyed children diff 的纯插入分支：当 synced prefix/suffix 之间只剩连续新增 keyed element
children 时，先把新增节点挂载到 `DocumentFragment`，再对父容器执行一次 `insertBefore`。这减少了中间连续插入场景的父节点
DOM 插入次数，同时保持组件和非 element vnode 走原有逐个挂载路径。

## 变动原因

上一轮 mixed insert/move 已经避免新增节点 append 后再 move，但纯 keyed 插入段仍会对每个新增 child 分别插入父节点。本次选择最窄热点：
只覆盖全 element 连续新增段，复用现有 Fragment 批量挂载思路，不改变 keyed remove、move、LIS 或 component mount 语义。

## 影响范围

- 影响模块：renderer keyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：全 element keyed 连续新增段会先挂载到 `DocumentFragment`，再一次性插入最终 anchor 前。
- 风险等级：中低；批处理只在顶层新增节点都是 element 时启用，组件与 Fragment 等 vnode 保持原路径。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                                       |
| -------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `src/renderer/diff.ts`                                                           | 修改 | 为纯 keyed 插入段增加保守的 DocumentFragment 批处理        |
| `tests/unit/renderer/diff.test.ts`                                               | 修改 | 覆盖 synced prefix/suffix 之间连续插入的父节点 insert 计数 |
| `docs/performance.md`                                                            | 修改 | 记录 keyed 连续插入段批处理                                |
| `.changeset/performance-trend-readiness.md`                                      | 修改 | 补充 patch changeset 文案                                  |
| `solace-project-log/solace-entries/2026-07-16-013-keyed-insert-segment-batch.md` | 新增 | 记录本次变更                                               |
| `solace-project-log/index.md`                                                    | 修改 | 追加 2026-07-16 日志索引                                   |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，连续新增 keyed segment 实际 2 次父节点 insert，期望 1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、15 个测试通过                                 |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                           |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                              |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                              |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、165 个测试通过                               |
| Build                  | `pnpm build`                                                                                    | 通过                                                              |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                              |

## 后续动作

- 继续用 list diff benchmark 和 browser benchmark history 观察 keyed list trend，不从单次 jsdom smoke benchmark 推断绝对性能。
