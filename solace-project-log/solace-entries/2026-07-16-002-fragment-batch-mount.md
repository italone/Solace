# 2026-07-16-002：优化 Fragment 初始挂载批量插入

## 基本信息

- 日期：2026-07-16
- 类型：renderer diff / Fragment benchmark / 单元测试 / 性能文档
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 Fragment 初始挂载增加 all-element fast path：当 Fragment 顶层 children 全部是普通元素 VNode 时，先挂载到
`DocumentFragment`，再一次性插入真实父容器。混合 children、顶层组件 children、patch/update/unmount 和 keyed diff
语义保持原路径。

## 变动原因

现有 Fragment benchmark 覆盖 5,000 个 Fragment 子节点初始渲染与 patch。旧路径会把每个顶层元素 child 逐个插入父
容器；这在 Fragment-heavy 初始挂载中会产生不必要的父容器 DOM insertion。相比继续改 keyed diff 或 scheduler
batching，这个切口更局部，且有现成 benchmark 可验证。

## 影响范围

- 影响模块：renderer Fragment 初始挂载、renderer 单元测试、性能文档、项目日志。
- 行为变化：all-element Fragment 初始挂载对父容器只执行一次插入；最终 DOM 顺序、节点身份、VNode `el`、DevTools
  payload 和公开 API 不变。
- 风险等级：中低；实现刻意排除顶层组件/mixed Fragment children，避免改变组件生命周期时序。

## 涉及文件

| 文件                                                                       | 动作 | 说明                                       |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------ |
| `src/renderer/diff.ts`                                                     | 修改 | 增加 Fragment all-element batch mount path |
| `tests/unit/renderer/diff.test.ts`                                         | 修改 | 覆盖 root Fragment 父容器插入次数          |
| `docs/performance.md`                                                      | 修改 | 记录本轮 renderer/performance 跟进         |
| `docs/superpowers/specs/2026-07-16-fragment-batch-mount-design.md`         | 新增 | 记录设计                                   |
| `docs/superpowers/plans/2026-07-16-fragment-batch-mount.md`                | 新增 | 记录实施计划                               |
| `solace-project-log/solace-entries/2026-07-16-002-fragment-batch-mount.md` | 新增 | 记录本次变更                               |
| `solace-project-log/index.md`                                              | 修改 | 追加 2026-07-16 日志索引                   |

## 验证记录

| 验证项                  | 命令或方式                                                                                     | 结果                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| TDD RED                 | `pnpm exec vitest run tests/unit/renderer/diff.test.ts`                                        | 按预期失败，新增测试期望 1 次插入，实际为 3 次         |
| Targeted renderer tests | `pnpm exec vitest run tests/unit/renderer/diff.test.ts`                                        | 通过，1 个测试文件、12 个测试通过                      |
| Fragment benchmark      | `pnpm exec vitest run --config vitest.benchmark.config.ts tests/performance/fragment.bench.ts` | 通过，1 个 benchmark 文件、1 个测试通过                |
| Tests                   | `pnpm test`                                                                                    | 通过，22 个测试文件、155 个测试通过                    |
| Typecheck               | `pnpm typecheck`                                                                               | 通过                                                   |
| Lint                    | `pnpm lint`                                                                                    | 通过                                                   |
| Build                   | `pnpm build`                                                                                   | 通过                                                   |
| E2E                     | `pnpm test:e2e`                                                                                | 首次受沙箱监听端口限制失败；提权重跑通过，3 个测试通过 |
| 格式检查                | `pnpm format:check`                                                                            | 通过                                                   |

## 后续动作

- 继续收集 Fragment benchmark 和 browser benchmark history，用趋势数据判断是否需要扩大 Fragment patch 优化。
- 下一轮性能优化优先评估 component update batching under larger trees，避免在无数据支撑时继续扩大 renderer diff 复杂度。
