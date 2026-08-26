# API

[English](./api.md)

本文档描述 Solace 的公共运行时 API。Solace 的主要编写路径是 React 风格的函数组件、
JSX/TSX 和明确的运行时 API。运行时能力从包根入口导入，server rendering 和 SSG 从
`@italone/solace/server` 导入，JSX 支持从 JSX 子路径导入，DevTools 集成从
`@italone/solace/devtools` 导入。

`src/**` 下的内部文件、`dist/**` 下的生成文件、scheduler 队列、shape flags、组件实例和 VNode factory 内部实现都不属于兼容性契约。

## 公共根入口

包根入口暴露文档化运行时能力：

| 领域       | API                                                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App        | `createApp`                                                                                                                                                                                                                                                                                            |
| Reactivity | `reactive`、`ref`、`computed`、`effect`、`watch`、`watchEffect`                                                                                                                                                                                                                                        |
| Rendering  | `h`、`render`、`Fragment`、`useStyle`                                                                                                                                                                                                                                                                  |
| Components | `defineComponent`、`defineAsyncComponent`                                                                                                                                                                                                                                                              |
| Context    | `provide`、`inject`                                                                                                                                                                                                                                                                                    |
| Lifecycle  | `onMounted`、`onUpdated`、`onUnmounted`                                                                                                                                                                                                                                                                |
| Scheduler  | `nextTick`                                                                                                                                                                                                                                                                                             |
| Store      | `createStore`                                                                                                                                                                                                                                                                                          |
| Router     | `createRouter`、`createMemoryHistory`、`createWebHistory`、`createWebHashHistory`、`RouterLink`、`RouterView`、`RouterNavigationError`、`RouterHydrationError`、`createRouterSnapshot`、`parseRouterSnapshot`、`serializeRouterSnapshot`、`verifyRouterSnapshot`、`lazyRoute`、`useRouter`、`useRoute` |

公共 TypeScript 辅助类型包括：

- App 和插件：`App`、`Plugin`、`PluginInstall`、`PluginObject`
- 异步组件：`AsyncComponentLoader`、`AsyncComponentOptions`、`AsyncComponentSetupResult`、
  `AsyncComponentSource`、`AsyncComponentType`
- 组件 setup：`ComponentSetupContext`、`EmitFn`、`Slot`、`SlotProps`、`Slots`
- Store：`Store`、`StoreActionsInput`、`StoreContext`、`StoreGetterContext`、`StoreGetters`、`StoreOptions`
- Router：`LazyRouteComponent`、`NavigationGuard`、`NavigationGuardResult`、`RouteComponent`、`RouteLocationNormalized`、`RouteLocationRaw`、`RouteRecord`、`Router`、`RouterHistory`、`RouterLinkProps`、`RouterOptions`、`RouterScrollBehavior`、`RouterScrollBehaviorResult`、`RouterScrollPosition`、`RouterSnapshot`、`RouteRecordIdentity`、`RouterHydrationErrorField`
- VNode：`AsyncComponentVNodeChildren`、`AsyncVNodeChild`、`AsyncVNodeChildren`、
  `ComponentProps`、`ComponentRender`、`ComponentType`、`ComponentVNodeChildren`、`FragmentType`、
  `VNode`、`VNodeChild`、`VNodeChildren`、`VNodeProps`、`VNodeSlots`、`VNodeType`

## API 分层与稳定性

请只通过文档化 package entries 使用 Solace：

| 入口                               | 稳定性 | 用途                                               |
| ---------------------------------- | ------ | -------------------------------------------------- |
| `@italone/solace`                  | 公开   | App、响应式、渲染、函数组件、调度器、store         |
| `@italone/solace/jsx-runtime`      | 公开   | TypeScript 和 bundler 使用的 automatic JSX runtime |
| `@italone/solace/jsx-dev-runtime`  | 公开   | Vite 和 JSX dev tooling 使用的开发环境 JSX runtime |
| `@italone/solace/devtools`         | 公开   | 被 tooling 消费的底层 listener 和 recorder API     |
| `@italone/solace/server`           | 公开   | server rendering、内存 SSG 和 static asset helpers |
| `@italone/solace/sfc`              | 公开   | 可选实验性 `.solace` imports 的类型声明入口        |
| `@italone/solace/vite`             | 公开   | 可选实验性 `.solace` component 的 Vite plugin      |
| `src/**`、`dist/**`、deep subpaths | 私有   | 内部实现细节，不作为兼容性目标                     |

beta 线兼容性契约仍有意保持较窄。文档化公开入口应在 patch release 之间保持可用；内部模块、event emit helpers、scheduler 队列、renderer diagnostics、组件实例和生成文件布局可能在不额外通知的情况下变化。

`.solace` compiler 契约是可选、窄、实验性的辅助能力。它当前限于文档化的 Vite plugin 和 `@italone/solace/sfc` 类型声明入口，不是 Solace 的主要组件模型。parser、生成 JavaScript 形状和内部 compiler modules 仍属于辅助编译器表面背后的实现细节。scoped style 会通过公开的 `useStyle()` runtime helper 注册，但生成模块形状和 compiler 内部实现不属于兼容性目标。Vite plugin 还没有公开 options；传入 options 会抛出 `TypeError`，避免暗示语法扩展。SFC block attributes 和自定义顶层 blocks 会被拒绝；文档化 block model 仍是一个 `<template>`、可选 `<script>` 和可选 `<style>`。无效 `.solace` 文件的公开 diagnostics surface 是 Vite transform failure，当前 transform policy 会有意返回 `map: null`，不发布 source maps。不要导入 `@italone/solace/compiler`、`@italone/solace/router` 或 `@italone/solace/dist/**` 这类 compiler/router deep subpaths。

包根入口中的 router exports 属于 beta API，面向小型 SPA 示例。当前支持 nested route records、redirects、全局 `beforeEach` guards、route-level `beforeEnter` guards、route `meta`、route names、aliases、route props、named locations、`createMemoryHistory()`，通过 `lazyRoute()` 声明的 route lazy components，以及成功导航后的 `scrollBehavior`。auth、permissions、SSR/SSG/hydration router integration 和长期 router 兼容策略仍被推迟。传入仍 deferred 的 router options 会抛出 `TypeError`，而不是静默扩大 beta contract。

