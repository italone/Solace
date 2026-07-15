# 2026-07-10-013：配置包构建与导出

## 基本信息

- 日期：2026-07-10
- 类型：源码 / 构建 / 测试 / 文档
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

为 Solace 配置可消费的 package exports，覆盖根入口、`solace/jsx-runtime` 和 `solace/jsx-dev-runtime`。Rollup 现在构建 ESM、CJS 和类型声明多入口产物，并在构建开始时清理 `dist/`，避免旧 chunk 混入发布包。新增最小 `createApp`，用于包入口验收和示例级挂载。新增 package exports 集成测试，覆盖 ESM self-reference、CJS require、JSX runtime 子路径和 `createApp.mount`。

## 变动原因

阶段 5 Step 02 需要让构建产物可被外部项目通过包入口消费，而不是依赖内部 `src/**` 或 `dist/**` 路径。JSX runtime 子入口也需要通过 package exports 暴露，供 TypeScript/Vite automatic JSX transform 使用。

## 影响范围

- 影响模块：app API、package exports、Rollup 构建、CI/quality 脚本、包使用文档、集成测试。
- 影响对象：`createApp`、`exports`、`files`、ESM/CJS 多入口产物、JSX runtime 子路径。
- 行为变化：外部消费者可从 `solace`、`solace/jsx-runtime`、`solace/jsx-dev-runtime` 导入公开 API；CJS `require("solace")` 可加载根入口；包 tarball 只包含 dist、docs、readme 和 package metadata。
- 风险等级：中；当前 `private: true` 仍保留，表示尚不执行真实发布，只验证包构建和本地打包形态。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                                                                        |
| ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `src/app.ts`                                                                    | 新增 | 实现最小 `createApp(root).mount(container)`                                                 |
| `src/index.ts`                                                                  | 修改 | 导出 `createApp` 和 `App` 类型                                                              |
| `rollup.config.mjs`                                                             | 修改 | 配置多入口 ESM/CJS/d.ts 输出、CJS chunk 后缀和 dist 清理                                    |
| `package.json`                                                                  | 修改 | 增加 `exports`、`files`、`sideEffects`、`typecheck:jsxdev`，调整 `quality` 为 build 后 test |
| `.github/workflows/ci.yml`                                                      | 修改 | CI 增加 JSX dev runtime 类型检查，并调整为 build 后 test，匹配 package exports 测试依赖     |
| `tsconfig.jsxdev.json`                                                          | 新增 | 验证 `react-jsxdev` 模式下 `solace/jsx-dev-runtime` 类型可消费                              |
| `src/jsx-dev-runtime.ts`                                                        | 修改 | 重新导出 JSX namespace，补齐 dev runtime 类型入口                                           |
| `docs/package-usage.md`                                                         | 新增 | 记录安装、导入、最小示例、JSX 配置和公共入口                                                |
| `tests/integration/package-exports.test.ts`                                     | 新增 | 覆盖 dist 产物、ESM/CJS 包导出、JSX runtime 子路径和 `createApp`                            |
| `solace-project-plan/solace-phase-05-compiler-tooling/step-02-package-build.md` | 修改 | 标记 Step 02 执行清单完成                                                                   |
| `solace-project-log/solace-entries/2026-07-10-013-package-build-exports.md`     | 新增 | 记录本次包构建与导出变更                                                                    |
| `solace-project-log/index.md`                                                   | 修改 | 追加本次变更索引                                                                            |

## 验证记录

| 验证项                            | 命令或方式                                                          | 结果                                                                   |
| --------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| TDD RED：包导出产物缺失           | `pnpm build && pnpm test tests/integration/package-exports.test.ts` | 失败符合预期，缺少 JSX runtime dist 子入口                             |
| CJS RED：共享 chunk 后缀错误      | `pnpm build && pnpm test tests/integration/package-exports.test.ts` | 失败符合预期，CJS require 加载 `.js` chunk 时触发 ESM/CJS 冲突         |
| TDD RED：JSX dev runtime 类型缺失 | `pnpm typecheck:jsxdev`                                             | 失败符合预期，`react-jsxdev` 模式缺少 `JSX.IntrinsicElements`          |
| package exports 集成测试          | `pnpm build && pnpm test tests/integration/package-exports.test.ts` | 通过，1 个测试文件、5 个测试                                           |
| JSX dev runtime 类型检查          | `pnpm typecheck:jsxdev`                                             | 通过，退出码为 0                                                       |
| 打包清单检查                      | `pnpm build && pnpm pack --dry-run`                                 | 通过，tarball 包含 `dist/**`、`docs/**`、`readme.md` 和 `package.json` |
| 全量质量门禁                      | `pnpm quality`                                                      | 通过，14 个测试文件、66 个测试，构建通过                               |
| 浏览器 e2e                        | `pnpm test:e2e`                                                     | 通过，1 个 Chromium 测试                                               |

## 后续动作

- 继续阶段 6 Step 01，完善示例、文档和 API 说明。
- 发布前可移除或调整 `private: true`，并补充更接近真实消费者项目的 pack/install smoke test。
