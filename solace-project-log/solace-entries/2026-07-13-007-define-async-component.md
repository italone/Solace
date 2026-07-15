# 2026-07-13-007：新增 defineAsyncComponent API

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `defineAsyncComponent()` 异步组件声明 helper。该 API 接收组件 loader，pending 阶段渲染空 Fragment，loader resolve 后触发 wrapper 组件更新并渲染已加载组件。

## 变动原因

README 中最后一个未收口的候选 public API 是异步组件。当前组件实例已经具备稳定 props、slots 和 `instance.update` 调度能力，因此可以用普通组件 wrapper 实现最小异步加载能力，不需要改动 renderer 主流程。

## 影响范围

- 影响模块：component helper、package root exports、package consumer smoke、API 文档、README。
- 影响对象：异步组件声明、组件 pending/resolve 渲染、公开 TypeScript 类型。
- 行为变化：用户可从 `solace` 根入口导入 `defineAsyncComponent()`。
- 风险等级：中；新增异步加载和更新调度路径，但实现边界集中在 helper 内。

## 涉及文件

| 文件                                                                 | 动作 | 说明                                                       |
| -------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `src/component/async-component.ts`                                   | 新增 | 实现 `defineAsyncComponent()` 和 loader 类型               |
| `src/index.ts`                                                       | 修改 | 从 package root 导出 helper 和 `AsyncComponentLoader` 类型 |
| `tests/unit/component/component.test.ts`                             | 修改 | 覆盖 pending、resolve、latest props、slots 和单次加载      |
| `tests/integration/package-exports.test.ts`                          | 修改 | 覆盖 ESM/CJS package root 导出                             |
| `scripts/package-consumer-smoke.mjs`                                 | 修改 | 在 packed consumer 中编译异步组件用例                      |
| `docs/api.md`                                                        | 修改 | 记录异步组件 API                                           |
| `readme.md`                                                          | 修改 | 更新当前能力和候选 API 说明                                |
| `docs/superpowers/specs/2026-07-13-define-async-component-design.md` | 新增 | 记录异步组件设计范围                                       |
| `docs/superpowers/plans/2026-07-13-define-async-component.md`        | 新增 | 记录 TDD 实施计划                                          |
| `solace-project-log/index.md`                                        | 修改 | 追加本次日志索引                                           |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                   |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，4 个新测试均因 `defineAsyncComponent` 缺失失败           |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、21 个测试通过                                      |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                       |
| Package exports tests  | `pnpm test:package`                                | 通过，构建成功，1 个测试文件、6 个测试通过                             |
| Package consumer smoke | `pnpm package:smoke`                               | 通过，packed consumer 可编译并加载异步组件用例、ESM/CJS 和 JSX runtime |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、86 个测试通过，package exports 测试通过       |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                   |

## 后续动作

- 后续如继续扩展异步组件，可单独设计 loading component、error component、delay、timeout 和 retry 选项。