大多数应用应从包根入口导入。`@italone/solace/server` 只应在 server-side 代码中使用。JSX
子路径通常只通过 `jsxImportSource` 或 bundler 生成导入使用。只有在构建 instrumentation 或需要
event snapshots 的示例，或运行 `examples/devtools-extension` 浏览器 DevTools 扩展示例时，才直接使用 DevTools 子路径。

关于受保护入口、patch release 规则、maturity label 和迁移要求，请阅读[兼容性与弃用策略](./compatibility.zh-CN.md)。
该策略在不静默移除文档化入口的前提下，将 router 和 async API 标记为 beta，将 SFC/Vite API 标记为 experimental。

## Deferred Beta 边界

当前公共契约会主动拒绝仍处于 deferred 状态的集成入口，而不是静默接受 Solace 尚未实现的
options。Router auth、permissions、router-aware SSR、router-aware hydration
和 async update scheduling 仍不属于 beta 契约。`renderToStream()`
提供的顺序流式（sequential）与乱序（out-of-order）streaming SSR 已作为 beta server entry 提供，见下文章节。Route `meta` 是给
应用代码和示例使用的开发者自定义数据，不是认证或权限执行机制。使用 `auth` 或 `permissions`
字段的 router options 或 route records 会被明确的 deferred-boundary 错误拒绝；本地 UX routing
应使用应用自己的 guards，真正的 enforcement 应由后端授权承担。任何扩大这些边界的公共 API
工作，都需要在同一变更中同步 README、project-status、package-usage、package boundary tests、
consumer smoke 覆盖和发布门禁。

下一阶段 router integration 仍只处于设计状态。请阅读
[router-aware SSR 与 hydration 设计](./superpowers/specs/2026-08-14-router-aware-ssr-hydration-design.md)
现已落地第一组可组合 primitives：request-scoped memory history、canonical route snapshot、server
context 和 hydration verification。SSR、SSG 和 hydration 仍继续拒绝直接 `router` options。

## App

### `createApp(rootComponent)`

创建一个 app wrapper，root 可以是组件，也可以是已经创建好的 VNode。

```tsx
import { createApp } from "@italone/solace";

const App = () => <p>hello</p>;

createApp(App).mount(document.querySelector("#app") as Element);
```

返回：

- `mount(container: Element): void`
- `hydrate(container: Element, options?: HydrationOptions): void`
- `hydrateAsync(container: Element, options?: HydrationOptions): Promise<void>`
- `provide(key, value): App`
- `use(plugin, ...options): App`

当 `rootComponent` 是组件函数时，`mount()` 会先创建 root VNode，再渲染到目标 DOM 容器。
`hydrate()` 会创建同样的 root VNode，但会认领匹配的 server-rendered DOM、附加事件监听器，
并让后续响应式更新通过普通 renderer patch。`provide()` 在 mount 或 hydration 前注册
app-level value，并返回 app 以支持链式调用。后代组件可以通过 `inject()` 读取这些值，组件级
provider 会覆盖 app-level provider。

```ts
import { createApp } from "@italone/solace";

createApp(App)
  .provide("theme", "dark")
  .mount(document.querySelector("#app") as Element);
```

Hydration 是显式 API，默认仍会在 mismatch 时抛错：

```ts
import { createApp } from "@italone/solace";

createApp(App).hydrate(document.querySelector("#app") as Element);
```

当 hydration 在未传 `recover: true` 的情况下抛错时，失败的 root hydration effect 会先被清理，
因此后续响应式变化不会持续重试已经失败的 server tree。
只有在客户端需要把不匹配的 server tree 降级为 fresh client render 时，才显式传入
`recover: true`：

```ts
import { createApp } from "@italone/solace";

createApp(App).hydrate(document.querySelector("#app") as Element, { recover: true });
```

`hydrateAsync()` 会在认领 server DOM 前准备完整 async initial tree。准备失败时容器保持不变。
它沿用 `hydrate()` 的 mismatch 行为和 `{ recover: true }` deopt；准备完成后，解析得到的同步
render function 会安装普通同步组件 effects。

```tsx
import { createApp, reactive } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";

const state = reactive({ count: 0 });
const AsyncCounter: AsyncComponentType = async () => {
  await Promise.resolve();
  return () => <button onClick={() => (state.count += 1)}>count: {state.count}</button>;
};

await createApp(AsyncCounter).hydrateAsync(document.querySelector("#app") as Element);
```

`use()` 会在每个 app 实例中安装一次插件。插件可以是函数，也可以是带 `install()` 方法的对象。
options 会在 app 参数之后继续传入，方法返回 app 以支持链式调用。

```ts
import { createApp } from "@italone/solace";
import type { App, Plugin } from "@italone/solace";

const plugin: Plugin = (app: App, option) => {
  app.provide("feature", option);
};

createApp(App)
  .use(plugin, "enabled")
  .mount(document.querySelector("#app") as Element);
```

## Server Rendering 子路径

SSR 和 SSG API 从 `@italone/solace/server` 导入：

```ts
import { h } from "@italone/solace";
import {
  createStaticRoutesFromRouter,
  generateStaticSite,
  generateStaticSiteAsync,
  renderToStream,
  renderToString,
  renderToStringAsync,
  resolveStaticAssets,
} from "@italone/solace/server";

const result = renderToString(h("p", null, "server"));
```

