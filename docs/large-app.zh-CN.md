# 大型应用指南

这份指南整理了 Solace 目前适合大型应用的组织方式。它不是新的运行时契约，只是说明如何组合现有公开 API，方便项目在变大后仍然保持清晰。

## 适用范围

Solace 更适合下面这种大型应用组织方式：

- 一个小而明确的 app shell
- 由路由拥有的 feature 模块
- 局部 UI 使用局部状态
- 跨路由共享的数据使用 store
- 明确的发布门禁和 benchmark 检查

## 结构

推荐保持 shell 很薄，feature 目录向下展开：

```text
src/
  app/
    App.tsx
    router.ts
    store.ts
  features/
    dashboard/
      DashboardPage.tsx
      dashboard.store.ts
      dashboard.routes.ts
    users/
      UsersPage.tsx
      user.routes.ts
      user.api.ts
  shared/
    components/
    composables/
    styles/
```

shell 只负责应用装配：

- `createApp()`
- router 安装
- store 安装
- app-level `provide()`
- 顶层布局

feature 模块负责视图状态、route records 和 feature-local 逻辑。

## 第一个切片

第一次落地时，先保持一个 route slice 足够小：

- 把 route record 放在 feature page 旁边
- 只有当另一个 route 也需要时，才把 feature store 提升出来
- 只把真正共享的基础能力放进 `shared/`
- shell 层只保留路由、store 注册和顶层布局

这样第一次迁移更容易读，也更容易在后面继续拆分。

## Route Slice 示例

feature route 文件只导出 records：

```ts
import type { RouteRecord } from "@italone/solace";
import { lazyRoute } from "@italone/solace";

export const userRoutes: RouteRecord[] = [
  {
    path: "/users",
    name: "users",
    component: lazyRoute(() => import("./UsersPage")),
    meta: { title: "Users" },
  },
];
```

app router 在一个地方组合 feature routes：

```ts
import { createRouter, createWebHistory } from "@italone/solace";

import { HomePage } from "./HomePage";
import { userRoutes } from "../features/users/user.routes";

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "home", component: HomePage }, ...userRoutes],
});
```

如果应用需要 auth 或 permissions，enforcement 应留在后端或应用自有 guard 层。不要在 router
options 或 route records 上添加 `auth` / `permissions` 字段。

## 路由

大型应用里，route 模块应该尽量靠近它所加载的 feature。

- 用 route names、aliases、props 和 nested routes 保持 URL 明确。
- auth 和权限执行应留给后端或应用自定义 guard 层。
- route `meta` 只应该作为应用自有 metadata，不应该当成安全边界。
- router 设定尽量集中在一个地方，便于审计 redirects 和 guards。

如果 route tree 已经不好读，把 route records 按 feature 拆开，再在 router bootstrap 文件里组装。

## 状态

用最小状态面解决问题：

- 局部 reactive state 放局部 UI
- store state 放多个路由或面板共享的数据
- `provide()` / `inject()` 放依赖式共享
- computed values 放派生状态

不要把所有 API response 都塞进一个 store。状态所有权应尽量靠近使用它的 feature。

## 状态归属速查表

app 变大后，可以直接按这个规则判断：

- local reactive state：表单草稿、modal 开关、tab 选择、临时 UI state
- store state：两个或多个 route 都要读写的数据
- `provide()` / `inject()`：analytics、feature flags、共享 client 这类 app 级服务
- computed values：总数、过滤列表、仅用于展示的派生值

如果一份 state 能跟着 feature folder 一起移动，就尽量留在 feature 里；只有在共享需求要求时，
才把它提升到更高层。

## SSR 和 Hydration

保持 server 和 client 入口显式。

- `renderToString()` 只处理同步 server tree。
- `generateStaticSite()` 用于内存中的 SSG。
- manifest 和 router integration 继续留在 renderer 之外，直到单独契约定义它们。
- `createApp(App).hydrate(container)` 只应作用在匹配的 server HTML 上。
- hydration recovery 保持显式 `{ recover: true }`。

对于大型应用，宁可选择一个明确的 server shell，也不要引入过深的隐式渲染规则。

## 性能

把 benchmark 当趋势工具，而不是绝对承诺。

- `pnpm benchmark`
- `pnpm benchmark:browser`
- `pnpm benchmark:history`

如果要看 browser history，先积累足够样本再比较版本。若改动影响路由切换或 keyed list update，先看相关场景，再做性能判断。
`.benchmark-history/` 只作为本地忽略 JSONL history，分享摘要结果，不提交原始样本。

## 采用检查清单

在大型应用里使用 Solace 前，先确认项目能接受当前 beta 边界：

- 阅读 `docs/project-status.zh-CN.md`，并在计划中保持 router、SSR/hydration、DevTools、UI
  library 和 plugin ecosystem 的 deferred gaps 可见
- 先只用文档化 package-root APIs 做出一个 route slice，再迁移更多 feature
- auth 和权限 enforcement 不要放进 route records
- 选择一个能代表核心交互的 benchmark 场景
- 发布或推荐给其他团队前，先运行 package smoke 和 browser e2e checks

## 生态和 UI 库

Solace 当前没有一方 UI component library，也没有稳定 plugin ecosystem。大型应用应把这些决策留在应用层，并把
[docs/ecosystem.md](./ecosystem.md) 作为 beta 线方向记录：

- 先用应用自有 components 包住 third-party UI components，再暴露给各 feature 使用
- design tokens、form patterns、table patterns 和 accessibility decisions 不进入 Solace runtime
  contract
- 没有真实应用证明 integration shape 前，不急着做 package-level adapters
- DevTools extension panels 应视为 diagnostics，而不是 ecosystem plugin API

这样可以保持 framework runtime 小，同时继续 harden beta 线的公开 package boundaries。

## 发布纪律

公开 API 变更前，保持这些门禁一致：

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`
- `pnpm test:e2e:devtools-extension`

当公共边界变化时，README、project status、API、package usage、consumer smoke 和这份指南要一起更新。

## 迁移建议

把更大的代码库迁到 Solace 时：

1. 先从一个 shell 和一个 route slice 开始。
2. 没有证明是共享需求之前，先把状态留在局部。
3. 只有多个 feature 真的共享同一份数据时，再引入 store module。
4. 围绕最重要的交互保留一个 benchmark 场景。
5. 保持 router contract 显式而小。
