# 2026-07-13-013：新增 app.use 插件安装 API

## 基本信息

- 日期：2026-07-13
- 类型：功能 / 文档 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 `createApp()` 返回的 app 实例新增 `use(plugin, ...options)`。插件可以是函数，也可以是带 `install()` 的对象；同一个插件在同一个 app 实例上只安装一次，`use()` 返回 app 以支持链式调用。

## 变动原因

README 仍将插件系统列为候选能力。当前 app 只有 `mount()`，缺少三方库或应用级扩展的最小接入点。本次先建立低风险的插件安装契约，不引入全局组件、全局属性、app provide 或 DevTools hook。

## 影响范围

- 影响模块：app runtime、package root 类型导出、app 单元测试、package consumer smoke、API 文档、README。
- 影响对象：公开 TypeScript 类型 `App`、`Plugin`、`PluginInstall`、`PluginObject`。
- 行为变化：app 实例支持 `use()`，并按 app 实例维护已安装插件集合。
- 风险等级：低到中；新增 app API，但不改 renderer 或组件主流程。

## 涉及文件

| 文件                                                         | 动作 | 说明                                              |
| ------------------------------------------------------------ | ---- | ------------------------------------------------- |
| `src/app.ts`                                                 | 修改 | 增加插件类型、`App.use()` 和安装去重逻辑          |
| `src/index.ts`                                               | 修改 | 导出插件相关公共类型                              |
| `tests/unit/app/create-app.test.ts`                          | 修改 | 覆盖函数插件、对象插件、链式调用和 per-app 去重   |
| `scripts/package-consumer-smoke.mjs`                         | 修改 | 在 packed consumer 中编译 `Plugin` 和 `app.use()` |
| `docs/api.md`                                                | 修改 | 记录 `app.use()` 用法                             |
| `readme.md`                                                  | 修改 | 将插件安装 API 纳入当前能力说明                   |
| `docs/superpowers/specs/2026-07-13-app-use-plugin-design.md` | 新增 | 记录插件 API 设计范围                             |
| `docs/superpowers/plans/2026-07-13-app-use-plugin.md`        | 新增 | 记录 TDD 实施计划                                 |
| `solace-project-log/index.md`                                | 修改 | 追加本次日志索引                                  |

## 验证记录

| 验证项                 | 命令或方式                                    | 结果                                                                   |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED                | `pnpm test tests/unit/app/create-app.test.ts` | 失败符合预期，4 个新测试因 `app.use` 不存在而失败                      |
| 定向 app 测试          | `pnpm test tests/unit/app/create-app.test.ts` | 通过，1 个测试文件、6 个测试通过                                       |
| Typecheck              | `pnpm typecheck`                              | 通过，无类型错误                                                       |
| Package consumer smoke | `pnpm package:smoke`                          | 通过，packed consumer 可编译插件用法、ESM/CJS 和 JSX runtime           |
| 质量门禁               | `pnpm quality`                                | 通过，14 个默认测试文件、109 个测试通过，package exports 测试 6 个通过 |
| 格式检查               | `pnpm format:check`                           | 通过，所有匹配文件符合 Prettier 风格                                   |

## 后续动作

- 后续如继续扩展插件能力，可单独设计 app-level provide、全局配置或 DevTools hook。