`renderToString(source)` 返回 `{ html, styles }`。首个 server renderer 支持同步 VNode 和函数
组件树，会转义文本和属性，从 HTML 中省略事件 props，并且不会运行 DOM 生命周期 hooks。浏览器端
组件可通过 `useStyle(scopeId, css)` 注册样式；server rendering 会把它们收集到 `styles` 中，
以完整的 `<style data-s-id="...">...</style>` 字符串返回。浏览器端使用
`createApp(App).hydrate(container)` 为匹配的 server HTML 附加行为，并复用已有
`style[data-s-id]` 标签，避免重复插入匹配样式。Hydration 默认在 mismatch 时抛错；
`createApp(App).hydrate(container, { recover: true })` 会捕获 `SolaceHydrationError`，
用 client VNode tree 替换不匹配的容器内容，并让后续响应式更新继续走普通 renderer path。未传
`recover: true` 时，失败的 hydration 会在重新抛出 mismatch 前清理 root hydration effect。
向 `renderToString()` 传入 `manifest`、`clientEntry`、`router` 或 `stream` 这类 deferred
integration options 会抛出 `TypeError`。
Hydration options 必须是非数组对象；提供 `recover` 时，它必须是 boolean。
`renderToString()` 的 `context` 如果提供，必须是 plain object。
Hydration options 只接受 `recover` 和 `selective`（后者仅用于 `hydrateAsync()`，见 Suspense
章节），`renderToString()` options 只接受 `context` 和 `provides`；
未知的自有 option 字段会抛出包含字段名的 `TypeError`。
同步 `renderToString()`、`generateStaticSite()`、`hydrate()`、`render()` 和 `mount()` 会拒绝
async 或 thenable render tree，包括 direct sources、SSG route sources 和 async child values。
这些现有同步 API 保持原有同步返回类型；需要 async tree 时应使用显式 async 入口。向
`hydrate()` 或 `hydrateAsync()` 传入 deferred `manifest`、`clientEntry`、`router` 或 `stream`
字段也会在运行时直接拒绝。
Hydration mismatch 错误会带结构化的 `kind`、`path`、`expected` 和 `actual` 字段，便于
区分 missing node、extra node、元素标签不一致和文本不一致。

### `renderToStringAsync(source, options?)`

`renderToStringAsync()` 会先缓冲完整 initial tree，再返回 `{ html, styles }`。它接受 promised
root、async components、promised child VNodes，以及与 `renderToString()` 相同的 `context` 和
`provides` options。发生 rejection 时不会暴露部分 HTML。

```tsx
import { h } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";
import { renderToStringAsync } from "@italone/solace/server";

const AsyncMessage: AsyncComponentType = async () => () => <strong>ready</strong>;
const result = await renderToStringAsync(
  Promise.resolve(h("section", null, [h(AsyncMessage), Promise.resolve(h("i", null, "child"))])),
);
```

Async setup 在 initial preparation 中采用 setup-once 语义。解析为同步 render function 时，
`hydrateAsync()` 之后仍支持后续响应式更新；直接解析为 VNode 时，它是固定 initial result；
promised children 是 one-shot values。`provide()`、`inject()`、lifecycle registration 和
`useStyle()` 可在第一次 suspension 前，以及解析后的同步 render function 内使用；它们不属于
`await` 之后 continuation code 的 ambient component-instance API 契约。顺序流式（sequential）
与乱序（out-of-order）streaming SSR 已通过 `renderToStream()` 提供；Suspense 边界与 selective
hydration 已作为 beta 切片提供（见下文章节）；SSR/hydration 上的直接 router
option 和 async update scheduling 仍保持 deferred。

### `renderToStream(source, options?)`

`renderToStream()` 返回 UTF-8 HTML 的 `ReadableStream<Uint8Array>`，接受 VNode、组件函数、
promised root 和 async components。与缓冲式的 `renderToStringAsync()` 不同，它不接受带
promised children 的 VNode —— 异步边界必须通过 async components（或 promised root）表达，
promised children 会抛出 `TypeError` 被显式拒绝，而不是被 await。对于它支持的 source，字节顺序与
`renderToStringAsync().html` 完全一致；渲染按顺序
流式输出，在等待未解析的 async component 之前先刷新已完成的前缀，因此消费者会先收到较早
的标记。`useStyle()` 注册的样式在首次注册处内联发射（按 style id 去重；同一 id 的冲突注册
会抛错），而不是最后统一收集。

```tsx
import { h } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";
import { renderToStream } from "@italone/solace/server";

const AsyncMessage: AsyncComponentType = async () => () => <strong>ready</strong>;
const stream = renderToStream(h("section", null, h(AsyncMessage)));
return new Response(stream, { headers: { "content-type": "text/html; charset=utf-8" } });
```

`renderToStream()` 被调用时渲染立即开始（eager start）；本切片返回的流不处理消费者
backpressure。options 只接受 `context`、`provides` 和 `mode`（`"ordered"` 为默认值，与之前的
版本字节一致；`"out-of-order"` 见下文）；未知自有字段 —— 包括 `manifest`、
`clientEntry` 和 `router` —— 会抛出带字段名的 `TypeError`。默认的 ordered 模式下，渲染错误会通过
`controller.error()` 拒绝流，此时部分字节可能已经发射。
renderer-owned 直接 router options 和消费者 backpressure 均未
实现。

#### 乱序（out-of-order）streaming

传入 `mode: "out-of-order"` 可按 async component 边界的解析顺序流式输出，而不是阻塞在声明顺序上：

```tsx
import { defineAsyncComponent, h } from "@italone/solace";
import { renderToStream } from "@italone/solace/server";

const AsyncMessage = defineAsyncComponent({
  loader: async () => () => <strong>ready</strong>,
  fallback: () => <p>loading…</p>,
});
const stream = renderToStream(h("section", null, h(AsyncMessage)), { mode: "out-of-order" });
```

`defineAsyncComponent({ loader, fallback })` 接受一个仅用于乱序模式的可选 `fallback`：
可以是 VNode，或返回 VNode 的工厂函数。缓冲式渲染（`renderToStringAsync()`）与顺序流式会
忽略该 fallback。每个未解析的 async 边界会以 `<!--so:b:N-->` 和 `<!--/so:b:N-->` 注释标记
包裹，其中包含 fallback（未提供 fallback 时为空）。边界解析后，会以 `<!--so:r:N-->` 注释
标记加一段内联替换脚本的形式 —— 按解析顺序而非声明顺序 —— 在文档其余部分之后 flush；
脚本会把边界中的 fallback 替换为解析后的标记。边界子树内通过 `useStyle()` 注册的样式会
内联发射在替换 payload 中，并由共享的 style sink 去重。如果 loader 失败，fallback 标记会
保留，并发射 `<!--so:b:N failed:message-->` 失败注释，流不会被拒绝 —— 这与 ordered 模式
不同，后者在 loader 成功后若渲染出错仍会拒绝整个流。hydration 不受影响：内联脚本在文档流式输出期间执行，
因此客户端代码运行前 DOM 已是最终状态，`hydrateAsync()` 保持不变。消费者 backpressure 仍不属于本切片的目标。

