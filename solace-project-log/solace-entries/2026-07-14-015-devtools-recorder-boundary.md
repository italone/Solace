# 2026-07-14-015：新增 DevTools internal recorder boundary

## 基本信息

- 日期：2026-07-14
- 类型：内部工具 / DevTools integration boundary / 单元测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增内部 `createDevtoolsRecorder()` helper。recorder 会安装内部 DevTools listener，收集经过
`serializeDevtoolsEvent()` 处理后的事件，提供 `snapshot()` 返回事件副本，并通过 `stop()` 取消订阅。

## 变动原因

payload stability smoke 已锁定事件字段边界。进入 public integration surface 或 UI 前，需要一个内部 recorder
边界供 examples 或实验使用，同时避免把 DevTools 变成 package root public API。

## 影响范围

- 影响模块：内部 DevTools event bus、单元测试、DevTools 文档、项目日志。
- 行为变化：新增内部 recorder；无 package root export 变化。
- 风险等级：低；helper 复用现有 listener 与 serializer，不改变 runtime 事件发射路径。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                |
| -------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `src/devtools/events.ts`                                                         | 修改 | 增加内部 `createDevtoolsRecorder()` |
| `tests/unit/devtools/devtools-events.test.ts`                                    | 修改 | 覆盖 recorder snapshot/stop 行为    |
| `docs/devtools.md`                                                               | 修改 | 记录内部 recorder boundary          |
| `docs/superpowers/specs/2026-07-14-devtools-recorder-boundary-design.md`         | 新增 | 记录设计                            |
| `docs/superpowers/plans/2026-07-14-devtools-recorder-boundary.md`                | 新增 | 记录实施计划                        |
| `solace-project-log/index.md`                                                    | 修改 | 追加本次日志索引                    |
| `solace-project-log/solace-entries/2026-07-14-015-devtools-recorder-boundary.md` | 新增 | 记录本次变更                        |

## 验证记录

| 验证项            | 命令或方式                                                         | 结果                                                 |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| TDD red           | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，缺少 `createDevtoolsRecorder()` 时新增测试失败 |
| DevTools test     | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，1 个测试文件、5 个测试通过                     |
| Tests             | `pnpm test`                                                        | 通过，17 个测试文件、129 个测试通过                  |
| Typecheck         | `pnpm typecheck`                                                   | 通过，无类型错误                                     |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                            | 通过，无类型错误                                     |
| Lint              | `pnpm lint`                                                        | 通过，无 ESLint 错误                                 |
| Build             | `pnpm build`                                                       | 通过，Rollup 产物构建成功                            |
| Package exports   | `pnpm test:package`                                                | 通过，1 个测试文件、6 个测试通过                     |
| E2E               | `pnpm test:e2e`                                                    | 通过，3 个 Chromium 用例通过                         |
| 格式检查          | `pnpm format:check`                                                | 通过，所有匹配文件符合 Prettier 风格                 |

## 后续动作

- 后续可用 recorder 做 example-oriented smoke；仍需单独设计 public API 生命周期与生产构建边界。
