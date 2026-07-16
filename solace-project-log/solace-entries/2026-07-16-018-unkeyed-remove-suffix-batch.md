# 2026-07-16-018：批量移除 unkeyed 尾部子节点

## 基本信息

- 日期：2026-07-16
- 类型：renderer unkeyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 unkeyed children 的尾部移除路径：当 index patch 后剩余的旧 suffix 全部是安全的 leaf element vnode 时，使用 DOM
`Range.deleteContents()` 批量删除这一段。该优化只在无 DevTools listener、无事件 props、无子数组的 element suffix 上启用；
其他情况继续逐个 `unmount`，保留事件清理、组件生命周期和 DevTools 事件语义。

## 变动原因

上一轮已经优化 unkeyed append suffix，但 unkeyed tail remove 仍逐个 `removeChild`。本次从可证明安全的 leaf element
suffix 切入，用单元测试约束父节点 remove 调用次数，并用 `10000 row unkeyed tail remove` benchmark 覆盖对应场景。

## 影响范围

- 影响模块：renderer unkeyed children diff、renderer diff 单元测试、list diff benchmark、benchmark runner 测试、性能文档、Changesets。
- 行为变化：满足安全条件的 unkeyed removed suffix 会通过 DOM `Range` 批量删除。
- 风险等级：中低；存在 DevTools listener、事件 props、嵌套 children、组件或 Fragment 时仍走原逐个 unmount 路径。

## 涉及文件

| 文件                                                                              | 动作 | 说明                                             |
| --------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `src/renderer/diff.ts`                                                            | 修改 | 增加安全 unkeyed remove suffix 的 Range 批量删除 |
| `tests/unit/renderer/diff.test.ts`                                                | 修改 | 覆盖 unkeyed tail remove 的父节点 remove 计数    |
| `tests/performance/list-diff.bench.ts`                                            | 修改 | 增加 `10000 row unkeyed tail remove` benchmark   |
| `tests/unit/scripts/run-benchmark.test.ts`                                        | 修改 | 对齐 benchmark runner history 测试超时预算       |
| `docs/performance.md`                                                             | 修改 | 记录 unkeyed append/remove benchmark 覆盖和优化  |
| `.changeset/performance-trend-readiness.md`                                       | 修改 | 补充 patch changeset 文案                        |
| `solace-project-log/solace-entries/2026-07-16-018-unkeyed-remove-suffix-batch.md` | 新增 | 记录本次变更                                     |
| `solace-project-log/index.md`                                                     | 修改 | 追加 2026-07-16 日志索引                         |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，unkeyed tail remove 实际 2 次父节点 remove，期望 <=1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、20 个测试通过                                |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                             |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                          |
| Benchmark runner test  | `pnpm vitest run tests/unit/scripts/run-benchmark.test.ts`                                      | 通过，1 个测试文件、6 个测试通过                                 |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                             |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、170 个测试通过                              |
| Build                  | `pnpm build`                                                                                    | 通过                                                             |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                             |

## 后续动作

- 继续保持 remove batch 的安全边界；后续若要扩大到带事件或嵌套 children 的节点，需要先设计事件清理和 DevTools 事件保真策略。
