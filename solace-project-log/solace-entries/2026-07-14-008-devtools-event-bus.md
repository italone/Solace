# 2026-07-14-008：新增内部 DevTools event bus

## 基本信息

- 日期：2026-07-14
- 类型：内部工具 / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增内部 DevTools event bus 模块 `src/devtools/events.ts`，提供 listener 注册、取消、事件发射、listener 存在性判断和测试清理能力。该模块不从 package root 导出，也尚未接入组件、scheduler 或 renderer runtime hook。

## 变动原因

DevTools 评估文档建议先建立 development-only event model，再实现具体 runtime hook。本次先实现最小内部事件总线，为后续组件和 scheduler 调试信号提供稳定边界。

## 影响范围

- 影响模块：内部 DevTools 模块、单元测试、DevTools 文档、项目日志。
- 行为变化：新增内部模块；无公共 API 变化，无 runtime hook 变化。
- 风险等级：低；未接入 runtime，package root exports 不变。

## 涉及文件

| 文件                                                                     | 动作 | 说明                               |
| ------------------------------------------------------------------------ | ---- | ---------------------------------- |
| `src/devtools/events.ts`                                                 | 新增 | 内部 DevTools event bus            |
| `tests/unit/devtools/devtools-events.test.ts`                            | 新增 | 覆盖 listener 注册、取消和错误隔离 |
| `docs/devtools.md`                                                       | 修改 | 记录 event bus 已存在              |
| `docs/superpowers/specs/2026-07-14-devtools-event-bus-design.md`         | 新增 | 记录设计                           |
| `docs/superpowers/plans/2026-07-14-devtools-event-bus.md`                | 新增 | 记录实施计划                       |
| `solace-project-log/index.md`                                            | 修改 | 追加本次日志索引                   |
| `solace-project-log/solace-entries/2026-07-14-008-devtools-event-bus.md` | 新增 | 记录本次变更                       |

## 验证记录

| 验证项        | 命令或方式                                                         | 结果                                 |
| ------------- | ------------------------------------------------------------------ | ------------------------------------ |
| TDD red       | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，内部模块缺失时测试按预期失败   |
| Targeted test | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，1 个测试文件、4 个测试通过     |
| Tests         | `pnpm test`                                                        | 通过，16 个测试文件、119 个测试通过  |
| Typecheck     | `pnpm typecheck`                                                   | 通过，无类型错误                     |
| Lint          | `pnpm lint`                                                        | 通过，无 ESLint 错误                 |
| Build         | `pnpm build`                                                       | 通过，Rollup 产物构建成功            |
| 格式检查      | `pnpm format:check`                                                | 通过，所有匹配文件符合 Prettier 风格 |

## 后续动作

- 后续可优先接入 component mount/update/unmount 或 scheduler flush summary，且必须验证无 listener 时无可观察 runtime 行为变化。
