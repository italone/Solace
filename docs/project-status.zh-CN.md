# 项目完成度

[English](./project-status.md)

本文档用于总结 Solace 作为开源前端框架的当前完成度。这里会区分已实现运行时能力、验证覆盖、文档就绪度、已知缺口和发布协调状态。

## 总览

Solace 当前是一个早期 alpha runtime，已经具备可运行的公共 API、包导出、示例、测试、benchmark 和发布检查。它适合作为一个小型、可阅读、可实验的前端框架进行推广，但不应被描述为 React、Vue、Svelte 或同类生态的成熟生产替代品。

当前本地仓库状态：

- 包名：`@italone/solace`
- 本地 package 版本：`0.0.3`
- 公开包元数据：已启用，`"private": false`
- 当前分支：`main`
- 最近一次梳理时的本地分支状态：比 `origin/main` 领先一个 release-preparation commit
- 发布阶段：当前工作流按要求跳过

## 完成度映射

| 领域            | 状态                | 依据                                                                                                                    |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| App API         | 已实现              | `createApp`、`mount`、`use` 和 app-level `provide` 已从包根入口导出，并在 `docs/api.zh-CN.md` 中记录。                  |
| 响应式          | 已实现              | `reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 已导出，并有单元测试覆盖。                            |
| 调度器          | 已实现              | `nextTick` 和组件批处理更新已实现，并有 scheduler 测试和集成覆盖。                                                      |
| 渲染器          | 已实现              | `src/renderer/**` 已包含 VNode 渲染、DOM patch、Fragment、keyed diff 和 move-path instrumentation。                     |
| 组件            | 已实现              | 函数组件、setup context、props、emit、slots、生命周期、provide/inject 和异步组件均已文档化并测试。                      |
| Store           | 已实现              | `createStore` 组合 reactive state、computed getters 和 named actions，并包含 DevTools action summaries。                |
| JSX             | 已实现              | package exports 包含 `jsx-runtime` 和 `jsx-dev-runtime`，并有 JSX 示例和 typecheck 覆盖。                               |
| DevTools 子路径 | 已作为底层 API 实现 | `@italone/solace/devtools` 暴露 listener 和 recorder API，但不是浏览器扩展或 UI。                                       |
| 示例            | 已实现              | `examples/**` 下包含 basic counter、todo app、large list 和 performance benchmark 示例。                                |
| 包产物          | 已实现              | Rollup 构建 ESM、CJS 和类型声明；package export tests 和 packed-consumer smoke tests 校验公开入口。                     |
| 文档            | 基本完整            | 已有英文/中文 README、API、package usage、release、performance、architecture、DevTools、contributing 和 security 文档。 |
| 发布门禁        | 已实现              | 已配置 `release:readiness`、`quality`、`release:check`、package smoke、benchmark 和 e2e scripts。                       |

## 验证覆盖

仓库包含以下验证层：

- 格式检查：`pnpm format:check`
- TypeScript runtime typecheck：`pnpm typecheck`
- JSX development runtime typecheck：`pnpm typecheck:jsxdev`
- Lint：`pnpm lint`
- 单元测试和集成测试：`pnpm test`
- 包导出测试：包含在 `pnpm test:package` 中
- 覆盖率阈值：`pnpm test:coverage`
- packed package consumer smoke：`pnpm package:smoke`
- jsdom benchmark smoke：`pnpm benchmark`
- Chromium 生产构建浏览器 benchmark：`pnpm benchmark:browser`
- 浏览器 e2e：`pnpm test:e2e`
- 完整本地门禁：`pnpm release:check`

最近的本地 release checks 已覆盖完整门禁，包括 package smoke、coverage、browser benchmark 和 e2e。后续在声明完成、合并或发布前，需要重新运行对应命令。

## 公共 API 边界

支持的公开入口：

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`

不支持的私有区域：

- `src/**`
- `dist/**`
- scheduler queues
- renderer diagnostics 和 instrumentation internals
- component instances
- VNode factory internals
- DevTools internal emit helpers

alpha 阶段的兼容性承诺只适用于文档化公开入口。框架稳定前，内部模块仍可能变化。

## 已知缺口

Solace 当前有意不包含：

- template compiler 或 single-file component compiler。
- 一方 router。
- SSR、SSG、streaming rendering 或 hydration。
- 一方 UI component library。
- 浏览器扩展 DevTools panel。
- 稳定 plugin 生态。
- 面向内部模块的长期兼容性策略。
- 面向大型应用的生产落地指南。

这些缺口应在推广材料中保持可见，避免外部误解项目定位。

## 发布协调状态

发布独立于仓库就绪度。当前本地分支可以包含尚未同步到 npm 的 release-preparation changes。

未来发布任何版本前：

1. 确认本地分支已经 push，或明确接受从本地状态发布。
2. 确认 package version 尚未发布。
3. 运行 `pnpm release:readiness -- --publishable`。
4. 运行 `pnpm release:check`。
5. 如果继续使用当前已验证可用的临时 npm cache，运行 `npm publish --dry-run --access public --cache /private/tmp/npm-cache`。
6. 只有在 npm authentication、organization access、public access 和 one-time password 都准备好后才发布。

当前工作流按要求跳过发布。

## 建议后续工作

1. 保持 README、API、package usage 和 release docs 与真实 npm version、本地分支状态一致。
2. 在作出性能宣称前，继续收集 keyed reorder 和 large-list 场景的 browser benchmark history。
3. 先稳定公共 API 面，再扩展 compiler、router、SSR、hydration 或 DevTools UI。
4. 对所有公共 API 变更保持 package export tests 和 packed-consumer smoke tests 必跑。
5. 只有在真正准备 npm 版本时才添加 release notes，避免混淆未发布分支状态和 npm package 状态。
