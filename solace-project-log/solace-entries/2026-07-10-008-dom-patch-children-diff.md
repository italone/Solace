# 2026-07-10-008：实现 DOM patch 与 children diff

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace renderer 增加 DOM patch 能力，支持相同元素更新、props 和事件替换、文本 children 更新、数组 children 增删，以及 keyed children 的新增、删除、移动和 DOM 复用。函数式响应式 render 现在复用同一 patch 路径，不再在状态更新时整体 remount。

## 变动原因

阶段 2 需要把基础 mount-only renderer 推进到可更新的 DOM renderer。DOM patch 和 children diff 是后续组件、事件、生命周期和示例应用的基础能力。

## 影响范围

- 影响模块：renderer、VNode、响应式 render 集成、单元测试、集成测试。
- 影响对象：`render`、`patch`、`VNode.key`、children diff、props patch。
- 行为变化：重复 `render(nextVNode, container)` 会 patch 旧 VNode；响应式 render 更新会复用 DOM 节点。
- 风险等级：中；当前 keyed diff 使用简单正确算法，不含 LIS 优化。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                                     |
| ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `src/renderer/diff.ts`                                                        | 新增 | 实现 DOM patch、props patch、children diff 和 keyed diff |
| `src/renderer/renderer.ts`                                                    | 修改 | 存储 container previous vnode，并复用 patch 路径         |
| `src/vnode/vnode.ts`                                                          | 修改 | 增加 normalized `key` 字段                               |
| `tests/unit/renderer/diff.test.ts`                                            | 新增 | 覆盖 props、文本、数组和 keyed diff                      |
| `tests/integration/reactive-render.test.ts`                                   | 新增 | 覆盖响应式状态变化后的 DOM patch                         |
| `tests/integration/batched-render.test.ts`                                    | 修改 | 保持批处理渲染与 patch 路径兼容                          |
| `solace-project-log/solace-entries/2026-07-10-008-dom-patch-children-diff.md` | 新增 | 记录本次 DOM diff 变更                                   |
| `solace-project-log/index.md`                                                 | 修改 | 追加本次变更索引                                         |

## 验证记录

| 验证项                            | 命令或方式                                                                             | 结果                                              |
| --------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TDD RED：DOM diff 初始测试        | `pnpm test tests/unit/renderer/diff.test.ts tests/integration/reactive-render.test.ts` | 失败符合预期，DOM 被替换而非 patch                |
| TDD RED：keyed middle insert 回归 | `pnpm test tests/unit/renderer/diff.test.ts`                                           | 失败符合预期，插入位置错误                        |
| TDD RED：mixed keyed/unkeyed 策略 | `pnpm test tests/unit/renderer/diff.test.ts`                                           | 失败符合预期，mixed children 跨位置复用 keyed DOM |
| DOM diff 单元测试                 | `pnpm test tests/unit/renderer/diff.test.ts`                                           | 通过，1 个测试文件、9 个测试                      |
| 响应式渲染集成测试                | `pnpm test tests/integration/reactive-render.test.ts`                                  | 通过，1 个测试文件、1 个测试                      |
| 类型检查                          | `pnpm typecheck`                                                                       | 通过，退出码为 0                                  |
| 静态检查                          | `pnpm lint`                                                                            | 通过，退出码为 0                                  |
| 全量质量门禁                      | `pnpm quality`                                                                         | 通过，7 个测试文件、37 个测试，构建通过           |

## 后续动作

- 继续阶段 3 Step 01，实现组件实例模型。
- Phase 3 events 中需要重新审视事件 patch 的用户级语义，例如数组 listener、事件选项和 invoker 缓存。
