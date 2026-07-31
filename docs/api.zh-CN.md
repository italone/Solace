# API

[English](./api.md)

本文档描述 Solace 的公共运行时 API。运行时能力从包根入口导入，server rendering 和 SSG 从
`@italone/solace/server` 导入，JSX 支持从 JSX 子路径导入，DevTools 集成从
`@italone/solace/devtools` 导入。

`src/**` 下的内部文件、`dist/**` 下的生成文件、scheduler 队列、shape flags、组件实例和 VNode factory 内部实现都不属于兼容性契约。

## 公共根入口

包根入口暴露文档化运行时能力：

| 领域       | API                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | `createApp`                                                                                                                                           |
| Reactivity | `reactive`、`ref`、`computed`、`effect`、`watch`、`watchEffect`                                                                                       |
| Rendering  | `h`、`render`、`Fragment`、`useStyle`                                                                                                                 |
| Components | `defineComponent`、`defineAsyncComponent`                                                                                                             |
| Context    | `provide`、`inject`                                                                                                                                   |
| Lifecycle  | `onMounted`、`onUpdated`、`onUnmounted`                                                                                                               |
| Scheduler  | `nextTick`                                                                                                                                            |
| Store      | `createStore`                                                                                                                                         |
| Router     | `createRouter`、`createWebHistory`、`createWebHashHistory`、`RouterLink`、`RouterView`、`RouterNavigationError`、`lazyRoute`、`useRouter`、`useRoute` |

公共 TypeScript 辅助类型包括：

- App 和插件：`App`、`Plugin`、`PluginInstall`、`PluginObject`
- 异步组件：`AsyncComponentLoader`、`AsyncComponentOptions`、`AsyncComponentSource`
- 组件 setup：`ComponentSetupContext`、`EmitFn`、`Slot`、`SlotProps`、`Slots`
- Store：`Store`、`StoreActionsInput`、`StoreContext`、`StoreGetterContext`、`StoreGetters`、`StoreOptions`
- Router：`LazyRouteComponent`、`NavigationGuard`、`NavigationGuardResult`、`RouteComponent`、`RouteLocationNormalized`、`RouteLocationRaw`、`RouteRecord`、`Router`、`RouterHistory`、`RouterLinkProps`、`RouterOptions`
- VNode：`ComponentProps`、`ComponentRender`、`ComponentType`、`ComponentVNodeChildren`、`FragmentType`、`VNode`、`VNodeChild`、`VNodeChildren`、`VNodeProps`、`VNodeSlots`、`VNodeType`

## API 分层与稳定性

请只通过文档化 package entries 使用 Solace：

| 入口                               | 稳定性 | 用途                                               |
| ---------------------------------- | ------ | -------------------------------------------------- |
| `@italone/solace`                  | 公开   | App、响应式、渲染、组件、调度器、store             |
| `@italone/solace/jsx-runtime`      | 公开   | TypeScript 和 bundler 使用的 automatic JSX runtime |
| `@italone/solace/jsx-dev-runtime`  | 公开   | Vite 和 JSX dev tooling 使用的开发环境 JSX runtime |
| `@italone/solace/devtools`         | 公开   | 被 tooling 消费的底层 listener 和 recorder API     |
| `@italone/solace/server`           | 公开   | server rendering、内存 SSG 和 static asset helpers |
| `@italone/solace/sfc`              | 公开   | `.solace` 单文件组件 import 的类型声明入口         |
| `@italone/solace/vite`             | 公开   | alpha `.solace` 单文件组件的 Vite plugin           |
| `src/**`、`dist/**`、deep subpaths | 私有   | 内部实现细节，不作为兼容性目标                     |

alpha 阶段的兼容性契约有意保持较窄。公开入口应在 patch release 之间保持可用；内部模块、event emit helpers、scheduler 队列、renderer diagnostics、组件实例和生成文件布局可能在不额外通知的情况下变化。

`.solace` compiler 契约当前限于文档化的 Vite plugin 和 `@italone/solace/sfc` 类型声明入口。parser、生成 JavaScript 形状和内部 compiler modules 仍属于 alpha 实现细节。scoped style 会通过公开的 `useStyle()` runtime helper 注册，但生成模块形状和 compiler 内部实现不属于兼容性目标。Vite plugin 还没有公开 options；传入 options 会抛出 `TypeError`，避免暗示语法扩展。SFC block attributes 和自定义顶层 blocks 会被拒绝；文档化 block model 仍是一个 `<template>`、可选 `<script>` 和可选 `<style>`。无效 `.solace` 文件的公开 diagnostics surface 是 Vite transform failure，当前 transform policy 会有意返回 `map: null`，不发布 source maps。不要导入 `@italone/solace/compiler`、`@italone/solace/router` 或 `@italone/solace/dist/**` 这类 compiler/router deep subpaths。

