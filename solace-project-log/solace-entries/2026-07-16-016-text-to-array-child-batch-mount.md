# 2026-07-16-016：批量挂载 text-to-array 子节点

## 基本信息

- 日期：2026-07-16
- 类型：renderer children patch / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

优化 `mountChildren` 通用路径：当 element 从 text children 更新为全 element array children 时，先把新子节点挂载到
`DocumentFragment`，再对真实父 element 执行一次插入。`mountElement` 的初始全 element 子节点挂载也复用同一个
`mountChildren` 入口，避免保留重复批处理逻辑。

## 变动原因

上一轮已优化 element 初始 array children 挂载，但 `patchChildren` 中 text-to-array 和 empty-to-array 的挂载路径仍通过
`mountChildren` 逐个插入父节点。本次补齐该通用入口，让全 element 子节点数组在更多 children replacement 场景下共享同一保守批处理。

## 影响范围

- 影响模块：renderer children patch、renderer element mount、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：text-to-array / empty-to-array 的全 element children 会先进入 `DocumentFragment`，再一次性插入父 element。
- 风险等级：中低；只批处理全 element children，组件、Fragment、混合 children 和 keyed diff patch 路径保持原语义。

## 涉及文件

| 文件                                                                                  | 动作 | 说明                                                |
| ------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `src/renderer/diff.ts`                                                                | 修改 | 让通用 `mountChildren` 支持 DocumentFragment 批处理 |
| `tests/unit/renderer/diff.test.ts`                                                    | 修改 | 覆盖 text-to-array 子节点替换的父节点 insert 计数   |
| `tests/performance/list-diff.bench.ts`                                                | 修改 | 增加 `10000 row text to keyed list` benchmark       |
| `docs/performance.md`                                                                 | 修改 | 记录 text-to-list mount benchmark 覆盖和优化        |
| `.changeset/performance-trend-readiness.md`                                           | 修改 | 补充 patch changeset 文案                           |
| `solace-project-log/solace-entries/2026-07-16-016-text-to-array-child-batch-mount.md` | 新增 | 记录本次变更                                        |
| `solace-project-log/index.md`                                                         | 修改 | 追加 2026-07-16 日志索引                            |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，text-to-array 实际 3 次父节点 insert，期望 1 |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、18 个测试通过                        |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                  |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                     |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                     |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、168 个测试通过                      |
| Build                  | `pnpm build`                                                                                    | 通过                                                     |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                     |

## 后续动作

- 继续从有基准覆盖的 renderer 路径推进；下一轮可评估 Fragment patch 或 component batching 的更小热点。
