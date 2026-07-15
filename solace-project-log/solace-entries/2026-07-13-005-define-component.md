# 2026-07-13-005：新增 defineComponent API

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `defineComponent()` 组件声明 helper。该 API 接收现有函数组件并原样返回，用于提供更明确的组件声明入口，同时不引入 options API 或改变渲染器运行时行为。

## 变动原因

README 将 `defineComponent()` 列为后续候选 API。相比 slots 或异步组件，它是低风险的 public API 收口，可以改善组件声明语义，并为后续扩展组件选项形态预留稳定入口。

## 影响范围

- 影响模块：component、package root exports、package consumer smoke、API 文档、README。
- 影响对象：组件声明 helper、ESM/CJS package root 导出。
- 行为变化：用户可从 `solace` 根入口导入 `defineComponent`。
- 风险等级：低；`defineComponent()` 是 identity helper，不改变组件挂载、props、emit 或上下文行为。

## 涉及文件

| 文件                                                    | 动作 | 说明                                   |
| ------------------------------------------------------- | ---- | -------------------------------------- |
| `src/component/define-component.ts`                     | 新增 | 实现 `defineComponent()`               |
| `src/index.ts`                                          | 修改 | 从 package root 导出组件声明 helper    |
| `tests/unit/component/component.test.ts`                | 修改 | 覆盖 mount 和 props 行为               |
| `tests/integration/package-exports.test.ts`             | 修改 | 覆盖 ESM/CJS package root 导出         |
| `scripts/package-consumer-smoke.mjs`                    | 修改 | packed consumer 中验证 defineComponent |
| `docs/api.md`                                           | 修改 | 记录组件声明 API                       |
| `readme.md`                                             | 修改 | 更新当前公共 API 和候选 API 说明       |
| `docs/superpowers/plans/2026-07-13-define-component.md` | 新增 | 记录本次实现计划                       |
| `solace-project-log/index.md`                           | 修改 | 追加本次日志索引                       |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                    |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，`defineComponent is not a function`                       |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、14 个测试通过                                       |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                        |
| Package exports tests  | `pnpm test:package`                                | 通过，构建成功，1 个测试文件、6 个测试通过                              |
| Package consumer smoke | `pnpm package:smoke`                               | 初次因 helper 返回类型拓宽触发 TSX 类型错误；保留传入组件精确类型后通过 |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、79 个测试通过                                  |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                    |

## 后续动作

- 后续如引入 slots，应在 `defineComponent()` 已存在的基础上单独设计 children/slots 协议。
