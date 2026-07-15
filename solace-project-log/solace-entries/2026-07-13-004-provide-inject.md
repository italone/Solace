# 2026-07-13-004：新增 provide/inject API

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增 `provide()` 和 `inject()` 组件上下文 API。父组件可在 setup 阶段提供 string 或 symbol key 的值，后代组件可沿父链读取最近提供者的值，并在缺失时使用默认值。

## 变动原因

README 的测试策略已将 provide/inject 列为集成覆盖方向，且现有组件实例、setup context 和 `currentInstance` 模型可以承载该能力。相比 slots 或异步组件，该能力改动面更小，能直接补齐跨层组件通信基础。

## 影响范围

- 影响模块：component、renderer、package root exports、package consumer smoke、API 文档、README。
- 影响对象：组件实例父链、组件上下文提供与注入、ESM/CJS package root 导出。
- 行为变化：用户可从 `solace` 根入口导入 `provide` 和 `inject`。
- 风险等级：中；渲染器 `patch()` 现在会在线程式传递父组件实例，但不改变 DOM diff、事件或响应式调度语义。

## 涉及文件

| 文件                                                  | 动作 | 说明                                          |
| ----------------------------------------------------- | ---- | --------------------------------------------- |
| `src/component/component.ts`                          | 修改 | 组件实例新增 `parent` 和 `provides`           |
| `src/component/lifecycle.ts`                          | 修改 | 暴露内部 `getCurrentInstance()`               |
| `src/component/provide.ts`                            | 新增 | 实现 `provide()`、`inject()` 和类型           |
| `src/renderer/diff.ts`                                | 修改 | 在组件挂载和子树 patch 中传递父实例           |
| `src/index.ts`                                        | 修改 | 从 package root 导出上下文 API                |
| `tests/unit/component/component.test.ts`              | 修改 | 覆盖祖先注入、最近提供者、symbol key 和默认值 |
| `tests/integration/package-exports.test.ts`           | 修改 | 覆盖 ESM/CJS package root 导出                |
| `scripts/package-consumer-smoke.mjs`                  | 修改 | packed consumer 中验证 provide/inject         |
| `docs/api.md`                                         | 修改 | 记录组件上下文 API                            |
| `readme.md`                                           | 修改 | 更新当前公共 API 和候选 API 说明              |
| `docs/superpowers/plans/2026-07-13-provide-inject.md` | 新增 | 记录本次实现计划                              |
| `solace-project-log/index.md`                         | 修改 | 追加本次日志索引                              |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                                 |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，`provide/inject is not a function`                                     |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、12 个测试通过                                                    |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                                     |
| Package exports tests  | `pnpm test:package`                                | 通过，构建成功，1 个测试文件、6 个测试通过                                           |
| Package consumer smoke | `pnpm package:smoke`                               | 初次因 fixture 使用 render-function 组件触发 TSX 类型错误；改为直接返回 VNode 后通过 |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、77 个测试通过                                               |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                                 |

## 后续动作

- 后续如引入 slots，应单独设计组件 children 协议和 JSX children 类型边界。
