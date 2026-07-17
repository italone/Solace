# 2026-07-17-001：批量移除 mixed keyed 旧节点连续段

## 基本信息

- 日期：2026-07-17
- 类型：renderer keyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 keyed children unknown sequence 分支：当 mixed move/remove 中出现相邻的未使用旧 keyed children 时，按连续 run
调用 `unmountChildrenRange`。满足安全 leaf element 条件时，这些旧节点会移动到临时 `DocumentFragment`，从父节点批量脱离；
其他情况继续逐个 `unmount`。

## 变动原因

keyed synced remove 和 unkeyed tail remove 已经复用安全批量 detach，但 unknown sequence 中的 unused old children
仍逐个移除。本次只把相邻 unused old run 合并，保留 key 匹配、patch、LIS move 和 fallback 语义不变。

## 影响范围

- 影响模块：renderer keyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：mixed keyed placement 中满足安全条件的相邻旧节点删除段会通过临时 `DocumentFragment` 批量脱离父节点。
- 风险等级：中低；存在 DevTools listener、事件 props、嵌套 children、组件或 Fragment 时仍走原逐个 unmount 路径。

## 涉及文件

| 文件                                                                               | 动作 | 说明                                                            |
| ---------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `src/renderer/diff.ts`                                                             | 修改 | 将 unknown sequence 未使用旧节点按连续 run 批量移除             |
| `tests/unit/renderer/diff.test.ts`                                                 | 修改 | 覆盖 mixed move/remove 中相邻旧节点删除的 remove 计数           |
| `tests/performance/list-diff.bench.ts`                                             | 修改 | 增加 `10000 row keyed mixed adjacent remove and move` benchmark |
| `docs/performance.md`                                                              | 修改 | 记录 adjacent remove/move benchmark 覆盖和优化                  |
| `.changeset/performance-trend-readiness.md`                                        | 修改 | 补充 patch changeset 文案                                       |
| `solace-project-log/solace-entries/2026-07-17-001-keyed-mixed-remove-run-batch.md` | 新增 | 记录本次变更                                                    |
| `solace-project-log/index.md`                                                      | 修改 | 追加 2026-07-17 日志索引                                        |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，mixed keyed old run remove 实际 2 次父节点 remove，期望 <=1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、21 个测试通过                                       |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                                 |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                                    |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                                    |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、171 个测试通过                                     |
| Build                  | `pnpm build`                                                                                    | 通过                                                                    |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                                    |

## 后续动作

- 继续保持 mixed keyed remove batch 的安全边界；扩大到带事件或嵌套 children 前需要先保证事件清理、组件生命周期和 DevTools 事件保真。
