# 项目完成度

[English](./project-status.md)

本文档用于总结 Solace 作为开源前端框架的当前完成度。这里会区分已实现运行时能力、验证覆盖、文档就绪度、已知缺口和发布协调状态。

## 总览

Solace 当前已经进入 `0.1.0` beta 线；当前工作区准备本地 `0.1.0-beta.6` candidate，但尚未发布。npm
`latest` 仍是稳定 `@italone/solace@0.0.5` 线，npm `beta` 已发布版本是
`0.1.0-beta.5`。它已经具备可运行的公共
API、包导出、示例、测试、benchmark 和发布检查。它的主要编写路径是 JSX/TSX-first 函数组件，并由明确的运行时 API 支撑。Solace 适合作为一个小型、可阅读、可实验的前端框架进行推广，但不应被描述为
React、Vue、Svelte 或同类生态的成熟生产替代品。

当前本地仓库状态：

- 包名：`@italone/solace`
- 仓库 package 版本：本地 `0.1.0-beta.6` candidate
- npm `latest` 已发布版本：`0.0.5`
- npm `beta` 已发布版本：`0.1.0-beta.5`
- npm dist-tags：`latest` 指向 `0.0.5`；`beta` 指向 `0.1.0-beta.5`
- 公开包元数据：已启用，`"private": false`
- 当前分支：`main`
- 本地分支状态：后续发布、同步或声明远端状态前，需重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
- 发布阶段：beta.5 契约与 adoption release 已发布；初始运行时范围已完成，Router 的稳定切片已落地，但整体仍不是完整生产契约；SSR/hydration minimum loop，以及首个浏览器
  DevTools 扩展 timeline panel 已在仓库中实现

## 完成度映射

