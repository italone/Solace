# 2026-07-23-001：优化 keyed reorder anchor lookup 并扩展 shape matrix

## 基本信息

- 日期：2026-07-23
- 类型：renderer performance / browser benchmark / project log
- 状态：已完成

## 变动摘要

将 keyed reorder move-loop 中的 `getAnchor(newChildren, index + 1)` 查找替换为运行时的 `anchorNode`
变量，使 `anchorLookups` 降为 0；同时将浏览器 benchmark 的 `keyed-reorder` 场景扩展为
`reverse`、`sorted`、`swap-neighbors`、`shuffle`、`shift-window` 五种 shape。

## 变动原因

move-path instrumentation 显示 10,000 行全反转 reorder 会产生 9,999 次 `insertBefore` 和
9,999 次 move-loop `getAnchor()` 查找。因为 move loop 已经是从右向左遍历，可以用一个运行 anchor
节点代替每次查找，且不改变 DOM 插入语义。shape matrix 用于验证优化不只对全反转有效，也能覆盖
稳定、随机和窗口式重排分布。

## 影响范围

- 影响模块：renderer diff、browser benchmark fixture、browser benchmark history/summarizer、性能文档、项目日志。
- 行为变化：无公开 API 变化；无 DOM 插入顺序变化；默认渲染行为在 instrumentation 未启用时不变。
- 风险等级：中；修改了 keyed children move/mount loop 的 anchor 传递逻辑，但单元测试和 e2e 均通过。

## 涉及文件

| 文件                                                                                               | 动作 | 说明                                             |
| -------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `src/renderer/diff.ts`                                                                             | 修改 | 使用 `anchorNode` 替代循环内 `getAnchor`         |
| `src/renderer/keyed-reorder-instrumentation.ts`                                                    | 修改 | 移除未使用的 `recordKeyedReorderAnchorLookup`    |
| `tests/unit/renderer/diff.test.ts`                                                                 | 修改 | 新增零 anchor lookup 测试，统一断言              |
| `tests/e2e/browser-benchmark-history.ts`                                                           | 修改 | keyed-reorder 结果增加 `shape` 字段              |
| `tests/unit/scripts/browser-benchmark-history.test.ts`                                             | 修改 | fixture 加入 `shape: "reverse"`                  |
| `scripts/summarize-benchmark-history.mjs`                                                          | 修改 | browser history 按 `(scenario, shape)` 分组      |
| `tests/unit/scripts/benchmark-history-summary.test.ts`                                             | 修改 | 增加 shape 分组测试                              |
| `examples/performance-benchmark/src/main.tsx`                                                      | 修改 | 支持 shape 参数与五种 transform                  |
| `tests/e2e/browser-benchmark.spec.ts`                                                              | 修改 | 遍历 shapes 并断言各自 DOM 顺序与 move-path 计数 |
| `docs/performance.md`                                                                              | 修改 | 记录 shape matrix 与 seeded shuffle              |
| `solace-project-log/solace-entries/2026-07-23-001-keyed-reorder-anchor-optimization-and-shapes.md` | 新增 | 本日志                                           |
| `solace-project-log/index.md`                                                                      | 修改 | 追加日志索引                                     |

## 验证记录

| 验证项                | 命令                                                                                                                        | 结果 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| Renderer diff tests   | `pnpm vitest run tests/unit/renderer/diff.test.ts`                                                                          | 通过 |
| Browser history tests | `pnpm vitest run tests/unit/scripts/browser-benchmark-history.test.ts tests/unit/scripts/benchmark-history-summary.test.ts` | 通过 |
| Type check            | `pnpm typecheck`                                                                                                            | 通过 |
| Lint                  | `pnpm lint`                                                                                                                 | 通过 |
| Browser benchmark     | `pnpm benchmark:browser`                                                                                                    | 通过 |
| Format check          | `pnpm format:check`                                                                                                         | 通过 |
| Whitespace check      | `git diff --check`                                                                                                          | 通过 |

## 后续动作

- Task 6：运行五次样本的 browser benchmark，刷新 latest-window 趋势并记录趋势刷新日志。