包根入口中的 router exports 属于 beta API，面向小型 SPA 示例。当前支持 nested route records、redirects、全局 `beforeEach` guards、route-level `beforeEnter` guards、route `meta`，以及通过 `lazyRoute()` 声明的 route lazy components。route names、aliases、route props、scroll behavior、memory history、SSR/SSG/hydration router integration、auth、permissions 和长期 router 兼容策略仍被推迟。传入仍 deferred 的 route record fields 或 router options 会抛出 `TypeError`，而不是静默扩大 beta contract。

大多数应用应从包根入口导入。`@italone/solace/server` 只应在 server-side 代码中使用。JSX
子路径通常只通过 `jsxImportSource` 或 bundler 生成导入使用。只有在构建 instrumentation 或需要
event snapshots 的示例，或运行 `examples/devtools-extension` 浏览器 DevTools 扩展示例时，才直接使用 DevTools 子路径。

## App

### `createApp(rootComponent)`

创建一个 app wrapper，root 可以是组件，也可以是已经创建好的 VNode。

```ts
import { createApp, h } from "@italone/solace";

const App = () => h("p", null, "hello");

createApp(App).mount(document.querySelector("#app") as Element);
```

返回：

- `mount(container: Element): void`
- `hydrate(container: Element, options?: HydrationOptions): void`
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
  renderToString,
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
向 `renderToString()` 传入 `manifest`、`clientEntry` 或 `router` 这类 deferred integration
options 会抛出 `TypeError`。
async 或 thenable render tree 也会抛出 `TypeError`，因为 async SSR 仍处于 deferred 状态。
向 `hydrate()` 传入同样的 deferred 字段也会在运行时直接拒绝。
Hydration mismatch 错误会带结构化的 `kind`、`path`、`expected` 和 `actual` 字段，便于
区分 missing node、extra node、元素标签不一致和文本不一致。

Streaming SSR、async component SSR、SSG CLI、filesystem output、route crawling、hydration
mismatch 的自动恢复（显式 `recover` deopt 之外）、router-aware SSR 和 router-aware
hydration 仍保持 deferred。

### `generateStaticSite(options)`

`generateStaticSite({ routes, shell })` 会通过 `renderToString()` 渲染显式 route entries，并返回
`{ pages }`。每个 route 都必须有字符串 path，且 path 需要以 `/` 开头并保持唯一；同时需要有可被
`renderToString()` 接收的 `source`。可选的 route `provides` 会传入 rendering；可选的 route
`context` 会继续传给 shell。
shell 会收到 `styles` 和 `context` 的只读副本，因此 shell 里的 mutation 不会回写到返回的
page 元数据。
当 app-level `manifest` 和 `clientEntry` 成对提供时，`generateStaticSite()` 会先解析一次
production asset tags，并在每次 shell 调用里通过 `assets` 传入。shell 负责放置
`assets.modulePreloads`、`assets.stylesheets`、收集到的 `styles` 和 `assets.scripts`。只传
`manifest` 或只传 `clientEntry` 会抛出 `TypeError`。route-level `manifest`、`clientEntry`
和 `router` 字段仍会被拒绝。

```ts
const site = generateStaticSite({
  routes: [{ path: "/", source: h("h1", null, "Home") }],
  shell: ({ body, styles }) =>
    `<!doctype html><html><head>${styles.join("")}</head><body>${body}</body></html>`,
});

site.pages[0].html;
```

组合完整 shell 时，把 `styles.join("")` 放入文档 `<head>`。首个 SSG core 仅为内存 API。
filesystem output、route crawling、app-level router 和 CLI integration 仍不在当前公共契约内。

### `resolveStaticAssets(options)`

`resolveStaticAssets({ manifest, entry, base })` 会把 Vite-like production manifest 和 client
entry id 转换为完整的 HTML tag 字符串。imported chunks 会先于 entry chunk 遍历，CSS 会按首次
出现顺序去重，imported JavaScript 文件会生成 `modulepreload` links，entry 文件会生成唯一的
module script。`base` 默认为 `/`，并规范化为一个 trailing slash。

