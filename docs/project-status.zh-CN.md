# 项目完成度

[English](./project-status.md)

本文档用于总结 Solace 作为开源前端框架的当前完成度。这里会区分已实现运行时能力、验证覆盖、文档就绪度、已知缺口和发布协调状态。

## 总览

Solace 当前已经进入 `0.1.0` beta 线，仓库 package 版本是 `0.1.0-beta.2`。npm
`latest` 仍是稳定 `@italone/solace@0.0.5` 线，npm `beta` 是 beta 安装线。它已经具备可运行的公共
API、包导出、示例、测试、benchmark 和发布检查。它的主要编写路径是 JSX/TSX-first 函数组件，并由明确的运行时 API 支撑。Solace 适合作为一个小型、可阅读、可实验的前端框架进行推广，但不应被描述为
React、Vue、Svelte 或同类生态的成熟生产替代品。

当前本地仓库状态：

- 包名：`@italone/solace`
- 仓库 package 版本：`0.1.0-beta.2`
- npm `latest` 已发布版本：`0.0.5`
- npm `beta` 已发布版本：`0.1.0-beta.1`
- npm dist-tags：`latest` 指向 `0.0.5`；`beta` 指向 `0.1.0-beta.1`
- 公开包元数据：已启用，`"private": false`
- 当前分支：`main`
- 本地分支状态：后续发布、同步或声明远端状态前，需重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
- 发布阶段：已发布 beta 线；初始运行时范围已完成，Router 的稳定切片已落地，但整体仍不是完整生产契约；SSR/hydration minimum loop，以及首个浏览器
  DevTools 扩展 timeline panel 已在仓库中实现

## 完成度映射

