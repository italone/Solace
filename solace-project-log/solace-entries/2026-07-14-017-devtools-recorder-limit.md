# 2026-07-14-017：新增 DevTools recorder bounded capture

## 基本信息

- 日期：2026-07-14
- 类型：内部工具 / DevTools recorder / 单元测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为内部 `createDevtoolsRecorder()` 增加可选 `{ limit }`。配置 limit 后，recorder 只保留最新 N 条经过
`serializeDevtoolsEvent()` 处理的事件；未配置 limit 时保持原有无限制行为。无效 limit 会在创建 recorder 时抛错。

## 变动原因

example-oriented smoke 已验证 recorder 可用于交互窗口。bounded capture 进一步降低 examples 或实验场景中的内存风险，
同时不引入 public DevTools API。

## 影响范围

- 影响模块：内部 DevTools event bus、单元测试、DevTools 文档、项目日志。
- 行为变化：recorder 支持 bounded capture；无 package root export 变化。
- 风险等级：低；只影响 recorder 内部数组管理，不改变 runtime 事件发射路径。

## 涉及文件

| 文件                                                                          | 动作 | 说明                                    |
| ----------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `src/devtools/events.ts`                                                      | 修改 | 增加 `DevtoolsRecorderOptions` 和 limit |
| `tests/unit/devtools/devtools-events.test.ts`                                 | 修改 | 覆盖 bounded capture 和 invalid limit   |
| `docs/devtools.md`                                                            | 修改 | 记录 recorder bounded capture           |
| `docs/superpowers/specs/2026-07-14-devtools-recorder-limit-design.md`         | 新增 | 记录设计                                |
| `docs/superpowers/plans/2026-07-14-devtools-recorder-limit.md`                | 新增 | 记录实施计划                            |
| `solace-project-log/index.md`                                                 | 修改 | 追加本次日志索引                        |
| `solace-project-log/solace-entries/2026-07-14-017-devtools-recorder-limit.md` | 新增 | 记录本次变更                            |

## 验证记录

| 验证项            | 命令或方式                                                         | 结果                                                    |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| TDD red           | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，limit 被忽略且 invalid limit 未抛错时新增测试失败 |
| DevTools test     | `pnpm exec vitest run tests/unit/devtools/devtools-events.test.ts` | 通过，1 个测试文件、8 个测试通过                        |
| Tests             | `pnpm test`                                                        | 通过，18 个测试文件、133 个测试通过                     |
| Typecheck         | `pnpm typecheck`                                                   | 通过，无类型错误                                        |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                            | 通过，无类型错误                                        |
| Lint              | `pnpm lint`                                                        | 通过，无 ESLint 错误                                    |
| Build             | `pnpm build`                                                       | 通过，Rollup 产物构建成功                               |
| Package exports   | `pnpm test:package`                                                | 通过，1 个测试文件、6 个测试通过                        |
| E2E               | `pnpm test:e2e`                                                    | 通过，3 个 Chromium 用例通过                            |
| 格式检查          | `pnpm format:check`                                                | 通过，所有匹配文件符合 Prettier 风格                    |

## 后续动作

- 后续若继续推进 DevTools，应先设计 public API 生命周期、启用方式和生产构建边界。
