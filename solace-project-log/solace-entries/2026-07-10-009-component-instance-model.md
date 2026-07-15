# 2026-07-10-009：实现组件实例模型

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试 / 计划
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace renderer 增加组件 VNode 支持，完成函数式组件挂载、props 初始化、props 更新驱动重渲染，以及组件 render effect 的调度更新。组件实例现在保存自身 effect，并在卸载时停止响应式依赖和忽略已排队更新，避免卸载后的组件重新插入 DOM。direct VNode 函数组件的首次求值已延迟到 render effect 内，避免初次挂载时重复调用。

## 变动原因

阶段 3 Step 01 需要建立组件边界，让 renderer 能识别组件 VNode 并维护组件实例状态。组件 render effect 也需要与 scheduler 协作，保证响应式状态变化后组件按批处理节奏更新，同时在卸载阶段清理资源。

## 影响范围

- 影响模块：component、renderer、VNode、shared flags、公开 API、组件单元测试。
- 影响对象：`ComponentInstance`、props 初始化与更新、组件 mount/update/unmount、组件 render effect。
- 行为变化：函数式组件可挂载并响应 props 和响应式状态变化；direct VNode 函数组件初次挂载只执行一次；组件卸载后不再响应旧依赖变更，也不会执行已排队的旧更新。
- 风险等级：中；当前只覆盖函数式组件基础模型，生命周期、emit 和 DOM 事件将在后续步骤继续补齐。

## 涉及文件

| 文件                                                                               | 动作        | 说明                                                          |
| ---------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| `src/component/component.ts`                                                       | 新增 / 修改 | 定义组件实例、setup、props 更新，并保存组件 effect 与卸载标记 |
| `src/component/props.ts`                                                           | 新增        | 初始化并原地更新组件 props                                    |
| `src/shared/flags.ts`                                                              | 修改        | 增加组件 shape flag                                           |
| `src/vnode/vnode.ts`                                                               | 修改        | 支持组件类型、组件实例引用和组件 props 类型                   |
| `src/vnode/h.ts`                                                                   | 修改        | 支持创建组件 VNode                                            |
| `src/renderer/diff.ts`                                                             | 修改        | 支持组件 mount/update/unmount 与 render effect 调度           |
| `src/index.ts`                                                                     | 修改        | 导出组件相关能力使用到的公开 API                              |
| `tests/unit/component/component.test.ts`                                           | 新增 / 修改 | 覆盖组件挂载、props、更新、响应式 render 和卸载清理回归       |
| `solace-project-plan/solace-phase-03-components-events/step-01-component-model.md` | 修改        | 标记 Step 01 执行清单完成                                     |
| `solace-project-log/solace-entries/2026-07-10-009-component-instance-model.md`     | 新增        | 记录本次组件模型变更                                          |
| `solace-project-log/index.md`                                                      | 修改        | 追加本次变更索引                                              |

## 验证记录

| 验证项                                     | 命令或方式                                         | 结果                                               |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| TDD RED：组件卸载后响应式更新回归          | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，卸载后旧组件重新插入 `<p>`           |
| TDD RED：组件卸载前已排队更新回归          | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，已入队旧更新在卸载后仍重新插入 `<p>` |
| TDD RED：direct VNode 组件初次挂载调用次数 | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，组件函数初次挂载被调用 2 次          |
| 组件单元测试                               | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、8 个测试                       |
| 类型检查                                   | `pnpm typecheck`                                   | 通过，退出码为 0                                   |
| 静态检查                                   | `pnpm lint`                                        | 通过，退出码为 0                                   |
| 全量质量门禁                               | `pnpm quality`                                     | 通过，8 个测试文件、45 个测试，构建通过            |

## 后续动作

- 继续阶段 3 Step 02，补齐 DOM 事件绑定、组件 emit、生命周期钩子和卸载清理。
- 后续可扩展组件模型，支持 slots、provide/inject、类组件接入和更完整的生命周期。
