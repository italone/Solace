# 2026-07-16-006：跳过稳定 keyed 元素无效更新

## 基本信息

- 日期：2026-07-16
- 类型：renderer keyed children / list diff benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 element patch 增加保守 skip：当同 type/key 元素的非 `key` props 未变化，且 children 形态和值未变化时，复用现有
DOM 节点并跳过 `patchProps()`、`patchChildren()` 和 renderer element update devtools summary。

## 变动原因

keyed 大列表局部文本更新时，绝大多数 sibling 的 props 和 text children 都保持稳定。此前这些稳定元素仍会进入完整
`patchElement()` 路径并在 DevTools listener 存在时产生无实际 DOM 变化的 update summary。本次选择 element-level
shallow skip，直接覆盖 keyed children 局部更新热点，同时避免改变 keyed move / insert / remove 的锚点逻辑。

## 影响范围

- 影响模块：renderer element patch、keyed children diff、renderer diff 单元测试、list diff benchmark、性能文档、Changesets。
- 行为变化：稳定 keyed element sibling 不再执行无效 patch，也不再发出无实际变化的 renderer element update summary。
- 风险等级：中低；array children 只在 children 数组引用相同时短路，不做深比较，避免误跳过子树更新。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                            |
| ------------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `src/renderer/diff.ts`                                                          | 修改 | 增加 `shouldPatchElement()` shallow guard       |
| `tests/unit/renderer/diff.test.ts`                                              | 修改 | 覆盖稳定 keyed sibling 跳过 element update      |
| `tests/performance/list-diff.bench.ts`                                          | 验证 | 复用现有 10,000 row local text update benchmark |
| `docs/performance.md`                                                           | 修改 | 记录本轮 renderer follow-up                     |
| `.changeset/performance-trend-readiness.md`                                     | 修改 | 补充 patch changeset 文案                       |
| `solace-project-log/solace-entries/2026-07-16-006-stable-keyed-element-skip.md` | 新增 | 记录本次变更                                    |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-16 日志索引                        |

## 验证记录

| 验证项                 | 命令或方式                                                                                      | 结果                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| TDD RED                | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 按预期失败，新增测试收到 `['li', 'li', 'li', 'ul']`，期望 `['li', 'ul']` |
| Targeted renderer test | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                              | 通过，1 个测试文件、13 个测试通过                                        |
| List diff benchmark    | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/list-diff.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                                  |
| Tests                  | `pnpm test`                                                                                     | 通过，22 个测试文件、157 个测试通过                                      |
| Typecheck              | `pnpm typecheck`                                                                                | 通过                                                                     |
| Lint                   | `pnpm lint`                                                                                     | 通过                                                                     |
| 格式检查               | `pnpm format:check`                                                                             | 通过                                                                     |

## 后续动作

- 继续收集 browser benchmark history，观察 keyed list local update 相关趋势。
- 如果后续要跳过 array children 子树，应先增加更明确的 vnode 稳定性信号，而不是引入深比较。