### `createStaticRoutesFromRouter(options)`

`createStaticRoutesFromRouter({ routes, paths })` 会把 beta router records 和显式 concrete
paths 转换为 `generateStaticSite()` routes。每个生成 route 都会渲染 matched component，并获得默认
`{ route }` context，其中包含 `{ path, fullPath, query, params, matched }`。可选
`context(route)` 会在默认 context 后浅合并，可选 `provides(route)` 会传给该 route 的
`renderToString()`。

该 adapter 不安装 router plugin，不让 `useRoute()` 在 SSR 中生效，不渲染 nested `RouterView`
trees，也不会 crawl 或推断 dynamic params。需要传入 `/users/42` 这类显式 path，不要把
`/users/:id` 当作待渲染 path。

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
type ComponentType<Props extends object = Record<string, unknown>> = (
  props: Props,
  context: ComponentSetupContext,
) => VNode | (() => VNode);
```

setup context 暴露：

- `emit(event, ...args)`：组件事件。
- `slots`：默认 slots、具名 slots 和 slot props。

组件可以直接返回 VNode，也可以返回 render function。当 setup 逻辑只需要运行一次，而 render 需要重复运行时，返回 render function 更合适。

```ts
import { h } from "@italone/solace";
import type { ComponentSetupContext } from "@italone/solace";

const Button = (props: { label: string }, { emit }: ComponentSetupContext) =>
  h("button", { onClick: () => emit("change") }, props.label);

const Panel =
  (_props: object, { slots }: ComponentSetupContext) =>
  () =>
    h("section", null, [
      h("header", null, slots.header?.() ?? null),
      h("main", null, slots.default?.({ text: "Body" }) ?? null),
    ]);

h(Panel, null, {
  header: () => h("h1", null, "Title"),
  default: (slotProps) => h("p", null, String(slotProps?.text)),
});
```

组件事件名会解析到 `onXxx` handler。kebab-case 事件名会先 camelize 再查找 handler，所以 `emit("item-change")` 可以匹配 `onItemChange`。

### `defineComponent(component)`

声明 Solace 组件，同时保持函数组件契约不变。

```ts
import { defineComponent, h } from "@italone/solace";

const Button = defineComponent((props: { label: string }) => h("button", null, props.label));
```

### `defineAsyncComponent(loader | options)`

声明一个异步加载其他组件的组件。

```ts
import { defineAsyncComponent, h } from "@italone/solace";

const LazyMessage = defineAsyncComponent<{ text: string }>(() =>
  Promise.resolve((props: { text: string }) => h("p", null, props.text)),
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

```ts
const LazyPanel = defineAsyncComponent<{ title: string }>({
  loader: () => Promise.resolve((props: { title: string }) => h("section", null, props.title)),
  loadingComponent: () => h("span", null, "loading"),
  errorComponent: () => h("strong", null, "failed"),
  delay: 200,
  timeout: 3000,
  retry: 2,
  retryDelay: 100,
});
```

### `provide(key, value)` / `inject(key, defaultValue?)`

在祖先组件 setup 和后代组件 setup 之间传递值，避免 prop drilling。key 可以是字符串或 symbol。`inject()` 会先查找组件祖先，再查找 app-level providers。没有 provider 时，返回传入的默认值。

```ts
import { h, inject, provide } from "@italone/solace";

const ThemeKey = Symbol("theme");

const Child = () => {
  const theme = inject(ThemeKey, "light");

  return () => h("span", null, theme);
};

const Parent = () => {
  provide(ThemeKey, "dark");

  return () => h(Child);
};
```

### 生命周期

- `onMounted(hook)`
- `onUpdated(hook)`
- `onUnmounted(hook)`

生命周期 hooks 在组件 setup 期间注册。在组件 setup 外调用会被忽略。

```ts
import { h, onMounted, onUnmounted, onUpdated } from "@italone/solace";

const Tracked = () => {
  onMounted(() => console.log("mounted"));
  onUpdated(() => console.log("updated"));
  onUnmounted(() => console.log("unmounted"));

  return () => h("p", null, "tracked");
};
```

## Scheduler

### `nextTick()`

在已排队的组件更新 flush 后 resolve。测试或集成代码需要在响应式 mutation 反映到 DOM 后再断言时，可以使用它。

```ts
import { nextTick, reactive, render, h } from "@italone/solace";

const state = reactive({ count: 0 });
const Counter = () => () => h("button", null, `count: ${state.count}`);
const container = document.querySelector("#app") as Element;

render(h(Counter), container);
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

Router 是包根入口中的 beta API，面向小型单页应用示例。当前支持静态路由、动态 params、wildcard fallback records、query 解析/序列化、browser history adapters、nested route records、redirects、全局 `beforeEach` guards、route-level `beforeEnter` guards、route `meta`、通过 `lazyRoute()` 声明的 route lazy components、`RouterLink`、`RouterView`，并可通过 `createApp(App).use(router)` 安装。

```ts
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHistory,
  h,
  lazyRoute,
  useRoute,
} from "@italone/solace";

