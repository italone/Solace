# 2026-07-10-012：接入 JSX 与 Vite 示例

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 示例 / 测试 / 工具
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 增加 JSX automatic runtime、Fragment VNode 支持、basic counter Vite 示例和 Playwright e2e 测试。示例通过 `solace` 和 `solace/jsx-runtime` alias 使用公开 API，不依赖内部相对路径。Vitest 配置已排除 Playwright e2e 文件，单元测试和浏览器 e2e 由独立脚本运行。

## 变动原因

阶段 5 Step 01 需要提供可运行示例，验证框架 API 在真实 Vite 应用中的使用体验。JSX runtime 能让示例以更接近现代前端项目的方式编写组件和事件。

## 影响范围

- 影响模块：VNode、renderer、JSX runtime、Vite 示例、Playwright e2e、TypeScript 配置、测试配置。
- 影响对象：`Fragment`、`jsx`、`jsxs`、`jsxDEV`、basic counter 示例、`test:e2e` 脚本。
- 行为变化：Solace 可通过 JSX 创建元素、组件和 Fragment；Vite 示例可启动并在浏览器中点击计数按钮；Playwright e2e 可验证交互。
- 风险等级：中；当前 Fragment 支持基础 mount/update/unmount，不覆盖复杂 Fragment 移动优化。

## 涉及文件

| 文件                                                                       | 动作 | 说明                                                                |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `src/jsx-runtime.ts`                                                       | 新增 | 实现 automatic JSX runtime 的 `jsx`、`jsxs`、`Fragment` 和 JSX 类型 |
| `src/jsx-dev-runtime.ts`                                                   | 新增 | 为 Vite dev JSX transform 提供 `jsxDEV`                             |
| `src/shared/flags.ts`                                                      | 修改 | 增加 Fragment shape flag                                            |
| `src/vnode/vnode.ts`                                                       | 修改 | 增加 `Fragment`、Fragment 类型和单 VNode children 规范化            |
| `src/vnode/h.ts`                                                           | 修改 | 支持 Fragment 和通用 VNodeType 创建                                 |
| `src/renderer/diff.ts`                                                     | 修改 | 支持 Fragment mount/update/unmount                                  |
| `src/index.ts`                                                             | 修改 | 导出 `Fragment` 和 Fragment 类型                                    |
| `examples/basic-counter/index.html`                                        | 新增 | 示例 HTML 入口                                                      |
| `examples/basic-counter/src/main.tsx`                                      | 新增 | 使用 JSX、`reactive`、`render` 实现计数器                           |
| `examples/basic-counter/vite.config.ts`                                    | 新增 | 配置 `solace`、`solace/jsx-runtime`、`solace/jsx-dev-runtime` alias |
| `playwright.config.ts`                                                     | 新增 | 配置 e2e webServer 和 Chromium 项目                                 |
| `tests/e2e/basic-counter.spec.ts`                                          | 新增 | 覆盖页面打开、按钮点击和计数更新                                    |
| `tests/unit/renderer/jsx-runtime.test.ts`                                  | 新增 | 覆盖 JSX runtime 和 Fragment 渲染                                   |
| `package.json`                                                             | 修改 | 增加 `test:e2e` 脚本和 Playwright/Node 类型依赖                     |
| `pnpm-lock.yaml`                                                           | 修改 | 锁定新增依赖                                                        |
| `tsconfig.json`                                                            | 修改 | 配置 JSX automatic runtime、jsxImportSource 和 paths                |
| `vitest.config.ts`                                                         | 修改 | 排除 Playwright e2e 测试目录                                        |
| `.gitignore`                                                               | 修改 | 忽略 Playwright 测试产物                                            |
| `solace-project-plan/solace-phase-05-compiler-tooling/step-01-jsx-vite.md` | 修改 | 标记 Step 01 执行清单完成                                           |
| `solace-project-log/solace-entries/2026-07-10-012-jsx-vite-example.md`     | 新增 | 记录本次 JSX/Vite 示例变更                                          |
| `solace-project-log/index.md`                                              | 修改 | 追加本次变更索引                                                    |

## 验证记录

| 验证项                    | 命令或方式                                                                                                                         | 结果                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TDD RED：JSX runtime 缺失 | `pnpm test tests/unit/renderer/jsx-runtime.test.ts`                                                                                | 失败符合预期，缺少 `src/jsx-runtime.ts`           |
| JSX runtime 单元测试      | `pnpm test tests/unit/renderer/jsx-runtime.test.ts`                                                                                | 通过，1 个测试文件、2 个测试                      |
| 依赖安装                  | `pnpm install`、`pnpm add -D @types/node --store-dir /Users/alone/Library/pnpm/store/v10`、`pnpm exec playwright install chromium` | 通过；Playwright 浏览器安装需提升权限写入用户缓存 |
| 类型检查                  | `pnpm typecheck`                                                                                                                   | 通过，退出码为 0                                  |
| 静态检查                  | `pnpm lint`                                                                                                                        | 通过，退出码为 0                                  |
| 单元/集成测试             | `pnpm test`                                                                                                                        | 通过，13 个测试文件、61 个测试                    |
| 构建                      | `pnpm build`                                                                                                                       | 通过，库产物和类型声明生成成功                    |
| 浏览器 e2e                | `pnpm test:e2e`                                                                                                                    | 通过，1 个 Chromium 测试                          |
| 全量质量门禁              | `pnpm quality`                                                                                                                     | 通过，13 个测试文件、61 个测试，构建通过          |

## 后续动作

- 继续阶段 5 Step 02，完善 package build 输出、exports 和发布前检查。
- 后续可扩展 JSX 类型、Fragment diff 移动语义和更多示例页面。
