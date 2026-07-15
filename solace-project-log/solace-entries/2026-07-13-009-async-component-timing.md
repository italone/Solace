# 2026-07-13-009：扩展异步组件 delay/timeout 选项

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 `defineAsyncComponent()` 对象选项新增 `delay` 与 `timeout`。`delay` 用于延迟显示 loading 组件，`timeout` 用于在 loader 长时间未完成时进入 error 状态。

## 变动原因

异步组件已经支持 loading/error 组件，但 loading 会立即显示，且无法处理加载超时。本次补齐最小 timing 语义，继续将 retry、取消和错误对象传递留到后续设计。

## 影响范围

- 影响模块：async component helper、组件单元测试、package consumer smoke、API 文档、README。
- 影响对象：异步组件 pending/loading/error 状态、公开 TypeScript 类型。
- 行为变化：用户可在异步组件对象选项中设置 `delay` 和 `timeout`。
- 风险等级：中；新增 timer 状态和 fake timer 测试，但不改 renderer 主流程。

## 涉及文件

| 文件                                                                 | 动作 | 说明                                              |
| -------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `src/component/async-component.ts`                                   | 修改 | 增加 delay/timeout 选项、timer 状态和清理逻辑     |
| `tests/unit/component/component.test.ts`                             | 修改 | 覆盖 delay、fast resolve、timeout 和 late resolve |
| `scripts/package-consumer-smoke.mjs`                                 | 修改 | 在 packed consumer 中编译 timing 选项             |
| `docs/api.md`                                                        | 修改 | 记录 delay/timeout 用法                           |
| `readme.md`                                                          | 修改 | 更新后续异步组件扩展说明                          |
| `docs/superpowers/specs/2026-07-13-async-component-timing-design.md` | 新增 | 记录 timing 选项设计范围                          |
| `docs/superpowers/plans/2026-07-13-async-component-timing.md`        | 新增 | 记录 TDD 实施计划                                 |
| `solace-project-log/index.md`                                        | 修改 | 追加本次日志索引                                  |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                   |
| ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，delay 立即显示且 timeout 不生效                          |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、29 个测试通过                                      |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                       |
| Package consumer smoke | `pnpm package:smoke`                               | 通过，packed consumer 可编译并加载 timing 选项、ESM/CJS 和 JSX runtime |
| 质量门禁               | `pnpm quality`                                     | 通过，14 个默认测试文件、94 个测试通过，package exports 测试通过       |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                   |

## 后续动作

- 后续如继续扩展异步组件，可单独设计 retry 选项。
