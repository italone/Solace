# 2026-07-14-014：补充 DevTools payload stability smoke

## 基本信息

- 日期：2026-07-14
- 类型：内部工具 / DevTools payload boundary / 集成测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

新增内部 `serializeDevtoolsEvent()` helper，并增加 DevTools payload stability 集成测试。测试覆盖 renderer、
component、reactivity、store、scheduler 的集成事件流，验证 payload 只包含白名单字段、可 JSON round-trip，且不包含
object 或 function 形式的 live runtime 对象。

## 变动原因

初始 runtime summary 已覆盖主要模块。进入 public integration surface 或 UI 前，需要先锁定内部事件 payload 边界，
避免后续误把 DOM node、VNode、props、children、raw target、action args、return value 或 error 对象透出。

## 影响范围

- 影响模块：内部 DevTools event bus、集成测试、DevTools 文档、项目日志。
- 行为变化：新增内部 serializer；无 package root export 变化。
- 风险等级：低；helper 仅显式复制已有事件字段，不改变事件发射路径。

## 涉及文件

| 文件                                                                             | 动作 | 说明                                  |
| -------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| `src/devtools/events.ts`                                                         | 修改 | 增加内部 `serializeDevtoolsEvent()`   |
| `tests/integration/devtools-payload-stability.test.ts`                           | 新增 | 覆盖集成事件 payload 稳定性和隐私边界 |
| `docs/devtools.md`                                                               | 修改 | 记录内部 serializer 和 payload smoke  |
| `docs/superpowers/specs/2026-07-14-devtools-payload-stability-design.md`         | 新增 | 记录设计                              |
| `docs/superpowers/plans/2026-07-14-devtools-payload-stability.md`                | 新增 | 记录实施计划                          |
| `solace-project-log/index.md`                                                    | 修改 | 追加本次日志索引                      |
| `solace-project-log/solace-entries/2026-07-14-014-devtools-payload-stability.md` | 新增 | 记录本次变更                          |

## 验证记录

| 验证项            | 命令或方式                                                                  | 结果                                                 |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| TDD red           | `pnpm exec vitest run tests/integration/devtools-payload-stability.test.ts` | 通过，缺少 `serializeDevtoolsEvent()` 时新增测试失败 |
| Payload test      | `pnpm exec vitest run tests/integration/devtools-payload-stability.test.ts` | 通过，1 个测试文件、1 个测试通过                     |
| Tests             | `pnpm test`                                                                 | 通过，17 个测试文件、128 个测试通过                  |
| Typecheck         | `pnpm typecheck`                                                            | 通过，无类型错误                                     |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                                     | 通过，无类型错误                                     |
| Lint              | `pnpm lint`                                                                 | 通过，无 ESLint 错误                                 |
| Build             | `pnpm build`                                                                | 通过，Rollup 产物构建成功                            |
| Package exports   | `pnpm test:package`                                                         | 通过，1 个测试文件、6 个测试通过                     |
| E2E               | `pnpm test:e2e`                                                             | 通过，3 个 Chromium 用例通过                         |
| 格式检查          | `pnpm format:check`                                                         | 通过，所有匹配文件符合 Prettier 风格                 |

## 后续动作

- 后续若要增加 public integration surface，需要单独设计 API 生命周期、启用方式和生产构建边界。
