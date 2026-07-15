# 2026-07-10-006：实现 VNode、h 与基础 render

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 Solace 的 VNode 数据结构、`h` 创建函数和基础 DOM 挂载渲染器。当前渲染器支持元素 VNode、文本 children、数组 children、基础属性和事件监听挂载，为后续 scheduler 集成与 DOM diff 提供基础文件。

## 变动原因

执行索引中 scheduler/nextTick 步骤需要修改 `src/renderer/renderer.ts`，但渲染器文件此前尚未存在。因此先完成阶段 2 Step 01 的最小挂载闭环，保证后续调度器可以接入真实 render effect。

## 影响范围

- 影响模块：VNode、渲染器、DOM host ops、公开 API、单元测试。
- 影响对象：`h`、`createVNode`、`render`、`ShapeFlags`。
- 行为变化：新增元素挂载能力，可将 VNode 渲染到 DOM container。
- 风险等级：中低；当前仅支持 mount，不包含 DOM patch、children diff 或 keyed diff。

## 涉及文件

| 文件                                                                     | 动作 | 说明                                              |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------- |
| `src/shared/flags.ts`                                                    | 新增 | 定义 VNode shape flags                            |
| `src/vnode/vnode.ts`                                                     | 新增 | 定义 VNode 类型与 `createVNode`                   |
| `src/vnode/h.ts`                                                         | 新增 | 实现 `h` 创建函数                                 |
| `src/renderer/dom.ts`                                                    | 新增 | 实现 DOM host operations                          |
| `src/renderer/renderer.ts`                                               | 新增 | 实现 mount-only `render`、`patch`、`mountElement` |
| `src/index.ts`                                                           | 修改 | 导出 VNode、`h`、`render` 和 `ShapeFlags`         |
| `tests/unit/renderer/vnode-render.test.ts`                               | 新增 | 覆盖 VNode 创建、文本挂载和数组 children 顺序挂载 |
| `rollup.config.mjs`                                                      | 修改 | 让 Rollup resolver 支持 `.ts` 扩展解析            |
| `solace-project-log/solace-entries/2026-07-10-006-vnode-basic-render.md` | 新增 | 记录本次 VNode 与基础渲染器变更                   |
| `solace-project-log/index.md`                                            | 修改 | 追加本次变更索引                                  |

## 验证记录

| 验证项                      | 命令或方式                                           | 结果                                |
| --------------------------- | ---------------------------------------------------- | ----------------------------------- |
| TDD RED：基础渲染器初始测试 | `pnpm test tests/unit/renderer/vnode-render.test.ts` | 失败符合预期，`h is not a function` |
| 基础渲染器单元测试          | `pnpm test tests/unit/renderer/vnode-render.test.ts` | 通过，1 个测试文件、3 个测试        |
| 类型检查                    | `pnpm typecheck`                                     | 通过，退出码为 0                    |
| 静态检查                    | `pnpm lint`                                          | 通过，退出码为 0                    |
| 库构建                      | `pnpm build`                                         | 通过，退出码为 0                    |
| 全量质量门禁                | `pnpm quality`                                       | 通过，退出码为 0                    |

## 后续动作

- 执行 scheduler/nextTick 步骤，将响应式 render effect 接入 job queue。
- 在阶段 2 Step 02 keyed diff 前，为 `VNode` 增加 normalized `key` 字段，并补充 `patchProp` 测试。
