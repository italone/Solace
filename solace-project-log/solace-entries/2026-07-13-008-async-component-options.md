# 2026-07-13-008：扩展异步组件 loading/error 选项

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

扩展 `defineAsyncComponent()` 入参，支持 `{ loader, loadingComponent, errorComponent }` 对象形式。函数 loader 入参保持兼容；对象入参可在 pending 阶段渲染 loading 组件，在 loader reject 后渲染 error 组件。

## 变动原因

上一轮异步组件 helper 只提供空 Fragment pending 状态，并且内部记录 `loadError` 但不会暴露可见错误状态。本次补齐最小 loading/error UI 扩展，同时避免引入 delay、timeout、retry 等 timing 语义。

## 影响范围

- 影响模块：async component helper、组件单元测试、package consumer smoke、API 文档、README。
- 影响对象：异步组件 pending/reject 渲染状态、公开 TypeScript 类型。
- 行为变化：用户可用对象选项声明异步组件 loading/error 视图。
- 风险等级：中低；变更集中在 helper 入参归一化和状态渲染，不改 renderer 主流程。

## 涉及文件

| 文件                                                                  | 动作 | 说明                                                         |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `src/component/async-component.ts`                                    | 修改 | 增加对象选项类型、入参归一化和状态渲染                       |
| `src/index.ts`                                                        | 修改 | 从 package root 导出异步组件对象选项类型                     |
| `tests/unit/component/component.test.ts`                              | 修改 | 覆盖 loading、resolve replacement、error 和 props/slots 转发 |
| `scripts/package-consumer-smoke.mjs`                                  | 修改 | 在 packed consumer 中编译对象选项用法                        |
| `docs/api.md`                                                         | 修改 | 记录 loader 函数和对象选项两种用法                           |
| `readme.md`                                                           | 修改 | 更新后续异步组件扩展说明                                     |
| `docs/superpowers/specs/2026-07-13-async-component-options-design.md` | 新增 | 记录对象选项设计范围                                         |
| `docs/superpowers/plans/2026-07-13-async-component-options.md`        | 新增 | 记录 TDD 实施计划                                            |
| `solace-project-log/index.md`                                         | 修改 | 追加本次日志索引                                             |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                   |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，4 个新测试均因对象入参被当作 loader 失败                 |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、25 个测试通过                                      |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                       |
| Package consumer smoke | `pnpm package:smoke`                               | 通过，packed consumer 可编译并加载对象选项用例、ESM/CJS 和 JSX runtime |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、90 个测试通过，package exports 测试通过       |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                   |

## 后续动作

- 后续如继续扩展异步组件，可单独设计 delay、timeout 和 retry 选项。