### Suspense 与 selective hydration

`Suspense` 是一个内置组件，用于在一个 fallback 后面协调整棵 async 子树：

```tsx
import { defineAsyncComponent, h, Suspense } from "@italone/solace";

const AsyncPart = defineAsyncComponent({ loader: async () => () => <strong>ready</strong> });
const tree = h(Suspense, { fallback: h("p", null, "loading…") }, [
  h("b", null, "sync"),
  h(AsyncPart),
]);
```

`h(Suspense, { fallback }, children)` 会在子树中任一 async component 未解析时渲染 fallback；
当子树内全部 loader 解析完成后，fallback 会被替换为 children。整棵子树 —— 包括同步
children —— 都在解析后才出现，因此同步 children 不会与 fallback 并存闪烁。嵌套的
Suspense 边界相互独立：内层边界保持自己的 fallback，而外层先行切换。Suspense 同样适用于
不涉及 SSR 的纯客户端渲染。如果子树的 loader 失败，fallback 会被保留，并通过
`console.error` 报告失败；渲染不会被 reject。

在服务端，ordered 模式的 `renderToStream()`（以及缓冲式的 `renderToStringAsync()`）会内联
await Suspense 子树的 loader，因此解析后的 children 会直接出现在文档中。乱序模式会为每棵
Suspense 子树发射一个 `so:b` 边界，复用现有的 async component 协议：`<!--so:b:N-->` /
`<!--/so:b:N-->` 标记内的 fallback 标记、按解析顺序 flush 的 `<!--so:r:N-->` 替换脚本、保留
fallback 且不拒绝流的失败注释，以及发射在替换 payload 内的 `useStyle()` 样式。

`hydrateAsync(container, { selective: true })` 可启用 selective hydration：

```tsx
import { Suspense, createApp, h } from "@italone/solace";

await createApp(() =>
  h(Suspense, { fallback: h("p", null, "loading…") }, [h(AsyncPart)]),
).hydrateAsync(document.querySelector("#app") as Element, { selective: true });
```

`selective` 选项默认为 `false`，保持整树契约：`hydrateAsync()` 先准备完整的 async tree 再匹配
server DOM。传入 `selective: true` 后，已就绪的部分会立即水合；未解析的 async components 与
Suspense 子树在 `so:b` 标记范围内针对其 fallback DOM 水合；loader 解析后，边界内容会被原地
patch，边界落定后注释标记会被移除。selective hydration 进行期间，用户交互（`click`、
`pointerdown`、`keydown`、`input` 和 `change`）会在 container 根部被捕获，落定后携带原有类型化
payload 回放；target 已离开 DOM 的缓冲事件会被丢弃。loader 失败时保留 fallback 并通过
`console.error` 记录失败 —— hydration promise 不会被 reject。selective 模式同样支持
`{ recover: true }`，语义与整树水合一致。同步的 `hydrate()` 在传入 `selective: true` 时会抛错；
selective hydration 是仅限 `hydrateAsync()` 的选项。

本切片的非目标：不提供 SuspenseList、不提供 scheduler priorities，也不在 fallback 切换上提供
transition hooks。

### Router-aware SSR 与 hydration 组合

`router.isReady()` 只启动一次初始 history navigation，并向所有调用方返回同一个 promise。初始
redirect、全局 guard 和 route guard 完成后才 resolve；初始 guard cancellation 或 navigation
failure 会 reject。后续 `push()` / `replace()` 保持原有语义。

server 侧使用 `createRouterServerContext()` 为每个请求创建独立的
`createMemoryHistory(url)` router，`configure` 可同步注册 global guards。它等待 readiness 后返回
`{ router, route, snapshot, provides }`；把 `provides` 传给现有 renderer，不增加 renderer option：

```tsx
import { RouterView } from "@italone/solace";
import type { RouteRecord } from "@italone/solace";
import {
  createRouterServerContext,
  renderToStringAsync,
  serializeRouterSnapshot,
} from "@italone/solace/server";

const routes: RouteRecord[] = [{ path: "/", name: "home", component: () => <p>home</p> }];
const identifyRecord = (record: RouteRecord) => record.name ?? record.path;
const server = await createRouterServerContext({ url: "/", routes, identifyRecord });
const rendered = await renderToStringAsync(() => <RouterView />, {
  provides: server.provides,
});
const snapshotText = serializeRouterSnapshot(server.snapshot);
```

浏览器必须先安装 router、await `isReady()`，再用相同 record identity callback 创建 client
snapshot，并在调用 `hydrateAsync()` 前验证：

```tsx
const app = createApp(App).use(router);
await router.isReady();
const serverSnapshot = parseRouterSnapshot(snapshotElement.textContent ?? "");
const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
verifyRouterSnapshot(serverSnapshot, clientSnapshot);
await app.hydrateAsync(container);
```

matched record identity 必须非空且唯一。snapshot 会排序 params/query keys，保留 query array
item order，并继续沿用 router 对 nullish query input 的省略语义。序列化会转义 script-sensitive
字符；解析会拒绝 malformed、unknown 或不支持版本。`RouterHydrationError` 指出第一个 mismatch
字段。router snapshot recovery 由应用显式负责，与仅处理 DOM mismatch 的 `{ recover: true }`
分离。

### `generateStaticSite(options)`

