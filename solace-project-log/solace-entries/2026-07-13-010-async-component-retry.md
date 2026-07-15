# 2026-07-13-010：扩展异步组件 retry 选项

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 `defineAsyncComponent()` 对象选项新增 `retry` 与 `retryDelay`。loader reject 或 timeout 都会计为失败；如果剩余重试次数未耗尽，组件保持 loading 路径并再次启动 loader；重试全部失败后才进入 error 状态。

## 变动原因

异步组件已支持 loading/error 与 delay/timeout，但暂时性加载失败会立即进入 error。本次补齐最小自动重试语义，让组件可以对短暂 reject 或 timeout 做有限次数恢复，同时保持默认单次加载行为不变。

## 影响范围

- 影响模块：async component helper、组件单元测试、package consumer smoke、API 文档、README。
- 影响对象：异步组件 pending/loading/error 状态、公开 TypeScript 类型。
- 行为变化：用户可在异步组件对象选项中设置 `retry` 和 `retryDelay`。
- 风险等级：中；新增 attempt id、retry timer 和失败路径统一处理，但不改 renderer 主流程。

## 涉及文件

| 文件                                                                | 动作 | 说明                                                              |
| ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `src/component/async-component.ts`                                  | 修改 | 增加 retry/retryDelay 选项、attempt id、retry timer 和失败处理    |
| `tests/unit/component/component.test.ts`                            | 修改 | 覆盖 reject retry、retry success、retry exhaustion、timeout retry |
| `scripts/package-consumer-smoke.mjs`                                | 修改 | 在 packed consumer 中编译 retry 选项                              |
| `docs/api.md`                                                       | 修改 | 记录 retry/retryDelay 用法                                        |
| `readme.md`                                                         | 修改 | 将 retry 纳入当前异步组件能力说明                                 |
| `docs/superpowers/specs/2026-07-13-async-component-retry-design.md` | 新增 | 记录 retry 选项设计范围                                           |
| `docs/superpowers/plans/2026-07-13-async-component-retry.md`        | 新增 | 记录 TDD 实施计划                                                 |
| `solace-project-log/index.md`                                       | 修改 | 追加本次日志索引                                                  |

## 验证记录

| 验证项                 | 命令或方式                                         | 结果                                                                  |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/component/component.test.ts` | 失败符合预期，4 个新 retry 测试因 loader 只调用一次而失败             |
| 定向组件测试           | `pnpm test tests/unit/component/component.test.ts` | 通过，1 个测试文件、34 个测试通过                                     |
| Typecheck              | `pnpm typecheck`                                   | 通过，无类型错误                                                      |
| Package consumer smoke | `pnpm package:smoke`                               | 通过，packed consumer 可编译并加载 retry 选项、ESM/CJS 和 JSX runtime |
| 质量门禁               | `pnpm quality`                                     | 首次因 `src/component/async-component.ts` 格式失败；Prettier 后通过   |
| 格式检查               | `pnpm format:check`                                | 通过，所有匹配文件符合 Prettier 风格                                  |

## 后续动作

- 后续如继续扩展异步组件，可单独设计取消、错误对象传递或 Suspense 类能力。
