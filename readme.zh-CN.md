# Solace

[English](./readme.md)

Solace 是一个 JSX/TSX-first、TypeScript-first 的前端框架，用于构建响应式、组件驱动的 Web 界面。

Solace 聚焦于小型运行时核心：响应式状态、调度渲染、VNode diff、函数组件、JSX/TSX 编写体验，以及明确的应用 API。这个项目以可阅读的独立框架实现为基础，同时配套了接近生产项目的工具链、测试、示例、包导出和发布检查。

## 为什么选择 Solace

- **TypeScript-first 运行时**：源码、公共 API、示例和测试均使用 TypeScript 编写。
- **默认响应式**：`reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 都可以从包根入口直接使用。
- **函数组件渲染管线**：Solace 包含 VNode、DOM 渲染、keyed children diff、Fragment 支持、函数组件、生命周期、props、emit、slots 和异步组件。
- **小而清晰的应用接口**：`createApp()` 提供挂载、插件和应用级依赖注入能力，不需要庞大的框架外壳。
- **JSX/TSX-first**：内置自动 JSX runtime 入口，这是 Vite 和 TypeScript 项目的主要编写路径。
- **质量门禁驱动开发**：仓库包含单元测试、集成测试、浏览器 e2e 测试、包消费者冒烟测试、覆盖率检查和 benchmark 冒烟检查。

## 项目状态

Solace 当前处于 `0.1.0` beta 线。npm `latest` 仍是 `0.0.5`，npm `beta` 是
`0.1.0-beta.6`。`0.1.0-beta.7` 候选（根入口 `SolaceHydrationError` 导出）已提交，npm 发布尚未完成。beta 线在 async renderer 入口上增加了 renderer-owned router SSR、
运行时生产 SSR 资源注入、根运行时与 `./server` 入口的稳定 1.0 公共契约边界，
以及 `SolaceHydrationError` 的根入口导出。

目前可以通过下面的本地开发流程体验框架。需要使用最新稳定线时，可以安装默认 npm package；需要使用 beta 线时，可以安装 `@italone/solace@beta`；需要查看 `main` 上尚未发布的文档或运行时变更时，应直接使用仓库。

当前完成度摘要：

- App、响应式、渲染、函数组件、上下文、生命周期、调度器、store、JSX/TSX、buffered async
  initial SSR/hydration、sequential async SSG、runtime style registration 和 DevTools 集成已经通过
  文档化公开入口暴露。
- 包产物包含 ESM、CJS、TypeScript declarations、JSX runtime 子路径、`@italone/solace/server`，以及 `@italone/solace/devtools` 子路径。
- `.solace` SFC 支持仍通过 `@italone/solace/vite` 和 `@italone/solace/sfc` 提供，但它是可选、窄、实验性的辅助能力，不是 Solace 的主要组件编写模型。
- 仓库包含一个示例级浏览器 DevTools timeline panel，它只消费公开 DevTools 子路径，不改变 runtime payload。
- 验证覆盖 format、typecheck、lint、单元测试、集成测试、包导出测试、覆盖率阈值、packed-consumer 冒烟测试、jsdom benchmark、Chromium 生产构建浏览器 benchmark 和浏览器 e2e 测试。
- npm 发布仍是独立的维护者决策。npm `latest` 和 npm `beta` 可以指向不同成熟度的版本线。

当前完成度映射和发布边界见 [docs/project-status.zh-CN.md](./docs/project-status.zh-CN.md)。

## 当前范围

Solace 当前适合用于学习 JSX/TSX-first 的小型前端运行时、实验响应式渲染，以及在小示例中
验证框架实现思路。它还不是 React、Vue、Svelte 或其他成熟生产框架的完整替代品。beta 线已经
提供 `renderToStringAsync()` 的 buffered async initial rendering、`generateStaticSiteAsync()` 的
sequential in-memory SSG，以及 `hydrateAsync()` 的 prepare-then-commit 浏览器 hydration。
Router-aware SSR/hydration 已通过显式 readiness、server context 和 snapshot 组合提供。顺序流式
（sequential）streaming SSR 已作为 beta server entry 通过 `renderToStream()` 提供：字节顺序与
`renderToStringAsync().html` 一致，样式在首次注册处内联发射，渲染 eager 启动且不处理消费者
backpressure。乱序（out-of-order）streaming SSR 可通过 `renderToStream(source, { mode: "out-of-order" })` 使用，配合 `defineAsyncComponent({ loader, fallback })` fallback 与按解析顺序的替换脚本。Router-aware SSG 与同步入口的 router options、initial hydration 之后的 async update scheduling、
一方 UI 组件、生产级 DevTools 发布形态和内部模块兼容性承诺仍不在冻结后的生产契约内。上述排除项是面向可读性/教学定位的刻意范围决策，而非未完成工作；重新评估标准见 [docs/roadmap.md](./docs/roadmap.md)。

## 公开契约门禁

公共 API 变更在发布前需要保持 README、project-status、API、package-usage、package exports
和 consumer smoke 覆盖同步。当前 beta 契约已通过 `router.isReady()`、canonical snapshots 和
`createRouterServerContext()` 提供可组合的 router-aware SSR 与 router-aware hydration，并通过
`renderToStream()` 提供顺序流式 streaming SSR，并通过 `renderToStream(source, { mode: "out-of-order" })`
提供乱序 streaming SSR，并提供 `h(Suspense, { fallback }, children)` 加 `hydrateAsync(container,
{ selective: true })` 的 Suspense/selective hydration beta 切片，还通过 `renderToStream()`/
`renderToStringAsync()` 的 `router` option 配合 `hydrateAsync(container, { router,
routerIdentifyRecord })` 提供 renderer-owned router SSR，并通过三个 SSR renderer 上成对的
`manifest` 加 `clientEntry` options 提供生产 asset injection；仍推迟
auth、permissions、router-aware SSG 与同步入口的 router options、initial hydration 之后的 async
update scheduling，以及 build CLI asset 工具链（manifest 由应用的构建产出）。Router `auth` 和
`permissions` options 或 route
record fields 会被明确拒绝，不会被当作隐式客户端授权能力。
SSR、hydration 和 SSG option objects 也会通过包含字段名的 `TypeError` 拒绝未知自有字段，
避免静默接受拼写错误的配置。

关于 `0.1.x` 兼容性主线，在依赖包入口、规划迁移或编写 release note 前请先阅读[兼容性与弃用策略](./docs/compatibility.zh-CN.md)。
该策略保护八个已发布的 export path，同时将 router 和 async 行为标记为 beta，将 SFC/Vite 行为标记为 experimental。

## 快速开始

克隆仓库并安装依赖：

```bash
pnpm install
```

运行默认示例：

```bash
pnpm dev
```

运行主要质量门禁：

```bash
pnpm quality
```

在发布决策前运行完整发布检查：

```bash
pnpm release:check
```

机器可读的公共边界检查使用 `pnpm release:contract:check`。严格的
`pnpm release:one-zero:check` 只是 evidence checklist，不代表 1.0 已就绪；当前 React/Vite
记录仍然只是 compatibility-only，直到补齐 Solace-primary 生产工作流、upgrade/rollback 演练和
stable contract admission 证据。

完整发布检查包含 `pnpm test:e2e` 和 `pnpm test:e2e:devtools-extension`，确保普通浏览器示例与
DevTools extension 冒烟在 release notes 或发布前保持一致。

## 最小示例

```tsx
import { createApp, reactive } from "@italone/solace";

