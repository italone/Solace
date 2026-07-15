# 2026-07-10-014：完善示例与文档

## 基本信息

- 日期：2026-07-10
- 类型：文档 / 示例 / 测试
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将 README 开头调整为当前可运行框架说明，并补充 API、架构和性能方法文档。新增 todo-app 和 large-list 两个 Vite 示例，分别覆盖列表新增/删除/切换和 10,000 行渲染/局部更新。Playwright 现在同时启动 basic-counter、todo-app、large-list 三个示例并运行 e2e 测试。

## 变动原因

阶段 6 Step 01 需要让使用者能够通过文档理解 Solace 的公开 API、架构数据流和性能验证边界，并通过示例快速验证框架行为。

## 影响范围

- 影响模块：README、API 文档、架构文档、性能文档、Vite 示例、Playwright e2e。
- 影响对象：basic counter、todo app、large list、`test:e2e` webServer 配置、示例开发脚本。
- 行为变化：`pnpm test:e2e` 会启动 3 个 Vite 示例；`pnpm dev:todo` 和 `pnpm dev:large` 可分别启动新增示例。
- 风险等级：低；主要是示例和文档变更，运行时核心未改动。

## 涉及文件

| 文件                                                                           | 动作 | 说明                                                   |
| ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------ |
| `readme.md`                                                                    | 修改 | 开头改为当前可运行框架说明，保留后续设计背景           |
| `docs/api.md`                                                                  | 修改 | 记录 app、响应式、渲染、组件、生命周期、store、JSX API |
| `docs/architecture.md`                                                         | 修改 | 记录响应式到渲染、组件、DOM patch、事件和包结构数据流  |
| `docs/performance.md`                                                          | 修改 | 记录性能验证方法和基准建议，不声明未验证结果           |
| `examples/todo-app/**`                                                         | 新增 | Todo 示例，覆盖新增、删除、切换状态                    |
| `examples/large-list/**`                                                       | 新增 | Large list 示例，覆盖 10,000 行渲染和局部更新          |
| `tests/e2e/todo-app.spec.ts`                                                   | 新增 | Todo 示例浏览器交互测试                                |
| `tests/e2e/large-list.spec.ts`                                                 | 新增 | Large list 浏览器渲染和更新测试                        |
| `playwright.config.ts`                                                         | 修改 | 增加 todo-app 和 large-list webServer                  |
| `package.json`                                                                 | 修改 | 增加 `dev:todo`、`dev:large` 示例脚本                  |
| `solace-project-plan/solace-phase-06-quality-release/step-01-examples-docs.md` | 修改 | 标记 Step 01 执行清单完成                              |
| `solace-project-log/solace-entries/2026-07-10-014-examples-docs.md`            | 新增 | 记录本次示例与文档变更                                 |
| `solace-project-log/index.md`                                                  | 修改 | 追加本次变更索引                                       |

## 验证记录

| 验证项       | 命令或方式       | 结果                                                               |
| ------------ | ---------------- | ------------------------------------------------------------------ |
| 类型检查     | `pnpm typecheck` | 通过，退出码为 0                                                   |
| 静态检查     | `pnpm lint`      | 通过，退出码为 0                                                   |
| 全量质量门禁 | `pnpm quality`   | 通过，14 个测试文件、66 个测试，构建通过                           |
| 浏览器 e2e   | `pnpm test:e2e`  | 通过，3 个 Chromium 测试，覆盖 basic counter、todo app、large list |

## 后续动作

- 继续阶段 6 Step 02，补充 benchmark 和发布前检查。
- 后续可将示例文档扩展为独立 examples guide，并加入截图或在线预览说明。
