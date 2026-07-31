# 项目完成度

[English](./project-status.md)

本文档用于总结 Solace 作为开源前端框架的当前完成度。这里会区分已实现运行时能力、验证覆盖、文档就绪度、已知缺口和发布协调状态。

## 总览

Solace 当前是一个早期 alpha runtime，npm 最新公开版本仍是 `@italone/solace@0.0.4`，仓库 release preparation 已推进到 `0.0.5`。它已经具备可运行的公共 API、包导出、示例、测试、benchmark 和发布检查，适合作为一个小型、可阅读、可实验的前端框架进行推广，但不应被描述为 React、Vue、Svelte 或同类生态的成熟生产替代品。

当前本地仓库状态：

- 包名：`@italone/solace`
- 仓库 package 版本：`0.0.5`
- npm 已发布版本：`0.0.4`
- npm dist-tag：`latest` 指向 `0.0.4`
- 公开包元数据：已启用，`"private": false`
- 当前分支：`main`
- 本地分支状态：截至 2026-07-31，本地 `main` release baseline 已与 `origin/main` 同步。后续发布、同步或声明远端状态前，需重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
- 发布阶段：alpha 已发布；beta 契约稳定、SSR/hydration minimum loop，以及首个浏览器
  DevTools 扩展 timeline panel 已在仓库中实现

## 完成度映射