| 领域            | 状态                                         | 依据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API         | 已实现                                       | `createApp`、`mount`、`use` 和 app-level `provide` 已从包根入口导出，并在 `docs/api.zh-CN.md` 中记录。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 响应式          | 已实现                                       | `reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 已导出，并有单元测试覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 调度器          | 已实现                                       | `nextTick` 和组件批处理更新已实现，并有 scheduler 测试和集成覆盖。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 渲染器          | 已实现                                       | `src/renderer/**` 已包含 VNode 渲染、DOM patch、Fragment、keyed diff 和 move-path instrumentation。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 组件            | 已实现                                       | 函数组件、setup context、props、emit、slots、生命周期、provide/inject 和异步组件均已文档化并测试。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Store           | 已实现                                       | `createStore` 组合 reactive state、computed getters 和 named actions，并包含 DevTools action summaries。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| JSX/TSX         | 主要编写路径                                 | package exports 包含 `jsx-runtime` 和 `jsx-dev-runtime`，并有 JSX 示例和 typecheck 覆盖。函数组件和 TSX 是主要公开组件编写模型。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| SFC compiler    | 可选实验性表面                               | `.solace` 解析、template codegen、runtime-helper style 注入、`@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics、显式 `map: null` source-map policy、被拒绝的 plugin options 和被拒绝的 `.solace?*` query transforms 已文档化，并有 package-boundary tests 覆盖。SFC 路径是辅助能力，不是 Solace 的主要框架身份。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Router          | beta 稳定切片已完成                          | matcher、history adapters、query helpers、nested route chains、redirects、global/route guards、single-flight `isReady()` initial settlement、stale navigation protection、结构化 errors、lazy routes、names、aliases、props、named locations、`createMemoryHistory()`、`scrollBehavior`、canonical route snapshots、history-aware `RouterLink`、nested `RouterView`、root exports、package export、packed consumer 和扩展浏览器覆盖均已存在。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| SSR/hydration   | buffered async、顺序与乱序流式加 router 组合 | `renderToStringAsync()` 会把完整 async initial tree 解析为 buffered HTML/styles；`hydrateAsync()` 会在触碰 server DOM 前完成准备，并支持显式 DOM mismatch recovery。现有同步 API 保留同步返回类型并拒绝未解析 async values。`renderToStream()` 已实现顺序流式（sequential）streaming SSR（beta）：字节顺序与 `renderToStringAsync().html` 一致，async component 解析前先刷新已完成前缀，样式在首次注册处内联发射；渲染 eager 启动且不处理消费者 backpressure。`renderToStream(source, { mode: "out-of-order" })` 增加乱序（out-of-order）streaming SSR（beta）：async 边界发射 `<!--so:b:N-->` fallback 标记，内联替换脚本按解析顺序在文档之后 flush，loader 失败时保留 fallback 且不拒绝流，客户端 hydration 前 DOM 已是最终状态。`createRouterServerContext()` 增加 request-scoped memory-router settlement、canonical snapshot serialization 和 verify-before-hydrate 组合。直接 `router` option 拒绝保持不变；renderer-owned router integration 仍 deferred。 |
| DevTools 子路径 | 已实现并带扩展示例                           | `@italone/solace/devtools` 暴露 listener 和 recorder API，`examples/devtools-extension` 通过浏览器 DevTools timeline panel 消费这个公开子路径；panel 现在包含基于 `parentId` 扩展的 component mount/update/unmount 事件摘要构建的 Components 组件树标签页，且不改变 runtime payload 策略。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 示例            | 已实现                                       | `examples/**` 下包含 basic counter、todo app、large list、performance benchmark、router、SFC 和 DevTools extension 示例。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 包产物          | 已实现                                       | Rollup 构建 ESM、CJS 和类型声明；package export tests 和 packed-consumer smoke tests 校验公开入口。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 文档            | 基本完整                                     | 已有英文/中文 README、API、package usage、release、performance、architecture、DevTools、大型应用指南、`docs/ecosystem.md` 生态方向、contributing 和 security 文档。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 发布门禁        | 已实现，但 candidate 仍受 evidence 阻断      | 已配置 `release:readiness`、`quality`、`release:check`、public contract、performance regression、package smoke、benchmark 和 e2e scripts；stable publish 还要求 1.0 evidence checklist。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 优点与取舍

主要优点：

- 核心运行时闭环完整。App、响应式、渲染、函数组件、store、JSX/TSX、buffered async initial
  SSR/hydration、sequential async SSG、DevTools public subpath 和示例级浏览器扩展已经形成可运行闭环。
- 主要编写叙事清晰。Solace 以 JSX/TSX-first 函数组件和明确运行时 API 为主，而不是继续向 Vue 风格 SFC 框架靠拢。
- 公共入口边界清晰。`package.json` exports、API 文档、package smoke 和 deep subpath blocking 测试共同约束了对外契约。
- SSR、hydration 和 SSG option objects 会通过包含字段名的 `TypeError` 拒绝未知自有字段，
  不会静默接受拼写错误的配置。
- 验证门禁相对扎实。格式、typecheck、lint、单元/集成测试、package smoke、coverage、jsdom benchmark、Chromium browser benchmark 和 browser e2e 都已有脚本覆盖。
- 项目定位诚实。文档明确区分已发布 beta 线、npm `latest` 和 `beta` dist-tags、文档化公共入口、内部实现细节和仍 deferred 的生产级能力。
- 代码规模适合学习和审阅。相比完整生态框架，Solace 更适合用来研究响应式、VNode patch、组件模型、router guard pipeline、SSR/SSG 和 DevTools event contract 的实现方式。

主要缺点和风险：

SFC 仍是可选、窄、实验性的编译器表面，而不是主要框架方向；Router 的 names、aliases、props、
memory history、scroll behavior、readiness、canonical snapshots 和 request-scoped SSR context
已经进入稳定切片，但 auth、permissions 和 renderer-owned 直接 router integration 仍是显式的
beta 范围边界；SSR/hydration 已覆盖 buffered async initial rendering，
但仍不是完整生产契约。
项目今天已经可用且文档齐全，但这些子系统仍然有意保持在冻结生产契约之前的范围内。

- 生态能力仍薄。没有一方 UI component library、稳定 plugin ecosystem、生产级 DevTools 发布形态；大型应用指南仍只是早期落地指导，还不是经过大量实战沉淀的生态层，`docs/ecosystem.md` 已把 beta 线 UI library 和 plugin 决策显式化。仓库内 DevTools 扩展示例现在只允许本地 6174 demo origins；生产 distribution 仍需明确审查 inspected origins。
- SFC/Vite 仍是可选实验性编译器表面。当前 compiler 契约只覆盖 `@italone/solace/vite`、`@italone/solace/sfc` 类型入口、文档化 block model、Vite transform diagnostics 和显式 `map: null`；不能假设语法或生成代码形状稳定，SFC 扩展也不是近期框架主方向。
- Router 仍处 beta，但稳定切片已经成形。当前 slice 已覆盖基础 SPA 工作流、`isReady()`、canonical snapshots 和 request-scoped server context；auth 和 permissions 仍未纳入，router options 与 route record fields 会被明确拒绝，避免把 route `meta` 误认为 enforcement；直接 renderer-owned SSR/hydration option 仍被推迟。
- SSR/hydration 已覆盖 buffered async initial rendering 和顺序/乱序流式切片。`renderToStringAsync()`、
  `generateStaticSiteAsync()` 和 `hydrateAsync()` 已覆盖 async initial trees；`renderToStream()`
  以相同字节顺序顺序流式输出，样式在首次注册处内联、eager 启动、不处理消费者 backpressure；`renderToStream(source, { mode: "out-of-order" })` 以解析顺序的内联替换脚本流式输出 async 边界，配合 `defineAsyncComponent({ loader, fallback })` fallback 和不拒绝流的失败语义。Suspense/selective hydration 切片现已作为 beta 能力实现：内置 `Suspense` 组件在 CSR 与两种 streaming 模式下用一个 fallback 协调 async 子树（乱序模式下每棵 Suspense 子树一个 `so:b` 边界），`hydrateAsync(container, { selective: true })` 立即水合就绪部分、在 loader 解析后 patch 边界内容、落定后回放缓冲的交互，loader 失败时保留 fallback 且不 reject。尽管如此，
  renderer-owned 直接 router integration、async suspension 后的 ambient instance
  APIs、initial hydration 后的 async update scheduling 和完整 production pipeline automation 仍保持
  deferred。
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
- Operations Console packed candidate smoke：`pnpm stable:app`
- jsdom benchmark smoke：`pnpm benchmark`
- Chromium 生产构建浏览器 benchmark：`pnpm benchmark:browser`
- CI 同 runner 跨提交对比：`pnpm performance:compare:ci`
- benchmark history 质量门禁：`pnpm benchmark:history -- --min-browser-count <count> --min-jsdom-count <count>`
- checked-in benchmark readiness evidence：`pnpm benchmark:history:evidence -- --output release/performance-history.json`
- 浏览器 e2e：`pnpm test:e2e`
- DevTools extension 冒烟：`pnpm test:e2e:devtools-extension`
- 完整本地门禁：`pnpm release:check`，其中包含 `pnpm release:readiness`、
  `pnpm package:smoke`、`pnpm stable:app`、`pnpm test:e2e` 和
  `pnpm test:e2e:devtools-extension`

2026-07-30 的本地 release check 覆盖了当时 `0.0.5` 的完整门禁，包括 release readiness、quality、coverage、package smoke、jsdom benchmark、Chromium 生产构建 browser benchmark 和 browser e2e。DevTools extension e2e 后续已加入当前 `release:check` 门禁；后续发布声明前需重新运行完整门禁。

2026-08-12 的完整本地 `pnpm release:check` 已通过，覆盖 beta.4 发布状态，共记录 71 个 Vitest
文件 / 626 个测试，以及最新覆盖率：94.28% statements / 89.18% branches / 96.28% functions /
94.32% lines。Operations Console packed candidate 和 pinned baseline upgrade smoke 均已通过；常规 browser inventory 和执行覆盖
Chromium、Firefox、WebKit 共 24 个 browser e2e 测试，独立 DevTools extension inventory 和门禁
包含 2 个仅 Chromium 的 DevTools extension e2e 测试。另行要求的 pinned upgrade smoke 安装了
精确 npm baseline `@italone/solace@0.1.0-beta.2`，并通过 Operations Console 与本地 packed
beta.4 candidate 的对比。受保护的发布命令在发布前重新运行了这套完整门禁。

2026-08-14 beta.5 契约、adoption 和 performance evidence 工作完成后，完整本地
`pnpm release:check` 已通过，记录 81 个 Vitest 文件 / 702 个测试，覆盖率为 92.97%
statements / 88.11% branches / 95.21% functions / 93.25% lines；另有 16 个 package tests、Chromium/Firefox/WebKit 共 24 个 browser
e2e tests，以及 2 个仅 Chromium 的 DevTools extension e2e tests。packed package smoke、package-only
CSR 加 SSR/hydration adoption smoke、Operations Console smoke、jsdom benchmark 和 Chromium 生产
browser benchmark 也已通过；本地 beta.5 tarball 的可选 Chromium/Firefox/WebKit adoption runner 已通过。
2026-08-18 的严格 evaluator 已将结果明确命名为 `Solace 1.0 evidence checklist`，证据源仍是
`release/adoption-evidence.md`，当前报告
`INCOMPLETE`。两个外部 React/Vite 应用只证明 package compatibility，不是以 Solace 为主要渲染层
的生产采用证据。真实回滚演练、可分发 DevTools 证据、stable contract admission，以及每个 browser
scenario 五个不同日期的历史也仍缺失。即使未来显示 `READY`，也只表示证据清单满足，不等于 1.0
发布结论。

2026-08-17 的公共 component 回归矩阵还覆盖 required typed slots、typed events 和 generic
components 在 automatic JSX runtime、直接 `h()` 与 JSX runtime calls、`createApp`、Router records、
server rendering sources 和 packed consumer 上的可赋值性。runtime containers 使用内部 metadata-erased
component transport，JSX/TSX 与 `h()` authoring boundaries 仍保持严格。
`tests/integration/router-ssr-hydration.test.ts` 新增 stale navigation、guard rejection、snapshot
mismatch、lazy route failure 和 async hydration 后响应式更新的组合覆盖，且没有增加 Router 或 SSR API。

2026-08-18 的本地 beta.6 candidate 在接入结构化 1.0 evidence 后，重新通过完整
`pnpm release:check`：86 个 Vitest 文件 / 742 个测试、16 个 package tests，coverage 为 92.34%
statements / 87.24% branches / 95.54% functions / 92.73% lines。packed package、adoption 和
Operations Console smokes 均通过；jsdom 与 Chromium 生产 benchmark 通过；普通 browser e2e 在
Chromium、Firefox、WebKit 上 24/24 通过；DevTools extension e2e 4/4 通过。beta regression
要求至少 5 次运行且覆盖至少 2 个不同日期。

`release/adoption-evidence.json` 现在把每个声明的应用与 package version、renderer、workflow、
upgrade 和 rollback 记录绑定，`release/adoption-evidence.md` 继续保留为人工审阅日志。两个外部
React/Vite 应用仍只是 compatibility-only，不计入独立的 Solace-primary adoption。同样，
`release/devtools-distribution-evidence.json` 将本地 extension 记录绑定到已检查的 manifest
permissions，但明确没有生产分发或已测试的生产 origins。因此，`pnpm release:one-zero:check` 仍为
`INCOMPLETE`：缺少独立采用、每个 keyed browser scenario 五个不同日期、可分发 DevTools 证据和
stable contract admission。该记录写入时本地 Git 超前 `origin/main`；两个 DevTools 打包门禁 docs
提交已于 2026-08-20 推送，`origin/main` 现已同步，该发布阻塞已解除，但证据类阻塞仍然存在。

CI 跨提交性能门禁现已通过 `pnpm performance:compare:ci` 配置完成。它会在同一 runner 上比较
base 与 candidate 的最小值（best-of-three samples）。改用最小值是因为毫秒级短指标的 median 会因
调度器与 GC 抖动在源码完全相同的提交对上误报。门禁使用 1.2 最大 ratio，外加 3ms 的
`absoluteDeltaFloorMs` 下限保护微型指标的亚下限绝对差，同时会在诊断
artifacts 中保留 commit 与 environment fingerprint。它不计入 1.0 所需的五个不同日期证据。该门禁
不会更新 `release/performance-history.json`，也不会改变当前 `INCOMPLETE` 的准入结果。

2026-08-19 的验证首先暴露出一个覆盖率回归：release scripts 的配置被内联进 CLI 入口后，门禁跌破
阈值。将可复用配置重新拆为可测试的纯模块，并保持 CLI 文件轻薄后，覆盖率门禁恢复；同一轮清理还
消除了 renderer 的 `diff.ts -> children.ts -> diff.ts` 循环依赖。随后重新执行的完整
`pnpm release:check` 通过了 91 个 Vitest 文件 / 814 个测试、16 个 package tests，coverage 为
90.40% statements / 86.33% branches / 93.23% functions / 90.94% lines。package 和 adoption smoke、
packed Operations Console 检查、jsdom 与 Chromium benchmark、24 个 browser E2E 测试以及 4 个
DevTools extension E2E 测试也全部通过。这些结果验证了 beta.6 candidate 的现有门禁，但没有补齐
1.0 所缺少的 adoption、五个独立日期 history、DevTools distribution 或 stable admission 证据。

2026-08-20 的基线刷新将两个待推送的 DevTools 打包门禁 docs 提交推送到 `origin/main`（本地与远端
同步），并在同步后的工作树上重新执行了完整 `pnpm release:check`。门禁通过：91 个 Vitest 文件 /
816 个测试、16 个 package tests，coverage 为 90.10% statements / 86.22% branches / 93.12%
functions / 90.66% lines，package 与 adoption smoke、packed Operations Console 检查、jsdom 与
Chromium benchmark（性能回归 PASS）、24 个 browser E2E 测试以及 4 个 DevTools extension E2E
测试也全部通过。没有改动运行时代码；1.0 证据阻塞（独立 adoption、五个日期 history、DevTools
distribution、stable admission）保持不变。

同一轮 2026-08-19 加固还把 packed adoption consumer 纳入了日常检查：常规 Node 20/22 CI 现在会执行
`pnpm adoption:smoke`。独立的定时 `.github/workflows/performance-history.yml` 会恢复最近一次成功的
history cache，并按 UTC 日期追加 jsdom 与 Chromium 采集；它仍需等待未来日期的成功运行，目前六个
keyed-reorder browser scenarios 的 checked-in evidence 仍不足五天。DevTools 现在提供
`pnpm package:devtools-extension`，可针对显式、精确的 HTTPS origins 生成确定性 ZIP，校验生成后的
最小权限 manifest 并输出 SHA-256。该命令只用非生产示例 origin 做过验证，尚未验证真实生产 origin。
两个外部应用仍是 React-primary compatibility checks，没有完成 Solace-primary 升级与回滚演练，
因此仍不能计入独立 adoption。加固后的 evaluator 现在要求精确 npm 升级与回滚版本、相互匹配的
evidence records 与 paths，以及已验证的回滚演练；performance evidence 会输出排序去重后的
`runAt[]`，拒绝未来时间或超过 30 天的记录，并重新计算运行次数和 UTC 日期数；DevTools evidence
则把 ZIP 与 manifest SHA-256、精确 HTTPS origins 和 QA 结果绑定到同一个 artifact digest。这些
检查用于阻止证据不足的声明，并不会生成当前缺少的三类生产证据。

独立 adopter 现在可以通过 `pnpm adoption:evidence` 绑定已经审阅的 baseline、candidate 和 rollback
记录。loader 会重建每个声明的 bundle 并验证其 SHA-256；1.0 evaluator 还会独立比对精确版本、应用
身份、repository、production origin、workflows、reviewer approval 和 rollback restoration。当前没有
任何应用声明真实 production bundle，因此独立采用仍为 0/2。

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

2026-08-11 发布 `@italone/solace@0.1.0-beta.2` 到 npm beta 线时，使用了
`pnpm release:publish:beta`，并在 `changeset publish --tag beta` 前重新运行 `pnpm release:check`。
发布后 registry 检查确认 npm registry 返回 `latest -> 0.0.5` 和 `beta -> 0.1.0-beta.2`。
registry beta smoke 导入了 root、server、Vite 和 DevTools 公开入口，并验证了服务端渲染输出；
已发布 beta.2 tarball 包含 48 个文件。本地和远端均已存在 `v0.1.0-beta.2` tag，并指向 beta.2
release commit。

2026-08-12 发布 `@italone/solace@0.1.0-beta.4` 到 npm beta 线时，使用了
`pnpm release:publish:beta`，并在 `changeset publish --tag beta` 前重新运行完整发布门禁。
registry 检查确认 `latest -> 0.0.5` 和 `beta -> 0.1.0-beta.4`。registry smoke 导入八个受保护的
公开入口，验证服务端输出 `<p>beta.4 registry smoke</p>`，并确认私有深路径
`@italone/solace/dist/index.js` 仍被阻断。已发布 tarball 包含 50 个文件且不可变，其中的
README/status 仍保留发布前候选措辞。本地和远端 annotated tag `v0.1.0-beta.4` 均已存在，远端
peeled ref 解引用到发布提交 `fbe6984`。

2026-08-14 发布 `@italone/solace@0.1.0-beta.5` 到 npm beta 线时，使用了
`pnpm release:publish:beta`，并在 `changeset publish --tag beta` 前重新运行完整发布门禁。门禁通过
81 个 Vitest 文件 / 702 个测试、16 个 package tests、Chromium/Firefox/WebKit 共 24 个 browser
e2e tests 和 2 个 DevTools extension e2e tests，覆盖率为 92.97% statements / 88.11% branches /
95.21% functions / 93.25% lines。registry 检查确认 `latest -> 0.0.5` 和
`beta -> 0.1.0-beta.5`；registry smoke 导入八个受保护的公开入口，验证 server entry 渲染，并确认
私有 deep path 仍被阻断。本地 `v0.1.0-beta.5` tag 指向发布提交 `afe459e`。由于发布后审计期间
无法连接 GitHub，远端 `v0.1.0-beta.5` tag 仍待复核。

## 公共 API 边界

支持的公开入口：

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`
- `@italone/solace/server`
- `@italone/solace/sfc`
- `@italone/solace/vite`
- `@italone/solace/package.json`

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
- 完整的一方 router 契约。当前 beta router 覆盖 static routes、dynamic params、wildcard fallback routes、query strings、web/hash history、nested routes、parent-to-child redirects、global 和 route-level guards、initial history navigation pipeline、重复 current-route navigation、redirect-to-current 和当前 history-listener guard skip/no-op 处理、stale async navigation result protection、rejected-guard history recovery、invalid history location recovery、invalid initial history fallback、创建期 options/history adapter 和 route record/component validation、global `beforeEach()` 注册校验、route `redirect-rejected` 错误、`lazyRoute()` components、已暴露的 `lazy-load-failed` 错误、浏览器接管的 `RouterLink` targets/downloads、`RouterView` 和 composition helpers；route names、aliases、route props、named locations、`createMemoryHistory()`、history-aware `RouterLink` href 覆盖、alias/canonical matching 以及 scroll behavior 已进入稳定切片。显式 readiness、server context 与 snapshot verification 组合已经支持，但 renderer-owned 直接 SSR/hydration 集成、auth 和 permissions 仍被推迟。
- 显式 `{ recover: true }`
  之外的 hydration mismatch 自动恢复、router-aware
  workflow 之外的 renderer-owned 直接 SSR/SSG/hydration router options、async suspension 后的 ambient instance APIs、initial hydration 后的 async update
  scheduling，以及完整 production SSR pipeline automation。
- 一方 UI component library。
- 生产级 DevTools 浏览器扩展发布形态、component tree inspector、dependency graph、flame
  chart、持久化 capture workflow、telemetry workflow，或 SSR/SSG/hydration 专用 DevTools
  panels。
- 稳定 plugin 生态。
- 面向内部模块的长期兼容性策略。

这些缺口应在推广材料中保持可见，避免外部误解项目作为 beta 线运行时的定位。

## 发布协调状态

发布独立于仓库就绪度。`@italone/solace@0.0.5` 已发布到 npm，并且 `latest`
dist-tag 指向 `0.0.5`。`@italone/solace@0.1.0-beta.5` 已发布到 npm，并且
`beta` dist-tag 已指向 `0.1.0-beta.5`。本地 tag 指向发布提交 `afe459e`；由于验证环境无法连接
GitHub，远端 tag 仍待复核。后续任何发布或同步声明前仍应重新核对 Git 状态、远端 tag 和 npm registry。

未来发布任何后续版本前：

1. 确认本地分支已经 push，或明确接受从本地状态发布。
2. 确认 package version 尚未发布。
3. 运行 `pnpm release:candidate:check`，依次执行 publishable readiness、精确 beta.2 升级 smoke 和完整本地发布门禁。
4. 确认 `pnpm release:readiness -- --publishable` 返回分支同步且工作树干净。
5. 运行 `npm pack --dry-run --json` 或 `npm publish --dry-run --access public` 检查 tarball。
6. 只有在 npm authentication、organization access、public access 和 one-time password 都准备好，并且维护者明确确认 npm 发布后，才执行发布。

## 建议后续工作

公开契约门禁仍是发布前的第一条防线：只要公共入口或 beta 边界发生变化，README、
project-status、API、package-usage、package boundary tests、consumer smoke 和 release
readiness 就应同步调整。

1. 后续发布前继续保持 release baseline 同步。下一次发布准备前，重新运行 `git fetch origin main`、`git status --short --branch` 和 `git rev-list --left-right --count origin/main...HEAD`。
2. 优先沉淀 JSX/TSX-first runtime ergonomics 和示例：把函数组件、JSX/TSX 编写路径、明确运行时 API 和 package-boundary 示例作为 Solace 的主要身份。React 风格指的是熟悉的 TSX 函数组件和事件驱动 UI 组合，不是 React 兼容层，也不是整套照抄 React API。后续 API 工作应有意识地 harden Solace 自己的 JSX 类型、组件事件类型、slot ergonomics 和 runtime primitive 命名。
3. 维护可选实验性 SFC/Vite contract，但不扩语法：公开面保持为 `@italone/solace/sfc`、`@italone/solace/vite`、Vite transform diagnostics、显式 `map: null` 和当前文档化的 `.solace` block model。
4. 继续收敛 router beta API，但不急着扩 still-deferred 功能：renderer-owned 直接 SSR/hydration 集成、auth 和 permissions 继续保持 deferred，并保留显式 readiness、server context 与 snapshot verification workflow。
5. 对所有公共 API 变更保持公共 API 门禁必跑：`pnpm release:readiness`、`pnpm package:smoke`、`pnpm stable:app`、`pnpm test:e2e` 和 `pnpm test:e2e:devtools-extension`。
6. 在不扩大 runtime payload 的前提下继续 harden 首个 DevTools 扩展面板：当前 timeline UI 继续保留在 `examples/devtools-extension`，更丰富的 inspector views 需要先设计对应 event contracts；release notes 或 demo 前先运行 browser extension QA checklist；SSR/SSG/hydration 专用 panels 继续 deferred。
7. 在作出性能宣称前，继续收集 jsdom 与 browser benchmark history；重新生成
   `release/performance-history.json`，并按每个 scenario 或 task 的五个 distinct `runAt`
   验收，不把同一运行内的重复 samples 当作独立 runs。