`generateStaticSite({ routes, shell })` 会通过 `renderToString()` 渲染显式 route entries，并返回
`{ pages }`。每个 route 都必须有字符串 path，且 path 需要以 `/` 开头并保持唯一；同时需要有可被
`renderToString()` 接收的 `source`。可选的 route `provides` 会传入 rendering，且必须是
`Map`；可选的 route `context` 会继续传给 shell，且必须是 plain record object。
shell 会收到 `styles` 和 `context` 的只读副本，因此 shell 里的 mutation 不会回写到返回的
page 元数据。
当 app-level `manifest` 和 `clientEntry` 成对提供时，`generateStaticSite()` 会先解析一次
production asset tags，并在每次 shell 调用里通过 `assets` 传入。shell 负责放置
`assets.modulePreloads`、`assets.stylesheets`、收集到的 `styles` 和 `assets.scripts`。只传
`manifest` 或只传 `clientEntry` 会抛出 `TypeError`。route-level `manifest`、`clientEntry`
和 `router` 字段仍会被拒绝。
`generateStaticSite()` options 只接受 `routes`、`shell`、`manifest`、`clientEntry` 和 `base`；
route entries 只接受 `path`、`source`、`context` 和 `provides`。未知的自有 option 或 route
字段会抛出包含字段名的 `TypeError`。

```ts
const site = generateStaticSite({
  routes: [{ path: "/", source: h("h1", null, "Home") }],
  shell: ({ body, styles }) =>
    `<!doctype html><html><head>${styles.join("")}</head><body>${body}</body></html>`,
});

site.pages[0].html;
```

### `generateStaticSiteAsync(options)`

`generateStaticSiteAsync()` 接受相同的已校验 SSG options 和 async route sources。Routes 会按声明
顺序逐个 await；只有全部 route 与 shell 调用成功后，才返回完整 `{ pages }`。

```ts
const site = await generateStaticSiteAsync({
  routes: [
    { path: "/", source: Promise.resolve(h("h1", null, "Home")) },
    { path: "/about", source: async () => () => h("p", null, "About") },
  ],
  shell: ({ body }) => `<!doctype html><body>${body}</body>`,
});
```

组合完整 shell 时，把 `styles.join("")` 放入文档 `<head>`。首个 SSG core 仅为内存 API。
filesystem output、route crawling、app-level router 和 CLI integration 仍不在当前公共契约内。

### `resolveStaticAssets(options)`

`resolveStaticAssets({ manifest, entry, base })` 会把 Vite-like production manifest 和 client
entry id 转换为完整的 HTML tag 字符串。imported chunks 会先于 entry chunk 遍历，CSS 会按首次
出现顺序去重，imported JavaScript 文件会生成 `modulepreload` links，entry 文件会生成唯一的
module script。`base` 默认为 `/`，并规范化为一个 trailing slash。`options`、`manifest`
以及每个 manifest chunk 必须是 plain object 或 null-prototype record。

### `createStaticRoutesFromRouter(options)`

`createStaticRoutesFromRouter({ routes, paths })` 会把 beta router records 和显式 concrete
paths 转换为 `generateStaticSite()` routes。每个生成 route 都会渲染 matched component，并获得默认
`{ route }` context，其中包含 `{ path, fullPath, query, params, matched }`。可选
`context(route)` 会在默认 context 后浅合并，可选 `provides(route)` 会传给该 route 的
`renderToString()`。`context(route)` 必须返回 plain record object，`provides(route)` 必须返回
`Map`。
static router record 的契约有意窄于 SPA `RouteRecord`：只接受 `path` 和 eager function
`component`。nested records、redirects、guards、`meta`、lazy route components，以及
layout-less 的 `null` components 在该 adapter 中仍保持 deferred。

该 adapter 不安装 router plugin，不让 `useRoute()` 在 SSR 中生效，不渲染 nested `RouterView`
trees，也不会 crawl 或推断 dynamic params。需要传入 `/users/42` 这类显式 path，不要把
`/users/:id` 当作待渲染 path。static paths 可以包含 query string，但不能包含 hash fragments。

## Runtime Style 注册

从包根入口使用 `useStyle(scopeId, css)` 注册渲染树样式：

```ts
import { h, useStyle } from "@italone/solace";
import { renderToString } from "@italone/solace/server";

const App = () => {
  useStyle("counter", ".counter { color: blue; }");
  return h("button", { class: "counter" }, "server");
};

const result = renderToString(h(App));
result.styles; // ['<style data-s-id="counter">.counter { color: blue; }</style>']
```

`useStyle(scopeId, css)` 必须在组件渲染期间运行。server rendering 会把样式注册到当前
`renderToString()` 请求作用域；浏览器 `mount()` 和 `hydrate()` 会通过 document-backed style
sink 写入样式，并按 `scopeId` 去重已有 `style[data-s-id]` 标签。在同一个 sink 中用同一个
`scopeId` 注册不同 CSS 会被视为样式冲突。

## Reactivity

响应式模块会在响应式工作运行期间追踪读取，并在写入时触发匹配的工作。它有意保持较小范围：对象 proxy、ref-like 值、缓存 computed、effects 和 watchers。

### `reactive(target)`

使用 proxy 包装对象。读取属性时可以被当前 active effect 或组件 render 追踪。写入发生变化的属性时，会触发依赖 effects 或已调度的组件更新。

```ts
import { reactive } from "@italone/solace";

const state = reactive({ count: 0 });
state.count += 1;
```

### `ref(value)`

创建带 `.value` 的响应式值容器。赋同一个值不会触发依赖。

```ts
import { ref } from "@italone/solace";

const count = ref(0);
count.value += 1;
```

### `computed(getter)`

返回带 readonly `.value` 的 ref-like 对象。getter 是惰性的，并会缓存结果，直到被追踪的依赖发生变化。

```ts
import { computed, reactive } from "@italone/solace";

const state = reactive({ count: 1 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value);
```

### `effect(fn)`

立即运行 `fn`，并在被追踪的依赖变化时重新运行。它返回一个 runner function，可用于手动再次执行 effect。

```ts
import { effect, reactive } from "@italone/solace";

const state = reactive({ count: 0 });
const rerun = effect(() => {
  console.log(state.count);
});

rerun();
```

### `watch(source, callback)`

观察一个 getter source。当 source 结果变化时，callback 会收到新值和旧值。它返回 stop handle。

```ts
import { reactive, watch } from "@italone/solace";

const state = reactive({ count: 0 });

const stop = watch(
  () => state.count,
  (value, oldValue) => {
    console.log(value, oldValue);
  },
);

stop();
```