const state = reactive({ count: 0 });

const App = () => (
  <button
    onClick={() => {
      state.count += 1;
    }}
  >
    count: {state.count}
  </button>
);

createApp(App).mount(document.querySelector("#app") as Element);
```

## JSX 示例

配置 TypeScript：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

编写组件：

```tsx
import { createApp, reactive } from "@italone/solace";

const state = reactive({ count: 0 });

const App = () => (
  <button
    onClick={() => {
      state.count += 1;
    }}
  >
    count: {state.count}
  </button>
);

createApp(App).mount(document.querySelector("#app") as Element);
```

## 核心 API

Solace 保持较小的公共 API 面。包根入口是主要的 beta 运行时入口；`src/**` 下的内部模块和
`dist/**` 下的生成文件都属于实现细节。

### App

- `createApp(rootComponent)`
- `app.mount(container)`
- `app.hydrate(container, options?)`
- `app.hydrateAsync(container, options?)`
- `app.use(plugin, ...options)`
- `app.provide(key, value)`

`createApp()` 接收组件或已经创建好的 VNode，可将其渲染到 DOM 容器中，也可 hydrate 匹配的
server-rendered DOM。Hydration 默认在 mismatch 时抛错；传入 `{ recover: true }` 可显式用
client tree 替换不匹配的 server DOM。它返回可链式调用的 app 实例。`app.use()` 可以安装函数插件，也可以安装带
`install()` 方法的对象插件，同一个插件在每个 app 实例中只会安装一次。`app.provide()` 注册应用级值，后代组件可以通过 `inject()` 读取。

Promised root、async component 和 promised child VNode 应使用 `@italone/solace/server` 的
`renderToStringAsync()` 与 `generateStaticSiteAsync()`。现有同步 API 保持同步返回类型，并拒绝
尚未解析的 async values。

```tsx
import { createApp } from "@italone/solace";
import type { App, Plugin } from "@italone/solace";

const themePlugin: Plugin = (app: App, theme: string) => {
  app.provide("theme", theme);
};

const AppRoot = () => <main>Hello Solace</main>;

createApp(AppRoot)
  .use(themePlugin, "dark")
  .mount(document.querySelector("#app") as Element);
```

### Reactivity

- `reactive(target)`
- `ref(value)`
- `computed(getter)`
- `effect(fn)`
- `watch(source, callback)`
- `watchEffect(fn)`

响应式系统会追踪属性读取，并在写入时触发依赖工作。`reactive()` 使用 proxy 包装对象。
`ref()` 通过 `.value` 保存基础值或对象值。`computed()` 是惰性且带缓存的，只有依赖变更后
才会重新计算。`effect()` 会立即执行，并在追踪到的依赖更新时重新执行。`watch()` 观察一个
getter source，并接收新旧值。`watch()` 和 `watchEffect()` 都会返回 stop handle。

```ts
import { computed, reactive, watchEffect } from "@italone/solace";

const state = reactive({ count: 1 });
const doubled = computed(() => state.count * 2);

const stop = watchEffect(() => {
  console.log(`count=${state.count}, doubled=${doubled.value}`);
});

state.count += 1;
stop();
```

### Rendering

- `h(type, props?, children?)`
- `render(vnode, container)`
- `Fragment`

`h()` 用于创建 DOM 元素、组件和 Fragment 的 VNode。元素 props 使用示例中的 `onXxx`
事件约定，因此 `onClick` 会映射为 DOM click listener。`render()` 将 VNode tree 挂载或
patch 到容器中。`Fragment` 可以组合多个 children，而不会额外生成 DOM 包裹节点。VNode
支持字符串 children、数组 children、keyed children 和组件 slot 对象。

```ts
import { Fragment, h, render } from "@italone/solace";

render(
  h(Fragment, null, [
    h("h1", null, "Solace"),
    h("button", { key: "save", onClick: () => console.log("save") }, "Save"),
  ]),
  document.querySelector("#app") as Element,
);
```

### Components

- `defineComponent(component)`
- `defineAsyncComponent(loader | options)`
- `provide(key, value)`
- `inject(key, defaultValue?)`
- `onMounted(fn)`
- `onUpdated(fn)`
- `onUnmounted(fn)`

Solace 组件是函数，接收 `props` 和 setup context。组件可以直接返回 VNode，也可以返回一个
render function。setup context 暴露 `emit` 用于组件事件，暴露 `slots` 用于默认 slot 或
具名 slot。`defineComponent()` 保留同样的函数组件契约，同时在声明处强化意图和类型推导。

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentSetupContext } from "@italone/solace";

const CounterButton = defineComponent(
  (props: { count: number }, { emit, slots }: ComponentSetupContext) => (
    <button onClick={() => emit("increment")}>
      <span>count: {props.count}</span>
      <small>{slots.default?.()}</small>
    </button>
  ),
);

const App = () => (
  <CounterButton count={1} onIncrement={() => console.log("increment")}>
    click me
  </CounterButton>
);
```

`defineAsyncComponent()` 会包装组件 loader。它支持简单 loader 函数，也支持 options 对象，
其中可以配置 `loadingComponent`、`errorComponent`、`delay`、`timeout`、`retry` 和
`retryDelay`。已解析组件、loading 组件和 error 组件都会接收最新 props 和 slot children。

```tsx
import { defineAsyncComponent } from "@italone/solace";

const LazyPanel = defineAsyncComponent<{ title: string }>({
  loader: () => import("./panel").then((mod) => mod.Panel),
  loadingComponent: () => <span>Loading</span>,
  errorComponent: () => <strong>Failed</strong>,
  delay: 200,
  timeout: 3000,
  retry: 2,
  retryDelay: 100,
});
```

当组件通过 `defineComponent<Props, Events, SlotMap>` 声明 slot map 时，可以直接在 JSX 中
通过 `v-slots` prop 提供具名 slot：

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap, ComponentSetupContext, VNodeChild } from "@italone/solace";

type CardSlots = {
  header?: () => VNodeChild;
  default?: () => VNodeChild;
  footer?: () => VNodeChild;
};

const Card = defineComponent<object, ComponentEventMap, CardSlots>(
  (_props, { slots }: ComponentSetupContext<ComponentEventMap, CardSlots>) =>
    () => (
      <section>
        <header>{slots.header?.()}</header>
        <main>{slots.default?.()}</main>
        <footer>{slots.footer?.()}</footer>
      </section>
    ),
);

const App = () => (
  <Card v-slots={{ header: () => <h2>Title</h2>, footer: () => <small>Fine print</small> }}>
    Body content
  </Card>
);
```

完整的 typed slot、typed event 和泛型组件契约（包括 `h()` 的 slot object 规则）见
[docs/api.md](./docs/api.md)。

`provide()` 和 `inject()` 可以在组件树中传递值，避免层层透传 props。组件级 provider 会覆盖
app-level provider。没有找到 key 时，`inject()` 可以返回 `undefined`，也可以返回传入的默认值。
生命周期 hooks 在组件 setup 期间注册，并分别在挂载后、更新后和卸载清理时运行。

```tsx
import { defineComponent, inject, onMounted, provide } from "@italone/solace";

const ThemeProvider = defineComponent((_props: object, { slots }) => {
  provide("theme", "dark");
  return () => <section>{slots.default?.()}</section>;
});

const ThemeLabel = defineComponent(() => {
  const theme = inject("theme", "light");
  onMounted(() => console.log("mounted"));
  return () => <span>theme: {theme}</span>;
});
```

### Store

- `createStore(options)`

`createStore()` 将 `reactive()` state、`computed()` getters 和命名 actions 组合成一个小型
集中式状态容器。state 通过 factory 创建，getters 会作为只读派生值暴露，actions 会接收包含
`state` 和 `getters` 的 context。

```ts
import { createStore } from "@italone/solace";

const counter = createStore({
  state: () => ({ count: 0 }),
  getters: {
    doubled: ({ state }) => state.count * 2,
  },
  actions: {
    increment({ state }, step: number) {
      state.count += step;
    },
  },
});

counter.actions.increment(1);
console.log(counter.state.count, counter.getters.doubled);
```

### Scheduler 与类型

- `nextTick()`
- 公共 TypeScript 辅助类型

`nextTick()` 会在已排队的组件更新 flush 后 resolve，适合测试或集成代码在响应式更新后观察
DOM。包根入口还导出了面向 app、plugin、异步组件、组件 setup context、emit function、
slots、store、VNode、props 和 render helper 的公共 TypeScript 类型。

```ts
import { nextTick } from "@italone/solace";

state.count += 1;
await nextTick();
```

公共 API 详情和示例见 [docs/api.zh-CN.md](./docs/api.zh-CN.md)。

## 示例

Solace 包含多个 Vite 示例，用于覆盖不同运行时路径：

| 示例           | 命令                          | 覆盖范围                                                                            |
| -------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| Basic counter  | `pnpm dev`                    | JSX runtime、响应式状态、DOM 事件                                                   |
| Todo app       | `pnpm dev:todo`               | 表单输入、keyed list 更新、checkbox 状态、删除                                      |
| Large list     | `pnpm dev:large`              | 10,000 个 keyed rows、定向 class/text 更新                                          |
| Router basic   | `pnpm dev:router`             | beta router、嵌套路由、redirects、guards、lazyRoute、已暴露的 lazy-load-failed 错误 |
| SFC counter    | `pnpm dev:sfc`                | 可选实验性 `.solace` 辅助能力和 Vite plugin                                         |
| DevTools panel | `pnpm dev:devtools-extension` | 浏览器 DevTools extension timeline 示例                                             |

`examples/sfc-counter` 应用演示可选实验性 `.solace` 辅助能力和 Vite plugin。Solace 的主要示例路径仍是 JSX/TSX 函数组件。
在 release note 或 demo 中使用 DevTools panel 前，请先查看 [docs/devtools.md](./docs/devtools.md) 里的 browser extension QA checklist。

运行浏览器 e2e 覆盖：

```bash
pnpm test:e2e
```

示例详情和固定本地端口见 [docs/examples.md](./docs/examples.md)。

## 包入口

公开包结构如下：

- `@italone/solace`：核心运行时 API。
- `@italone/solace/jsx-runtime`：自动 JSX runtime。
- `@italone/solace/jsx-dev-runtime`：开发环境 JSX runtime。
- `@italone/solace/devtools`：扩展示例消费的底层 DevTools listener 和 recorder API。
- `@italone/solace/sfc`：`.solace` imports 的 TypeScript 类型声明入口。
- `@italone/solace/vite`：可选实验性 `.solace` 单文件组件的 Vite plugin。
- `docs/large-app.zh-CN.md`：大型应用的结构、路由、状态、SSR、性能和发布说明。

安装 npm `latest` dist-tag：

```bash
pnpm add @italone/solace
```

安装已发布 beta 线：

```bash
pnpm add @italone/solace@beta
```

如果仓库版本领先于 npm，请使用仓库示例，或参考 [docs/package-usage.md](./docs/package-usage.md) 中的 packed-consumer 冒烟测试。

## 架构

Solace 组织为一条小型运行时管线：

```text
reactivity -> scheduler -> component -> vnode -> renderer -> DOM
```

- `reactivity` 追踪读取，并在写入时触发 effects。
- `scheduler` 批处理组件更新，并暴露 `nextTick`。
- `component` 管理 props、render effects、emit、生命周期、slots 和上下文。
- `vnode` 表示元素、组件、fragments、props、keys 和 children。
- `renderer` 负责挂载、patch、diff、移动和卸载 DOM 节点。
- `event` 通过 invoker 缓存 patch DOM 事件监听器。
- `store` 将响应式状态和 computed getters 组合成轻量状态容器。

完整运行时流程见 [docs/architecture.md](./docs/architecture.md)。

## 性能与验证

Solace 通过冒烟 benchmark 和浏览器生产构建 benchmark 跟踪性能。项目会有意避免对 React、Vue、Svelte 或其他成熟框架作出未经验证的性能宣称。

当前验证包括：

- Vitest 单元测试和集成测试。
- Playwright 浏览器 e2e 测试。
- Rollup ESM、CJS 和类型声明构建。
- 包导出和 packed-consumer 冒烟测试。
- 覆盖率阈值。
- Tinybench jsdom benchmark 冒烟测试。
- 面向 large-list 和 keyed-reorder 场景的 Chromium 生产构建浏览器 benchmark。
- 通过 `pnpm test:e2e` 和 `pnpm test:e2e:devtools-extension` 覆盖浏览器 e2e 与 DevTools
  extension e2e 冒烟。

运行 benchmark 冒烟检查：

```bash
pnpm benchmark
pnpm benchmark:browser
```

当性能宣称需要趋势窗口时，使用 `pnpm benchmark:history`。发布说明或 README 中的性能说法要把最新 browser 样本数、jsdom 样本数和场景名一起写清。当前阈值规则见 [docs/performance.md](./docs/performance.md) 和 [docs/release.md](./docs/release.md)。

在把 benchmark 输出作为 release 信号前，运行 `pnpm performance:regression`，它会检查场景预算和 beta 历史要求（至少 5 次运行且覆盖至少 2 个不同日期）。1.0 evidence checklist 仍然单独要求每个场景覆盖 5 个不同日期。

## 开发

常用命令：

```bash
pnpm format:check
pnpm typecheck
pnpm typecheck:jsxdev
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

运行包消费者冒烟测试：

```bash
pnpm package:smoke
```

运行发布就绪元数据检查：

```bash
pnpm release:readiness
```

发布门禁和发布要求见 [docs/release.md](./docs/release.md)。

## 文档

- [API](./docs/api.zh-CN.md)
- [Architecture](./docs/architecture.md)
- [Examples](./docs/examples.md)
- [Package usage](./docs/package-usage.md)
- [Project status](./docs/project-status.zh-CN.md)
- [Performance](./docs/performance.md)
- [大型应用指南](./docs/large-app.zh-CN.md)
- [Release](./docs/release.md)
- [兼容性与弃用策略](./docs/compatibility.zh-CN.md)
- [DevTools](./docs/devtools.md)
- [Roadmap](./docs/roadmap.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [License](./LICENSE)

## 路线图

当前重点是 JSX/TSX-first runtime ergonomics、函数组件示例、收敛 router beta API、harden DevTools extension、协调 package/version 状态和维护文档质量。SFC/Vite 工作仅限于保持现有可选实验性契约可靠，除非后续通过单独设计明确扩展。

## 贡献

Issue 和 pull request 应保持改动聚焦，并包含与影响范围匹配的验证。对于运行时改动，优先在修改行为前新增或更新测试。对于公共 API 改动，需要同步更新相关文档和包冒烟测试覆盖。

提交 pull request 前，请运行：

```bash
pnpm quality
pnpm release:check
```
