# 2026-07-13-006：新增默认 slots

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增组件默认 slots 支持。组件 setup context 现在包含 `slots`，组件可通过 `slots.default?.()` 渲染调用方传入的 VNode children，并在组件 children 更新时读取最新内容。

## 变动原因

组件 children 已经保存在 VNode 中，但此前不会进入组件 setup context，导致容器类组件无法组合调用方内容。默认 slots 是现有 VNode children 模型上的小步扩展，比 named slots、slot props 或异步组件风险更低。

## 影响范围

- 影响模块：component runtime、package root types、package consumer smoke、API 文档、README。
- 影响对象：函数组件 setup context、组件 children 更新路径、公开 TypeScript 类型。
- 行为变化：组件可读取 `ComponentSetupContext.slots.default` 并渲染默认 slot children。
- 风险等级：中低；变更集中在组件上下文，未改变 VNode children 归一化和 DOM patch 主路径。

## 涉及文件

| 文件                                                        | 动作 | 说明                                                |
| ----------------------------------------------------------- | ---- | --------------------------------------------------- |
| `src/component/component.ts`                                | 修改 | 增加 `Slot`/`Slots` 类型、实例 slots 初始化和更新   |
| `src/index.ts`                                              | 修改 | 从 package root 导出 `Slot` 与 `Slots` 类型         |
| `tests/unit/component/component.test.ts`                    | 修改 | 覆盖默认 slot 渲染、空 children fallback 和更新行为 |
| `scripts/package-consumer-smoke.mjs`                        | 修改 | 在 packed consumer 中编译默认 slot 使用方式         |
| `docs/api.md`                                               | 修改 | 记录 setup context slots 用法                       |
| `readme.md`                                                 | 修改 | 更新当前能力和后续候选 API 说明                     |
| `docs/superpowers/specs/2026-07-13-default-slots-design.md` | 新增 | 记录默认 slots 设计范围                             |
| `docs/superpowers/plans/2026-07-13-default-slots.md`        | 新增 | 记录 TDD 实施计划                                   |
| `solace-project-log/index.md`                               | 修改 | 追加本次日志索引                                    |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                  |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，3 个新测试均因 `slots` 为 `undefined` 失败              |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、17 个测试通过                                     |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                      |
| Package consumer smoke | `pnpm package:smoke`                               | 通过，packed consumer 可编译并加载 slots 用例、ESM/CJS 和 JSX runtime |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、82 个测试通过，package exports 测试通过      |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                  |

## 后续动作

- 后续如继续扩展组件组合能力，可单独设计 named slots 或 slot props。
- 异步组件仍保留为下一项候选 API。
