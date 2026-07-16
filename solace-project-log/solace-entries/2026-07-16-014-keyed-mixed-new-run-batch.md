# 2026-07-16-014：批量插入 mixed keyed 相邻新增段

## 基本信息

- 日期：2026-07-16
- 类型：renderer keyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 keyed children diff 的 unknown sequence 反向 placement 分支：当 mixed insert/move 中出现相邻的全 element
新增 keyed children 时，先把这个新增 run 挂载到 `DocumentFragment`，再对父容器执行一次插入。这样保留已有 LIS move
策略，同时减少相邻新增节点逐个插入父容器的 DOM 操作。

## 变动原因

纯 keyed 插入段已经能批量插入，但 mixed 分支里 `newIndexToOldIndexMap` 中相邻的 `0` 仍会在反向 placement
中逐个挂载。本次从最窄热点切入，只批处理长度大于 1 且全是 element 的新增 run；组件、Fragment 和单个新增节点继续走原路径。

## 影响范围

- 影响模块：renderer keyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：mixed keyed placement 中相邻的全 element 新增 run 会一次性插入最终 anchor 前。
- 风险等级：中低；只改变连续 element 新增 run 的挂载方式，不改变 key 匹配、remove、LIS stable/move 或 component mount 语义。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                                      |
| ------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `src/renderer/diff.ts`                                                          | 修改 | 在 mixed placement 中识别并批量挂载相邻新增 run           |
| `tests/unit/renderer/diff.test.ts`                                              | 修改 | 覆盖 mixed insert/move 中相邻新增节点的父节点 insert 计数 |
| `tests/performance/list-diff.bench.ts`                                          | 修改 | 增加 keyed mixed adjacent insert and move benchmark       |
| `docs/performance.md`                                                           | 修改 | 记录 adjacent insert/move benchmark 覆盖和优化            |
| `.changeset/performance-trend-readiness.md`                                     | 修改 | 补充 patch changeset 文案                                 |
| `solace-project-log/solace-entries/2026-07-16-014-keyed-mixed-new-run-batch.md` | 新增 | 记录本次变更                                              |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-16 日志索引                                  |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，mixed 相邻新增 run 实际 3 次父节点 insert，期望 2 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、16 个测试通过                             |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                       |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                          |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                          |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、166 个测试通过                           |
| Build                  | `pnpm build`                                                                                    | 通过                                                          |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                          |

## 后续动作

- 继续把 keyed children 性能工作保持在有单测和基准覆盖的窄路径上，后续可评估 Fragment 子节点 patch 或 component batching 的下一个热点。