const Home = () => h("p", null, "home");
const User = () => {
  const route = useRoute();

  return () => h("p", null, `user:${route.value.params.id}`);
};

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
    { path: "/old-dashboard", redirect: "/dashboard" },
    {
      path: "/dashboard",
      component: () => h("section", null, [h("h2", null, "Dashboard"), h(RouterView)]),
      meta: { requiresAuth: true },
      children: [
        { path: "", component: () => h("p", null, "dashboard home") },
        { path: "report", component: lazyRoute(() => import("./Report")) },
      ],
    },
    { path: "/:pathMatch(.*)*", component: () => h("p", null, "not found") },
  ],
});

router.beforeEach((to) =>
  to.matched.some((record) => record.meta?.requiresAuth) ? "/login" : true,
);

const App = () => () =>
  h("main", null, [h(RouterLink, { to: "/users/42" }, "User"), h(RouterView)]);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

### `createRouter({ history, routes })`

创建 router plugin。`routes` 按 path 匹配。静态路由优先于动态路由，`/:pathMatch(.*)*` 可作为 wildcard fallback。`router.currentRoute` 是一个 ref，包含 `{ path, fullPath, query, params, matched }`。
`routes` 必须是数组，route record path 必须是字符串；无效的 route list 或 path 形状会在
matcher 编译前被拒绝。
object route location 目前只支持 `{ path, query }`；named location、hash 和 params object 会被
拒绝，直到这些 router 契约被单独设计。
受支持的 path location 会规范化为前导 `/`，并移除除 `/` 之外的尾随斜杠。空字符串
location 会解析为 `/`。query string 对数组使用重复 key，跳过 object location 中的 nullish
值，将 `+` 保持为字面加号；percent encoding 非法时会抛出 `TypeError`。导航到当前
`fullPath`，或导航到最终 redirect 回当前 `fullPath` 的 route 时，会解析为当前 route，且不会写入
重复 history entry 或运行 navigation guards。浏览器 history listener 在首次 router install settle
之后收到当前 `fullPath` 时，会保持 `currentRoute` 不变，并跳过 navigation guards。

### `createWebHistory()` / `createWebHashHistory()`

创建浏览器 history adapters。普通 path routing 使用 `createWebHistory()`，hash routing 使用 `createWebHashHistory()`。

### `RouterLink` / `RouterView`

`RouterLink` 渲染 anchor，并在主键、无 modifier 的点击中执行异步客户端导航。`RouterView` 渲染当前 nested depth 对应的 route component；没有匹配或 lazy route component 仍在加载时渲染空 Fragment。
如果 lazy route component 加载失败，wrapper 会抛出 `RouterNavigationError`，其 type 为 `"lazy-load-failed"`。

当前 beta router 限制：

- 不包含 route names、aliases、route props、scroll behavior 或 memory history。
- 不包含 auth、permissions、SSR、SSG 或 hydration router integration。
- dynamic params 仅限简单 `:name` segments 和文档化的 wildcard `/:pathMatch(.*)*`；optional
  params、repeat params 和 custom regex params 会抛出 `TypeError`。
- 传入 `name`、`alias`、`props` 等 deferred route fields，或 `scrollBehavior` 等 deferred
  options，会抛出 `TypeError`。
- 直接 URL 访问的 fallback 仍依赖部署宿主配置。
- unknown route 行为应通过显式 wildcard route 处理。

## JSX

使用 TypeScript automatic JSX runtime：

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

公共 tooling 入口：

- `@italone/solace/sfc`
- `@italone/solace/vite`

## Vite Plugin 子路径

从 `@italone/solace/vite` 导入 alpha `.solace` compiler plugin：

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