### `watchEffect(effect)`

立即运行，追踪函数执行期间读取到的所有依赖，在依赖变化时重新运行，并返回 stop handle。

```ts
import { reactive, watchEffect } from "@italone/solace";

const state = reactive({ count: 0 });

const stop = watchEffect(() => {
  console.log(state.count);
});

stop();
```

## Rendering

### `h(type, props?, children?)`

为 DOM 元素、组件或 `Fragment` 创建 VNode。

```ts
import { h } from "@italone/solace";

h("button", { onClick: save }, "Save");
```

支持的 children 形态：

- `string`：文本 children。
- `VNode` 或 `VNode[]`：嵌套渲染 children。
- `null`：无 children。
- slot 对象：组件 children。

renderer 会读取 `props.key` 中的字符串或数字 key，用于 keyed diff。事件 props 使用 `onXxx` 约定。例如，`onClick` 会安装 DOM click listener，后续 handler 更新会尽量复用同一个缓存 invoker。

### `render(vnode, container)`

将 VNode 挂载或 patch 到 DOM 容器中。读取响应式状态的组件会进入批处理更新队列，而不是每次 mutation 都同步 patch DOM。

```ts
import { h, render } from "@italone/solace";

render(h(App), document.querySelector("#app") as Element);
```

### `Fragment`

组合多个 children，且不额外添加 DOM wrapper。

```ts
import { Fragment, h } from "@italone/solace";

h(Fragment, null, [h("span", null, "A"), h("span", null, "B")]);
```

## Components

Solace 组件是下面这种函数形态：

```ts
type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Slots,
> = (props: Props, context: ComponentSetupContext<Events, SlotMap>) => VNode | (() => VNode);
```

setup context 暴露：

- `emit(event, ...args)`：组件事件。
- `slots`：默认 slots、具名 slots 和 slot props。

组件可以直接返回 VNode，也可以返回 render function。当 setup 逻辑只需要运行一次，而 render 需要重复运行时，返回 render function 更合适。TSX 中写在组件标签之间的 children 会进入 `slots.default`，因此 wrapper 组件的 props 可以继续聚焦在明确输入上。

```tsx
import type { ComponentSetupContext } from "@italone/solace";

const Button = (props: { label: string }, { emit }: ComponentSetupContext) => (
  <button onClick={() => emit("change")}>{props.label}</button>
);

const Panel =
  (_props: object, { slots }: ComponentSetupContext) =>
  () => (
    <section>
      <header>{slots.header?.()}</header>
      <main>{slots.default?.({ text: "Body" })}</main>
    </section>
  );
```

组件事件名会解析到 `onXxx` handler。kebab-case 事件名会先 camelize 再查找 handler，所以 `emit("item-change")` 可以匹配 `onItemChange`。

事件类型可以通过 `ComponentEventMap` 和 `defineComponent<Props, Events>` 显式启用。每个事件
映射到自己的参数 tuple：

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap } from "@italone/solace";

type CounterEvents = {
  increment: [count: number];
  "value-change": [value: number];
  reset: [];
};

const Counter = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => (
  <button onClick={() => emit("increment", props.count)}>{props.count}</button>
));

const App = () => (
  <Counter
    count={1}
    onIncrement={(count: number) => console.log(count)}
    onValueChange={(value: number) => console.log(value)}
  />
);
```

未显式声明事件映射的组件默认保持宽松。这个契约只在编译期约束事件，不增加运行时
校验。显式事件映射会推导精确的 `onXxx` listener payload：listener 可以是函数或函数数组，参数与事件 tuple 一致。kebab-case 事件只暴露规范的 camelized listener，因此 `value-change` 映射到 `onValueChange`。这个 JSX 推导不会改变 `h()` 现有的宽松 props 契约。

slot 类型通过 `defineComponent<Props, Events, SlotMap>` 显式启用。有限 SlotMap 会同时约束组件
内部消费和调用端生产：required `default` slot 要求 JSX children；未声明 `default` 的组件拒绝
JSX children；`h()` 可以接收直接 default children 或精确 slot object，并校验 required slots、
未知名称和 scoped-slot 参数。JSX 当前没有 named-slot attribute 语法，因此调用端需要提供具名或
scoped slot function 时使用 `h()`。未显式声明 SlotMap 的组件继续保留旧的宽松生产契约；这些
检查不会增加运行时 slot metadata 或校验。

### `defineComponent(component)`

声明 Solace 组件，同时保持函数组件契约不变。

```tsx
import { defineComponent } from "@italone/solace";

const Button = defineComponent((props: { label: string }) => <button>{props.label}</button>);
```

### `defineAsyncComponent(loader | options)`

声明一个异步加载其他组件的组件。

```tsx
import { defineAsyncComponent } from "@italone/solace";

const LazyMessage = defineAsyncComponent<{ text: string }>(() =>
  Promise.resolve((props: { text: string }) => <p>{props.text}</p>),
);
```

options 形式支持：

| 选项               | 行为                                           |
| ------------------ | ---------------------------------------------- |
| `loader`           | 返回一个 promise，resolve 后得到组件。         |
| `loadingComponent` | 在 `delay` 后、加载期间渲染。                  |
| `errorComponent`   | loader reject 或 timeout 且 retry 耗尽后渲染。 |
| `delay`            | loading 组件变为可见前等待的毫秒数，默认 `0`。 |
| `timeout`          | 当前加载尝试超时失败前等待的毫秒数。           |
| `retry`            | reject 或 timeout 后额外尝试的次数，默认 `0`。 |
| `retryDelay`       | 每次 retry 前等待的毫秒数，默认 `0`。          |

resolved、loading 和 error 组件都会收到最新 props 和默认 slot children。

```tsx
const LazyPanel = defineAsyncComponent<{ title: string }>({
  loader: () => Promise.resolve((props: { title: string }) => <section>{props.title}</section>),
  loadingComponent: () => <span>loading</span>,
  errorComponent: () => <strong>failed</strong>,
  delay: 200,
  timeout: 3000,
  retry: 2,
  retryDelay: 100,
});
```

### `provide(key, value)` / `inject(key, defaultValue?)`

在祖先组件 setup 和后代组件 setup 之间传递值，避免 prop drilling。key 可以是字符串或 symbol。`inject()` 会先查找组件祖先，再查找 app-level providers。没有 provider 时，返回传入的默认值。

```tsx
import { inject, provide } from "@italone/solace";

