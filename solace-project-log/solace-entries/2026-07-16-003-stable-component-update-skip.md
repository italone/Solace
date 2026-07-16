# 2026-07-16-003：跳过稳定子组件无效更新

## 基本信息

- 日期：2026-07-16
- 类型：renderer component update / component benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 component patch 增加 shallow update guard：父组件 rerender 时，如果子组件 VNode 的 children 引用不变且非
`key` props 浅比较无变化，则复用现有组件实例和 DOM 引用，跳过 `updateComponentProps()` 与子组件 render/update。

## 变动原因

调度器已经能把同一 tick 内的重复组件 job 去重，但父组件更新仍会 patch 并 rerender 所有稳定子组件。大型组件树中，
父级状态变化经常只影响父级局部 DOM，不应强制稳定 child component 执行无效 update。本次选择 shallow skip，而不是
调整 scheduler 队列语义，以保持改动局部且可回归测试。

## 影响范围

- 影响模块：renderer component update、组件单元测试、component benchmark、性能文档、项目日志。
- 行为变化：稳定子组件在父组件 rerender 时不再执行无效 render/update；prop 或 children 变化时仍按原路径更新。
- 风险等级：中；跳过策略保守使用 children 引用比较和非 `key` props 浅比较，不深比较对象型 props。

## 涉及文件

| 文件                                                                               | 动作 | 说明                                 |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `src/renderer/diff.ts`                                                             | 修改 | 增加 `shouldUpdateComponent()` guard |
| `tests/unit/component/component.test.ts`                                           | 修改 | 覆盖稳定 child component 跳过 update |
| `tests/performance/component-update.bench.ts`                                      | 修改 | 增加稳定子组件父级更新 benchmark     |
| `docs/performance.md`                                                              | 修改 | 记录本轮 component batching 跟进     |
| `docs/superpowers/specs/2026-07-16-stable-component-update-skip-design.md`         | 新增 | 记录设计                             |
| `docs/superpowers/plans/2026-07-16-stable-component-update-skip.md`                | 新增 | 记录实施计划                         |
| `solace-project-log/solace-entries/2026-07-16-003-stable-component-update-skip.md` | 新增 | 记录本次变更                         |
| `solace-project-log/index.md`                                                      | 修改 | 追加 2026-07-16 日志索引             |

## 验证记录

| 验证项                   | 命令或方式                                                                                             | 结果                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| TDD RED                  | `pnpm exec vitest run tests/unit/component/component.test.ts`                                          | 按预期失败，新增测试期望 1 次 child render，实际为 2 次 |
| Targeted component tests | `pnpm exec vitest run tests/unit/component/component.test.ts`                                          | 通过，1 个测试文件、43 个测试通过                       |
| Component benchmark      | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/component-update.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                 |
| Tests                    | `pnpm test`                                                                                            | 通过，22 个测试文件、156 个测试通过                     |
| Typecheck                | `pnpm typecheck`                                                                                       | 通过                                                    |
| Lint                     | `pnpm lint`                                                                                            | 通过                                                    |
| Build                    | `pnpm build`                                                                                           | 通过                                                    |
| E2E                      | `pnpm test:e2e`                                                                                        | 通过，3 个 Playwright 测试通过                          |
| 格式检查                 | `pnpm format:check`                                                                                    | 通过                                                    |

## 后续动作

- 继续用 browser benchmark history 收集真实浏览器趋势，再决定是否增加性能阈值。
- 后续如果要优化对象型 props 或 slot props，应先设计更明确的更新语义，避免深比较带来额外成本。
