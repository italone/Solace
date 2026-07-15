# 2026-07-10-010：实现事件与生命周期

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 测试 / 计划
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 增加 DOM 事件 patch 能力、组件 `emit`、基础生命周期注册和组件/元素卸载清理。DOM 事件现在通过 invoker 缓存更新处理函数，避免同一事件在 handler 变化时反复 add/remove listener。组件 setup context 现在提供 `emit`，支持 `emit("change")` 映射到父级 `onChange`。新增 `onMounted`、`onUpdated`、`onUnmounted`，renderer 在 mount、update、unmount 阶段调用对应 hook。

## 变动原因

阶段 3 Step 02 需要补齐组件与 DOM 交互能力。事件系统和生命周期是组件可用性的基础，也需要在卸载阶段清理事件、组件 effect 和子树，避免旧 DOM 引用继续触发监听器或组件子树泄漏。

## 影响范围

- 影响模块：event、component、renderer、VNode 类型、公开 API、单元测试。
- 影响对象：DOM `onXxx` props、组件 setup context、`emit`、生命周期 hook、元素/组件 unmount。
- 行为变化：事件 handler 更新只触发最新函数；事件 prop 删除和元素卸载后旧 handler 不再触发；组件可 emit 给父级 props；组件生命周期按 mount/update/unmount 顺序触发；元素子树卸载会递归清理组件。
- 风险等级：中；当前事件 modifiers 仅提供最小工具骨架，尚未引入复杂按键、once/capture/passive 等事件选项语义。

## 涉及文件

| 文件                                                                                | 动作 | 说明                                                                   |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `src/event/event.ts`                                                                | 新增 | 实现事件 props 识别、invoker 缓存、事件更新和卸载清理                  |
| `src/event/modifiers.ts`                                                            | 新增 | 提供最小 `withModifiers` 工具骨架                                      |
| `src/component/lifecycle.ts`                                                        | 新增 | 实现当前组件实例、生命周期注册和 hook 调用                             |
| `src/component/component.ts`                                                        | 修改 | 增加 setup context、`emit`、生命周期队列和 setup 阶段 current instance |
| `src/renderer/dom.ts`                                                               | 修改 | 接入事件 patch，并在 DOM remove 时清理当前元素事件                     |
| `src/renderer/diff.ts`                                                              | 修改 | 在组件 mount/update/unmount 调用生命周期，并递归卸载元素 children      |
| `src/vnode/vnode.ts`                                                                | 修改 | 扩展组件类型签名以接收 setup context                                   |
| `src/index.ts`                                                                      | 修改 | 导出生命周期 API                                                       |
| `tests/unit/event/event.test.ts`                                                    | 新增 | 覆盖事件绑定、更新、prop 删除、元素卸载清理和 invoker 缓存             |
| `tests/unit/component/lifecycle.test.ts`                                            | 新增 | 覆盖组件 emit、生命周期顺序和元素子树组件卸载                          |
| `solace-project-plan/solace-phase-03-components-events/step-02-events-lifecycle.md` | 修改 | 标记 Step 02 执行清单完成                                              |
| `solace-project-log/solace-entries/2026-07-10-010-events-lifecycle.md`              | 新增 | 记录本次事件与生命周期变更                                             |
| `solace-project-log/index.md`                                                       | 修改 | 追加本次变更索引                                                       |

## 验证记录

| 验证项                              | 命令或方式                                                                        | 结果                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| TDD RED：事件 invoker 缓存          | `pnpm test tests/unit/event/event.test.ts`                                        | 失败符合预期，handler 更新时重复 add listener                 |
| TDD RED：组件 emit 和生命周期 API   | `pnpm test tests/unit/component/lifecycle.test.ts`                                | 失败符合预期，缺少 emit context 和生命周期导出                |
| TDD RED：元素卸载事件清理和子树卸载 | `pnpm test tests/unit/event/event.test.ts tests/unit/component/lifecycle.test.ts` | 失败符合预期，旧 DOM 引用仍触发事件，元素子组件未触发 unmount |
| 事件单元测试                        | `pnpm test tests/unit/event/event.test.ts`                                        | 通过，1 个测试文件、5 个测试                                  |
| 组件生命周期测试                    | `pnpm test tests/unit/component/lifecycle.test.ts`                                | 通过，1 个测试文件、4 个测试                                  |
| 类型检查                            | `pnpm typecheck`                                                                  | 通过，退出码为 0                                              |
| 静态检查                            | `pnpm lint`                                                                       | 通过，退出码为 0                                              |
| 全量质量门禁                        | `pnpm quality`                                                                    | 通过，10 个测试文件、54 个测试，构建通过                      |

## 后续动作

- 继续阶段 4 Step 02，实现 store，并补充 store 与组件联动集成测试。
- 后续扩展事件系统时，可补充 once/capture/passive、键盘修饰符和事件数组 handler 等更完整语义。
