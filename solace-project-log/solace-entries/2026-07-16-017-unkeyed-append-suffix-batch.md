# 2026-07-16-017：批量插入 unkeyed 追加子节点

## 基本信息

- 日期：2026-07-16
- 类型：renderer unkeyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 unkeyed children 的尾部追加路径：当 index patch 后剩余的新增 suffix 全部是 element vnode 时，复用通用
`mountNewChildren`，先挂载到 `DocumentFragment`，再对真实父 element 执行一次插入。这样 `[A] -> [A, B, C]`
这类 unkeyed append 不再逐个插入新增子节点。

## 变动原因

前几轮已经覆盖 element 初始挂载、text-to-array、keyed 插入段和 mixed keyed placement，但 `patchUnkeyedChildren`
的 append suffix 仍逐个 `patch(null, child, container)`。本次保持 index patch 语义不变，只优化新增 suffix 的 DOM 插入方式。

## 影响范围

- 影响模块：renderer unkeyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：unkeyed append 的全 element 新增 suffix 会先进入 `DocumentFragment`，再一次性插入父 element。
- 风险等级：中低；只改变 append suffix 的挂载容器，已有 index patch、remove、mixed keyed 和 component/Fragment fallback 语义保持不变。

## 涉及文件

| 文件                                                                              | 动作 | 说明                                                    |
| --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `src/renderer/diff.ts`                                                            | 修改 | 让 unkeyed append suffix 复用 `mountNewChildren` 批处理 |
| `tests/unit/renderer/diff.test.ts`                                                | 修改 | 覆盖 unkeyed append 的父节点 insert 计数                |
| `tests/performance/list-diff.bench.ts`                                            | 修改 | 增加 `10000 row unkeyed tail append` benchmark          |
| `docs/performance.md`                                                             | 修改 | 记录 unkeyed append benchmark 覆盖和优化                |
| `.changeset/performance-trend-readiness.md`                                       | 修改 | 补充 patch changeset 文案                               |
| `solace-project-log/solace-entries/2026-07-16-017-unkeyed-append-suffix-batch.md` | 新增 | 记录本次变更                                            |
| `solace-project-log/index.md`                                                     | 修改 | 追加 2026-07-16 日志索引                                |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，unkeyed append 实际 2 次父节点 insert，期望 1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、19 个测试通过                         |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                   |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                      |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                      |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、169 个测试通过                       |
| Build                  | `pnpm build`                                                                                    | 通过                                                      |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                      |

## 后续动作

- 继续从有单测和 benchmark 覆盖的 renderer 热点推进；下一轮可评估 Fragment patch 或 component batching 的更小路径。