const ThemeKey = Symbol("theme");

const Child = () => {
  const theme = inject(ThemeKey, "light");

  return () => <span>{theme}</span>;
};

const Parent = () => {
  provide(ThemeKey, "dark");

  return () => <Child />;
};
```

### 生命周期

- `onMounted(hook)`
- `onUpdated(hook)`
- `onUnmounted(hook)`

生命周期 hooks 在组件 setup 期间注册。在组件 setup 外调用会被忽略。

```tsx
import { onMounted, onUnmounted, onUpdated } from "@italone/solace";

const Tracked = () => {
  onMounted(() => console.log("mounted"));
  onUpdated(() => console.log("updated"));
  onUnmounted(() => console.log("unmounted"));

  return () => <p>tracked</p>;
};
```

## Scheduler

### `nextTick()`

在已排队的组件更新 flush 后 resolve。测试或集成代码需要在响应式 mutation 反映到 DOM 后再断言时，可以使用它。

```tsx
import { createApp, nextTick, reactive } from "@italone/solace";

const state = reactive({ count: 0 });
const Counter = () => () => <button>count: {state.count}</button>;
const container = document.querySelector("#app") as Element;

createApp(Counter).mount(container);
state.count += 1;

await nextTick();
```

## Store

### `createStore({ state, getters, actions })`

通过 state factory、computed getters 和命名 actions 创建一个小型集中式 store。

```ts
import { createStore } from "@italone/solace";
import type { StoreContext, StoreGetterContext } from "@italone/solace";

type CounterState = { count: number };
type CounterGetters = { double: number };

const store = createStore({
  state: () => ({ count: 0 }),
  getters: {
    double({ state }: StoreGetterContext<CounterState>) {
      return state.count * 2;
    },
  },
  actions: {
    increment({ state }: StoreContext<CounterState, CounterGetters>, amount: number) {
      state.count += amount;
    },
  },
});

store.actions.increment(1);
console.log(store.state.count, store.getters.double);
```

Store 行为：

- `state` 是响应式对象，应通过 factory 创建。
- `getters` 是 computed values，并以 readonly properties 暴露。
- `actions` 的第一个参数是 `{ state, getters }`。
- 读取 store state 或 getters 的组件会通过和其他响应式读取相同的 scheduler 重新渲染。
- 安装 DevTools listeners 后，store actions 会发出小型 success 或 error summary，不包含 action arguments、results 或 raw state。

## Router

Router 是包根入口中的 beta API，面向小型单页应用示例。当前支持静态路由、动态 params、wildcard fallback records、query 解析/序列化、browser history adapters、nested route records、redirects、route names、aliases、route props、全局 `beforeEach` guards、route-level `beforeEnter` guards、route `meta`、通过 `lazyRoute()` 声明的 route lazy components、`RouterLink`、`RouterView`，并可通过 `createApp(App).use(router)` 安装。

```tsx
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createMemoryHistory,
  lazyRoute,
  useRoute,
} from "@italone/solace";

const Home = () => <p>home</p>;
const User = () => {
  const route = useRoute();

  return () => <p>user: {route.value.params.id}</p>;
};

const DashboardLayout = () => () => (
  <section>
    <h2>Dashboard</h2>
    <RouterView />
  </section>
);

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
    { path: "/old-dashboard", redirect: "/dashboard" },
    {
      path: "/dashboard",
      component: DashboardLayout,
      meta: { requiresAuth: true },
      children: [
        { path: "", component: () => <p>dashboard home</p> },
        { path: "report", component: lazyRoute(() => import("./Report")) },
      ],
    },
    { path: "/:pathMatch(.*)*", component: () => <p>not found</p> },
  ],
});

router.beforeEach((to) =>
  to.matched.some((record) => record.meta?.requiresAuth) ? "/login" : true,
);

const App = () => () => (
  <main>
    <RouterLink to="/users/42">User</RouterLink>
    <RouterView />
  </main>
);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

### `createRouter({ history, routes })`

创建 router plugin。`routes` 按 path 匹配。静态路由优先于动态路由，`/:pathMatch(.*)*` 可作为 wildcard fallback。`router.currentRoute` 是一个 ref，包含 `{ path, fullPath, query, params, matched, name }`。
`options` 必须是非数组 object，`history` 必须是实现 `location()`、`push()`、`replace()`、
`listen()`、`back()` 和 `forward()` 的非数组 object。`routes` 必须是数组，route record path
必须是字符串；无效的 options、history adapter、route list 或 path 形状会在 matcher 编译前被
拒绝。route record path 必须是相对路径，且不能包含 query string 或 hash fragment。route record
必须是非数组 object，route component 必须是函数、有效的 `lazyRoute()` value，或为 layout-less
record 省略 / 设为 `null`。route redirect string 和 object location 会在 router 创建阶段按同一套
route location 契约校验。
route location 必须是 string 或非数组 object。object route location 支持 `{ path, query }`，
named location 使用 `{ name, params, query }`；string 或 object path 中的 hash fragment 会被
拒绝。object location 的 `path` 不能包含 query string；需要 query 时应使用单独的 `query`
字段。
string route location 和 object location 的 `path` 都必须是相对路径。受支持的 path location 会规范化为前导
`/`，并移除除 `/` 之外的尾随斜杠。空字符串 location 会解析为 `/`。query string 对数组使用重复
key，跳过 object location 中的 nullish 值，将 `+` 保持为字面加号；percent encoding 非法时会抛出
`TypeError`。string route location 只用第一个 `?` 分隔 path 和 query，后续 `?` 会保留在 query
value 中，并在 canonical `fullPath` 中被编码。object route location 的 query value 必须是
string、number、boolean、null、undefined，或这些值的数组。导航到当前 `fullPath`，或导航到最终
redirect 回当前 `fullPath` 的 route 时，会解析为当前 route，且不会写入重复 history entry 或运行
navigation guards。object route location 的 `query` 容器必须是 plain record object；
`URLSearchParams`、`Map`、`Date`、arrays 和其他 object instances 仍不在 beta contract 内。
浏览器 history listener 在首次 router install settle
之后收到当前 `fullPath` 时，会保持 `currentRoute` 不变，并跳过 navigation guards。
nested route match 中的 redirects 会按父到子的顺序解析，并且先于任何 matched `beforeEnter`
guards 运行。

