# 2026-07-16-015：批量挂载 element 初始子节点

## 基本信息

- 日期：2026-07-16
- 类型：renderer element mount / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 element 初始挂载路径：当 element vnode 的 array children 全部是 element vnode 时，先把这些子节点挂载到
`DocumentFragment`，再对真实父 element 执行一次插入。这样 `ul > li*` 这类初始列表渲染不再对父 element
逐个执行 child insert。

## 变动原因

Fragment 初始挂载和 keyed insert 路径已经具备保守的 `DocumentFragment` 批处理，但普通 element 的初始 array children
仍逐个插入父节点。本次从 10,000 row create 覆盖的热点切入，只批处理全 element 子节点数组，组件、Fragment 和混合子节点继续走原路径。

## 影响范围

- 影响模块：renderer element mount、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：全 element array children 初始挂载会先进入 `DocumentFragment`，再一次性插入父 element。
- 风险等级：中低；只改变初始挂载时全 element 子节点数组的插入容器，不改变 props patch、text children、component mount 或 keyed diff 语义。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                                        |
| ------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `src/renderer/diff.ts`                                                          | 修改 | 为 element 初始 array children 增加 DocumentFragment 批处理 |
| `tests/unit/renderer/diff.test.ts`                                              | 修改 | 覆盖 `ul` 初始子节点插入的父节点 insert 计数                |
| `docs/performance.md`                                                           | 修改 | 记录 element child array batch mount 和 benchmark 覆盖      |
| `.changeset/performance-trend-readiness.md`                                     | 修改 | 补充 patch changeset 文案                                   |
| `solace-project-log/solace-entries/2026-07-16-015-element-child-batch-mount.md` | 新增 | 记录本次变更                                                |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-16 日志索引                                    |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，初始 element 子节点实际 3 次父节点 insert，期望 1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、17 个测试通过                             |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                       |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                          |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                          |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、167 个测试通过                           |
| Build                  | `pnpm build`                                                                                    | 通过                                                          |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                          |

## 后续动作

- 继续从有 benchmark 覆盖的 renderer 热点推进，下一轮可评估 Fragment patch 或 component batching 的更窄路径。