| 领域            | 状态                 | 依据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API         | 已实现               | `createApp`、`mount`、`use` 和 app-level `provide` 已从包根入口导出，并在 `docs/api.zh-CN.md` 中记录。                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 响应式          | 已实现               | `reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 已导出，并有单元测试覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 调度器          | 已实现               | `nextTick` 和组件批处理更新已实现，并有 scheduler 测试和集成覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 渲染器          | 已实现               | `src/renderer/**` 已包含 VNode 渲染、DOM patch、Fragment、keyed diff 和 move-path instrumentation。                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 组件            | 已实现               | 函数组件、setup context、props、emit、slots、生命周期、provide/inject 和异步组件均已文档化并测试。                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Store           | 已实现               | `createStore` 组合 reactive state、computed getters 和 named actions，并包含 DevTools action summaries。                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| JSX             | 已实现               | package exports 包含 `jsx-runtime` 和 `jsx-dev-runtime`，并有 JSX 示例和 typecheck 覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| SFC compiler    | alpha 公开契约已收窄 | `.solace` 解析、template codegen、runtime-helper style 注入、`@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics、显式 `map: null` source-map policy、被拒绝的 plugin options 和被拒绝的 `.solace?*` query transforms 已文档化，并有 package-boundary tests 覆盖。                                                                                                                                                                                                                                                                       |
| Router          | beta 下一切片已稳定  | matcher、history adapters、query helpers、nested route chains、redirects、global 和 route-level guards、initial history navigation pipeline、重复 current-route navigation no-op 处理、stale async navigation result protection、rejected-guard history recovery、invalid history location recovery、invalid initial history fallback、`lazyRoute()` components、已暴露的 `lazy-load-failed` 错误、`RouterLink`、nested `RouterView`、root exports、deferred API 边界、package export 覆盖、packed-consumer smoke 和扩展后的 `router-basic` e2e 覆盖均已存在。 |
| SSR/hydration   | minimum loop 已实现  | `renderToString()` 可渲染同步树、拒绝 async/thenable SSR 来源并收集 `useStyle()` 输出，`generateStaticSite()` 会强制显式字符串 route paths 并支持 manifest asset tags，`createApp(App).hydrate(container)` 可附加行为、去重匹配 style tags、报告结构化 hydration mismatch、清理失败的 root hydration effects，并支持显式 `{ recover: true }` deopt。`resolveStaticAssets()` 和 `createStaticRoutesFromRouter()` 已从 `@italone/solace/server` 暴露。                                                                                                           |
| DevTools 子路径 | 已实现并带扩展示例   | `@italone/solace/devtools` 暴露 listener 和 recorder API，`examples/devtools-extension` 通过浏览器 DevTools timeline panel 消费这个公开子路径，且不改变 runtime payload。                                                                                                                                                                                                                                                                                                                                                                                      |
| 示例            | 已实现               | `examples/**` 下包含 basic counter、todo app、large list、performance benchmark、router、SFC 和 DevTools extension 示例。                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 包产物          | 已实现               | Rollup 构建 ESM、CJS 和类型声明；package export tests 和 packed-consumer smoke tests 校验公开入口。                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 文档            | 基本完整             | 已有英文/中文 README、API、package usage、release、performance、architecture、DevTools、contributing 和 security 文档。                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 发布门禁        | 已实现               | 已配置 `release:readiness`、`quality`、`release:check`、package smoke、benchmark 和 e2e scripts；`release:check` 会先运行 release readiness。                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
- benchmark history 质量门禁：`pnpm benchmark:history -- --min-browser-count <count> --min-jsdom-count <count>`
- 浏览器 e2e：`pnpm test:e2e`
- DevTools extension 冒烟：`pnpm test:e2e:devtools-extension`
- 完整本地门禁：`pnpm release:check`，其中包含 `pnpm release:readiness`、`pnpm package:smoke` 和 `pnpm test:e2e`

2026-07-30 的本地 release check 已覆盖 `0.0.5` 的完整门禁，包括 release readiness、quality、coverage、package smoke、jsdom benchmark、Chromium 生产构建 browser benchmark 和 e2e。DevTools extension e2e 冒烟也已单独通过，因为它不包含在 `release:check` 中。

2026-07-31 的 router 稳定化工作在加入 initial history navigation pipeline、stale async
navigation result protection、rejected-guard history recovery、invalid history location recovery、
invalid initial history fallback、lazy route `"lazy-load-failed"` 回归契约，以及重复
current-route navigation no-op 处理后，重新运行了 router-focused checks 和 `pnpm quality`。本轮没有
重新运行 coverage、`pnpm quality` 之外的 package smoke、benchmarks、browser e2e、DevTools
extension e2e 或完整 `release:check`。后续在声明完成、合并或发布前，需要重新运行对应命令。

## 公共 API 边界

支持的公开入口：

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`
- `@italone/solace/server`
- `@italone/solace/sfc`
- `@italone/solace/vite`

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

- 超出当前窄 alpha surface 的稳定 template/SFC compiler 契约。当前 `.solace` compiler 和 Vite plugin 已文档化为支持一个 `<template>`、可选 `<script>`、可选 `<style>`、Vite transform diagnostics 和显式 `map: null` source-map policy；语法扩展继续推迟。
- 完整的一方 router 契约。当前 beta router 覆盖 static routes、dynamic params、wildcard fallback routes、query strings、web/hash history、nested routes、redirects、global 和 route-level guards、initial history navigation pipeline、重复 current-route navigation no-op 处理、stale async navigation result protection、rejected-guard history recovery、invalid history location recovery、invalid initial history fallback、`lazyRoute()` components、已暴露的 `lazy-load-failed` 错误、`RouterLink`、`RouterView` 和 composition helpers，但 route names、aliases、route props、scroll behavior、memory history、SSR/hydration 集成、auth 和 permission routing 仍被推迟。
- streaming SSR、明确运行时拒绝之外的 async component SSR、显式 `{ recover: true }` 之外的
  hydration mismatch 自动恢复、router-aware SSR/SSG/hydration，以及完整 production SSR pipeline
  automation。
- 一方 UI component library。
- 生产级 DevTools 浏览器扩展发布形态、component tree inspector、dependency graph、flame
  chart、持久化 capture workflow、telemetry workflow，或 SSR/SSG/hydration 专用 DevTools
  panels。
- 稳定 plugin 生态。
- 面向内部模块的长期兼容性策略。
- 面向大型应用的生产落地指南。

这些缺口应在推广材料中保持可见，避免外部误解项目定位。

## 发布协调状态

发布独立于仓库就绪度。`@italone/solace@0.0.4` 已发布到 npm。当前仓库 `main`
已准备到 `0.0.5` 并与 `origin/main` 同步，但 2026-07-30 已明确跳过 npm 发布，
且 2026-07-31 当周仍有意暂缓发布；npm 当前最新公开版本仍是
`@italone/solace@0.0.4`。

未来发布 `0.0.5` 或任何后续版本前：

1. 确认本地分支已经 push，或明确接受从本地状态发布。
2. 确认 package version 尚未发布。
3. 运行 `pnpm release:readiness -- --publishable`。该严格模式会在本地分支 ahead、behind、没有 upstream 或工作树不干净时失败。
4. 运行 `pnpm release:check`。
5. 如果继续使用当前已验证可用的临时 npm cache，运行 `npm publish --dry-run --access public --cache /private/tmp/npm-cache`。
6. 只有在 npm authentication、organization access、public access 和 one-time password 都准备好，并且维护者明确确认 npm 发布后，才执行发布。

## 建议后续工作

1. 后续发布前继续保持 release baseline 同步。下一次发布准备前，重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
2. 继续稳定 SFC/Vite contract，但不扩语法：公开面保持为 `@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics 和当前文档化的 alpha `.solace` block model。
3. 继续收敛 router beta API，但不急着扩 still-deferred 功能：route names、aliases、route props、scroll behavior、memory history、SSR/hydration 集成、auth 和 permissions 继续保持 deferred。
4. 对所有公共 API 变更保持公共 API 门禁必跑：`pnpm release:readiness`、`pnpm package:smoke` 和 `pnpm test:e2e`。
5. 在不扩大 runtime payload 的前提下继续 harden 首个 DevTools 扩展面板：当前 timeline UI 继续保留在 `examples/devtools-extension`，更丰富的 inspector views 需要先设计对应 event contracts，SSR/SSG/hydration 专用 panels 继续 deferred。
6. 在作出性能宣称前，继续收集 jsdom 与 browser benchmark history；需要趋势窗口时使用 `--min-browser-count` 和 `--min-jsdom-count`。