route record 的 name、alias 和 props 已纳入公开契约。named location 会经过 canonical path
解析，alias 会保留 canonical matched records 和 route name，而 route props 支持 `true`、plain
object 或基于 matched route 计算的 function。`props: true` 时，router 会传入 `route.params`
的浅拷贝。

`router.isReady()` 暴露唯一的初始 history settlement promise。install 前调用会启动 settlement；
`app.use(router)` 后调用会等待同一个操作。redirects 和 guards 完成后，它 resolve 为已 settle 的
`currentRoute.value`；初始失败后保持 rejected。后续显式 navigation 相互独立。

### `createWebHistory()` / `createWebHashHistory()` / `createMemoryHistory()`

创建浏览器 history adapters。普通 path routing 使用 `createWebHistory()`，hash routing 使用
`createWebHashHistory()`。`listen()` 会在 normalized location 发生变化时通知各 listener，并
返回 unsubscribe 函数，同时抑制 location 未变化时重复触发的原生事件。adapter normalization
会补前导 `/`、移除除 `/` 外的 path 尾随斜杠，保留 query string，并拒绝相对/绝对 URL
风格 target 或 write target 中的 hash fragment。`push()` 和 `replace()` 更新浏览器状态，
但不会直接调用 listener。

`createMemoryHistory()` 提供同一个 `RouterHistory` interface，但使用内存 stack。它是确定性的，
支持 push/replace/back/forward，适合 non-browser 测试和受控导航流程。

### `RouterLink` / `RouterView`

`RouterLink` 渲染 anchor，并在指向当前 browsing context 的主键、无 modifier 点击中执行异步客户端导航。它的
`href` attribute 来自 `router.resolve(to).fullPath`，并由已安装的一方 history adapter
format，因此受支持的 string 和 object locations 会使用与编程式导航一致的 canonical path 与
query serialization。`createWebHashHistory()` 会渲染 `#/users/42?tab=profile` 这样的 hash
href。带 modifier、已被阻止、非 `_self` target 或 `download` attribute 的点击保持由浏览器处理。
`RouterView` 渲染当前 nested depth 对应的 route component；没有匹配或 lazy route component
仍在加载时渲染空 Fragment。
如果 lazy route component 加载失败，wrapper 会抛出 `RouterNavigationError`，其 type 为 `"lazy-load-failed"`。同一个 `lazyRoute()` component 被多个 route record 复用时，该错误的 `from` 和 `to` 会描述失败时的 active route，而不是该 component 首次渲染所在的 route。如果 route redirect function 抛出异常，或返回 deferred / 其他无效 location，navigation 会以 type 为 `"redirect-rejected"` 的 `RouterNavigationError` reject；该错误的 `to` location 是 redirect 失败的 route。

当前 beta router 限制：

- 不包含 auth、permissions，且 SSR、SSG 或 hydration 仍不接受直接 `router` option；可组合的
  readiness、server context 和 snapshot primitives 已单独提供。
- dynamic params 仅限简单 `:name` segments 和文档化的 wildcard `/:pathMatch(.*)*`；optional
  params、repeat params 和 custom regex params 会抛出 `TypeError`。
- 传入 `auth` 或 `permissions` 等仍 deferred 的 options 或 route record fields，会抛出 `TypeError`。
- 直接 URL 访问的 fallback 仍依赖部署宿主配置。
- unknown route 行为应通过显式 wildcard route 处理。

## JSX

把 JSX/TSX 函数组件作为 Solace 的主要编写路径。配置 TypeScript automatic JSX runtime：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

公共 JSX 入口：

- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`

JSX `key` 是 keyed children 使用的框架级属性，接受字符串或数字；函数组件的 props 类型不需要声明 `key`。JSX component children 会进入组件 setup context 的 `slots.default`，普通 slot children 不需要在组件 props 中声明 `children` 字段。显式有限 SlotMap 会让 required default children 成为必填项，并在没有 default slot 时拒绝 children；具名和 scoped producer function 使用 typed `h()` slot-object 形式。JSX `onXxx` attributes 是 `emit()` 使用的组件事件 handler 约定，因此 `emit("increment")` 会匹配已传入的 `onIncrement`。TSX component 的 `onXxx` 值类型是函数或函数数组；非函数值不属于公开 JSX 契约。DOM `onXxx` attributes 只接受函数。JSX fragment shorthand（`<>...</>`）通过 automatic runtime 支持，渲染时不会额外增加 DOM wrapper。

公共 tooling 入口：

- `@italone/solace/sfc`
- `@italone/solace/vite`

这些 tooling 入口用于可选实验性 `.solace` 辅助路径，不是主要组件编写模型。

## Vite Plugin 子路径

从 `@italone/solace/vite` 导入当前可选实验性 `.solace` compiler plugin：

```ts
import solace, { solacePlugin } from "@italone/solace/vite";
```

默认导出和具名 `solacePlugin` 导出会创建同一个 Vite plugin。该 plugin 只转换以 `.solace`
结尾的文件，返回 JavaScript component module，并保持其他文件 id 不变。基于 query 的
`.solace?*` transform 会被拒绝，直到 sub-request 语义被单独设计。Compiler failure 会作为 Vite
transform error 抛出，并在可用时包含 diagnostic code、filename、line 和 column。该子路径有意只导出 `default` 和 `solacePlugin`；compiler helpers 继续保持私有。

## DevTools 子路径

DevTools API 有意不从包根入口导出。请从 `@italone/solace/devtools` 导入。

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

payload 边界和隐私约束见 [devtools.md](./devtools.md)。