| 领域            | 状态                | 依据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API         | 已实现              | `createApp`、`mount`、`use` 和 app-level `provide` 已从包根入口导出，并在 `docs/api.zh-CN.md` 中记录。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 响应式          | 已实现              | `reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 已导出，并有单元测试覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 调度器          | 已实现              | `nextTick` 和组件批处理更新已实现，并有 scheduler 测试和集成覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 渲染器          | 已实现              | `src/renderer/**` 已包含 VNode 渲染、DOM patch、Fragment、keyed diff 和 move-path instrumentation。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 组件            | 已实现              | 函数组件、setup context、props、emit、slots、生命周期、provide/inject 和异步组件均已文档化并测试。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Store           | 已实现              | `createStore` 组合 reactive state、computed getters 和 named actions，并包含 DevTools action summaries。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| JSX/TSX         | 主要编写路径        | package exports 包含 `jsx-runtime` 和 `jsx-dev-runtime`，并有 JSX 示例和 typecheck 覆盖。函数组件和 TSX 是主要公开组件编写模型。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| SFC compiler    | 可选实验性表面      | `.solace` 解析、template codegen、runtime-helper style 注入、`@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics、显式 `map: null` source-map policy、被拒绝的 plugin options 和被拒绝的 `.solace?*` query transforms 已文档化，并有 package-boundary tests 覆盖。SFC 路径是辅助能力，不是 Solace 的主要框架身份。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Router          | beta 稳定切片已完成 | matcher、带有基于 location listener 去重的 history adapters、query helpers、nested route chains、parent-to-child redirects、global 和 route-level guards、initial history navigation pipeline、重复 current-route navigation、redirect-to-current 和当前 history-listener guard skip/no-op 处理、stale async navigation result protection、rejected-guard history recovery、invalid history location recovery、invalid initial history fallback、创建期 options/history adapter 和 route record/component validation、global `beforeEach()` 注册校验、route `redirect-rejected` 错误、`lazyRoute()` components、已暴露的 `lazy-load-failed` 错误、route names、aliases、route props、named locations、`createMemoryHistory()`、history-aware `RouterLink` href 覆盖、浏览器接管的 `RouterLink` targets/downloads、nested `RouterView`、root exports、deferred API 边界、package export 覆盖、packed-consumer smoke 和扩展后的 `router-basic` e2e 覆盖均已存在。 |
| SSR/hydration   | minimum loop 已实现 | `renderToString()` 可渲染同步树、拒绝 async/thenable SSR 来源并收集 `useStyle()` 输出，`generateStaticSite()` 会强制显式字符串 route paths 并支持 manifest asset tags，`createApp(App).hydrate(container)` 可附加行为、去重匹配 style tags、报告结构化 hydration mismatch、清理失败的 root hydration effects，并支持显式 `{ recover: true }` deopt。`resolveStaticAssets()` 和 `createStaticRoutesFromRouter()` 已从 `@italone/solace/server` 暴露。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| DevTools 子路径 | 已实现并带扩展示例  | `@italone/solace/devtools` 暴露 listener 和 recorder API，`examples/devtools-extension` 通过浏览器 DevTools timeline panel 消费这个公开子路径，且不改变 runtime payload。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 示例            | 已实现              | `examples/**` 下包含 basic counter、todo app、large list、performance benchmark、router、SFC 和 DevTools extension 示例。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 包产物          | 已实现              | Rollup 构建 ESM、CJS 和类型声明；package export tests 和 packed-consumer smoke tests 校验公开入口。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 文档            | 基本完整            | 已有英文/中文 README、API、package usage、release、performance、architecture、DevTools、contributing 和 security 文档。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 发布门禁        | 已实现              | 已配置 `release:readiness`、`quality`、`release:check`、package smoke、benchmark 和 e2e scripts；`release:check` 会先运行 release readiness。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 优点与取舍

主要优点：

- 核心运行时闭环完整。App、响应式、渲染、函数组件、store、JSX/TSX、SSR/hydration minimum loop、SSG core、DevTools public subpath 和示例级浏览器扩展已经形成可运行闭环。
- 主要编写叙事清晰。Solace 以 JSX/TSX-first 函数组件和明确运行时 API 为主，而不是继续向 Vue 风格 SFC 框架靠拢。
- 公共入口边界清晰。`package.json` exports、API 文档、package smoke 和 deep subpath blocking 测试共同约束了对外契约。
- 验证门禁相对扎实。格式、typecheck、lint、单元/集成测试、package smoke、coverage、jsdom benchmark、Chromium browser benchmark 和 browser e2e 都已有脚本覆盖。
- 项目定位诚实。文档明确区分已发布 beta 线、npm `latest` 和 `beta` dist-tags、文档化公共入口、内部实现细节和仍 deferred 的生产级能力。
- 代码规模适合学习和审阅。相比完整生态框架，Solace 更适合用来研究响应式、VNode patch、组件模型、router guard pipeline、SSR/SSG 和 DevTools event contract 的实现方式。

主要缺点和风险：

SFC 仍是可选、窄、实验性的编译器表面，而不是主要框架方向；Router 的 names、aliases、props 和 memory history 已经进入稳定切片，但 scroll behavior、auth、permissions 和 SSR/hydration integration 仍是显式的 beta 范围边界；SSR/hydration 目前仍只是 minimum loop，不是完整生产契约。
项目今天已经可用且文档齐全，但这些子系统仍然有意保持在冻结生产契约之前的范围内。

- 生态能力仍薄。没有一方 UI component library、稳定 plugin ecosystem、生产级 DevTools 发布形态或大型应用落地指南。
- SFC/Vite 仍是可选实验性编译器表面。当前 compiler 契约只覆盖 `@italone/solace/vite`、`@italone/solace/sfc` 类型入口、文档化 block model、Vite transform diagnostics 和显式 `map: null`；不能假设语法或生成代码形状稳定，SFC 扩展也不是近期框架主方向。
- Router 仍处 beta，但稳定切片已经成形。当前 slice 已覆盖基础 SPA 工作流和多个 guard/history 边界，route names、aliases、route props、named locations、`createMemoryHistory()` 已经纳入公开稳定契约；scroll behavior、auth、permissions 和 SSR/hydration integration 仍未纳入。
- SSR/hydration 仍是 minimum loop。已有同步 SSR、manifest asset tags 和显式 hydration recovery，但还没有 streaming SSR、async component SSR、router-aware hydration 或完整 production pipeline automation。
- 内部模块不稳定。兼容性承诺只覆盖文档化公开入口，`src/**`、`dist/**` 和内部 diagnostics/instrumentation 不适合外部依赖。

因此，Solace 当前适合学习、实验、小型 demo、框架机制验证和受控内部原型；不适合直接作为大型生产应用的基础框架，也不适合依赖内部模块或未文档化 deep subpaths。

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

2026-08-03 的 router 稳定化工作在加入 initial history navigation pipeline、stale async
navigation result protection、rejected-guard history recovery、invalid history location recovery、
invalid initial history fallback、location-based browser/hash history listener 去重、创建期 options/history adapter 和 route record/component validation、global `beforeEach()` 注册校验、route redirect `"redirect-rejected"` 错误（覆盖抛出异常和无效 redirect result）、history-aware `RouterLink` href 覆盖、浏览器接管的 `RouterLink` target/download 处理、lazy route `"lazy-load-failed"` 回归契约（包括共享 lazy component
在导航后失败时使用 active route 的错误位置）、parent-to-child redirect 先于 child guards 的优先级、
重复 current-route navigation guard-skip/no-op 处理、redirect-to-current guard-skip/no-op 处理，以及当前
history-listener guard-skip/no-op 处理后，重新运行了 router-focused checks 和 `pnpm quality`。本轮没有重新运行 coverage、`pnpm quality` 之外的 package smoke、
benchmarks、browser e2e、DevTools extension e2e 或完整 `release:check`。后续在声明完成、合并或发布前，需要重新运行对应命令。

2026-08-03 发布 `@italone/solace@0.0.5` 到 npm 前，已重新运行完整发布门禁：
`pnpm release:check` 通过，覆盖 release readiness、quality、coverage、packed package smoke、
jsdom benchmark、Chromium browser benchmark 和 browser e2e。`pnpm release:readiness -- --publishable`
也已通过，`npm pack --dry-run --json` 已确认发布 tarball；发布后 registry smoke 从 npm 安装
`@italone/solace@0.0.5`，并验证了 package root、公开子路径和私有子路径阻断。

2026-08-05 发布 `@italone/solace@0.1.0-beta.0` 到 npm beta 线时，使用了
`pnpm release:publish:beta`，该命令会在 `changeset publish --tag beta` 前重新运行
`pnpm release:check`。发布后 registry 检查确认 npm registry 返回 `latest -> 0.0.5`
和 `beta -> 0.1.0-beta.0`，匹配的 Git tag `v0.1.0-beta.0` 已 push。

2026-08-05 发布文档刷新版 `@italone/solace@0.1.0-beta.1` 到 npm beta 线时，同样使用了
`pnpm release:publish:beta`，并在 `changeset publish --tag beta` 前重新运行 `pnpm release:check`。
发布后 registry 检查确认 npm registry 返回 `latest -> 0.0.5` 和 `beta -> 0.1.0-beta.1`。
registry beta smoke 从 `@italone/solace@beta` 导入 root、server、Vite 和 DevTools 公开入口；
已发布 beta.1 tarball 的 README/docs 也已检查，确认包含更新后的 beta 安装线文案。

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

兼容性承诺只适用于文档化公开入口。框架稳定前，内部模块仍然只是实现细节，可能发生变化。

## 已知缺口

Solace 当前有意不包含：

- 超出当前可选实验性表面的稳定 template/SFC compiler 契约。当前 `.solace` compiler 和 Vite plugin 已文档化为支持一个 `<template>`、可选 `<script>`、可选 `<style>`、Vite transform diagnostics 和显式 `map: null` source-map policy；语法扩展继续推迟，且不是 JSX/TSX-first 框架方向的必要前提。
- 完整的一方 router 契约。当前 beta router 覆盖 static routes、dynamic params、wildcard fallback routes、query strings、web/hash history、nested routes、parent-to-child redirects、global 和 route-level guards、initial history navigation pipeline、重复 current-route navigation、redirect-to-current 和当前 history-listener guard skip/no-op 处理、stale async navigation result protection、rejected-guard history recovery、invalid history location recovery、invalid initial history fallback、创建期 options/history adapter 和 route record/component validation、global `beforeEach()` 注册校验、route `redirect-rejected` 错误、`lazyRoute()` components、已暴露的 `lazy-load-failed` 错误、浏览器接管的 `RouterLink` targets/downloads、`RouterView` 和 composition helpers；route names、aliases、route props、named locations、`createMemoryHistory()`、history-aware `RouterLink` href 覆盖以及 alias/canonical matching 已进入稳定切片，但 scroll behavior、SSR/hydration 集成、auth 和 permissions 仍被推迟。
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

这些缺口应在推广材料中保持可见，避免外部误解项目作为 beta 线运行时的定位。

## 发布协调状态

发布独立于仓库就绪度。`@italone/solace@0.0.5` 已发布到 npm，并且 `latest`
dist-tag 指向 `0.0.5`。`@italone/solace@0.1.0-beta.1` 已发布到 npm，并且
`beta` dist-tag 指向 `0.1.0-beta.1`。仓库已准备 `0.1.0-beta.2`，但该版本要等 beta 发布流程
完成后才算已发布。beta.1 发布后 registry 检查确认 npm registry 返回 `latest -> 0.0.5` 和
`beta -> 0.1.0-beta.1`，匹配的 Git tag 是 `v0.1.0-beta.1`。后续任何发布或同步声明前都应重新
核对 Git 状态和 npm registry。

未来发布任何后续版本前：

1. 确认本地分支已经 push，或明确接受从本地状态发布。
2. 确认 package version 尚未发布。
3. 运行 `pnpm release:readiness -- --publishable`。该严格模式会在本地分支 ahead、behind、没有 upstream 或工作树不干净时失败。
4. 运行 `pnpm release:check`。
5. 运行 `npm pack --dry-run --json` 或 `npm publish --dry-run --access public` 检查 tarball。
6. 只有在 npm authentication、organization access、public access 和 one-time password 都准备好，并且维护者明确确认 npm 发布后，才执行发布。

## 建议后续工作

1. 后续发布前继续保持 release baseline 同步。下一次发布准备前，重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
2. 优先沉淀 JSX/TSX-first runtime ergonomics 和示例：把函数组件、JSX/TSX 编写路径、明确运行时 API 和 package-boundary 示例作为 Solace 的主要身份。React 风格指的是熟悉的 TSX 函数组件和事件驱动 UI 组合，不是 React 兼容层，也不是整套照抄 React API。后续 API 工作应有意识地 harden Solace 自己的 JSX 类型、组件事件类型、slot ergonomics 和 runtime primitive 命名。
3. 维护可选实验性 SFC/Vite contract，但不扩语法：公开面保持为 `@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics、显式 `map: null` 和当前文档化的 `.solace` block model。
4. 继续收敛 router beta API，但不急着扩 still-deferred 功能：scroll behavior、SSR/hydration 集成、auth 和 permissions 继续保持 deferred。
5. 对所有公共 API 变更保持公共 API 门禁必跑：`pnpm release:readiness`、`pnpm package:smoke` 和 `pnpm test:e2e`。
6. 在不扩大 runtime payload 的前提下继续 harden 首个 DevTools 扩展面板：当前 timeline UI 继续保留在 `examples/devtools-extension`，更丰富的 inspector views 需要先设计对应 event contracts，SSR/SSG/hydration 专用 panels 继续 deferred。
7. 在作出性能宣称前，继续收集 jsdom 与 browser benchmark history；需要趋势窗口时使用 `--min-browser-count` 和 `--min-jsdom-count`。
