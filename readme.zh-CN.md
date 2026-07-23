# Solace

[English](./readme.md)

Solace 是一个 TypeScript-first 的前端框架，用于构建响应式、组件驱动的 Web 界面。

Solace 聚焦于小型运行时核心：响应式状态、调度渲染、VNode diff、函数式组件、JSX 支持，以及轻量的应用 API。这个项目以可阅读的框架实现为基础，同时配套了接近生产项目的工具链、测试、示例、包导出和发布检查。

## 为什么选择 Solace

- **TypeScript-first 运行时**：源码、公共 API、示例和测试均使用 TypeScript 编写。
- **默认响应式**：`reactive`、`ref`、`computed`、`effect`、`watch` 和 `watchEffect` 都可以从包根入口直接使用。
- **组件渲染管线**：Solace 包含 VNode、DOM 渲染、keyed children diff、Fragment 支持、组件生命周期、props、emit、slots 和异步组件。
- **小而清晰的应用接口**：`createApp()` 提供挂载、插件和应用级依赖注入能力，不需要庞大的框架外壳。
- **JSX 就绪**：内置自动 JSX runtime 入口，适合 Vite 和 TypeScript 项目使用。
- **质量门禁驱动开发**：仓库包含单元测试、集成测试、浏览器 e2e 测试、包消费者冒烟测试、覆盖率检查和 benchmark 冒烟检查。

## 项目状态

Solace 当前处于早期 alpha runtime 阶段。仓库功能可运行，并已经通过本地验证；当前 package metadata 已配置为可公开发布到 npm。

目前可以通过下面的本地开发流程体验框架，也可以在 release 发布后从 npm 安装已发布包。

## Alpha 范围

Solace 当前适合用于学习小型前端运行时、实验响应式渲染，以及在小示例中验证框架实现思路。它还不是 React、Vue、Svelte 或其他成熟生产框架的完整替代品。当前 alpha 不包含 compiler、router、SSR/SSG runtime、hydration、一方 UI 组件、浏览器扩展 DevTools，也不为内部模块提供兼容性承诺。

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

## 最小示例

```ts
import { createApp, h, reactive } from "@italone/solace";

const state = reactive({ count: 0 });

const App = () =>
  h(
    "button",
    {
      onClick: () => {
        state.count += 1;
      },
    },
    `count: ${state.count}`,
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

Solace 保持较小的公共 API 面。包根入口是稳定的运行时入口；`src/**` 下的内部模块和
`dist/**` 下的生成文件都属于实现细节。

### App

- `createApp(rootComponent)`
- `app.mount(container)`
- `app.use(plugin, ...options)`
- `app.provide(key, value)`

`createApp()` 接收组件或已经创建好的 VNode，将其渲染到 DOM 容器中，并返回可链式调用的
app 实例。`app.use()` 可以安装函数插件，也可以安装带 `install()` 方法的对象插件，同一个
插件在每个 app 实例中只会安装一次。`app.provide()` 注册应用级值，后代组件可以通过
`inject()` 读取。

```ts
import { createApp, h } from "@italone/solace";
import type { App, Plugin } from "@italone/solace";

const themePlugin: Plugin = (app: App, theme: string) => {
  app.provide("theme", theme);
};

const AppRoot = () => h("main", null, "Hello Solace");

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

```ts
import { defineComponent, h } from "@italone/solace";
import type { ComponentSetupContext } from "@italone/solace";

const CounterButton = defineComponent(
  (props: { count: number }, { emit, slots }: ComponentSetupContext) =>
    h("button", { onClick: () => emit("increment") }, [
      h("span", null, `count: ${props.count}`),
      h("small", null, slots.default?.() ?? null),
    ]),
);

h(CounterButton, { count: 1, onIncrement: () => console.log("increment") }, "click me");
```

`defineAsyncComponent()` 会包装组件 loader。它支持简单 loader 函数，也支持 options 对象，
其中可以配置 `loadingComponent`、`errorComponent`、`delay`、`timeout`、`retry` 和
`retryDelay`。已解析组件、loading 组件和 error 组件都会接收最新 props 和 slot children。

```ts
import { defineAsyncComponent, h } from "@italone/solace";

const LazyPanel = defineAsyncComponent<{ title: string }>({
  loader: () => import("./panel").then((mod) => mod.Panel),
  loadingComponent: () => h("span", null, "Loading"),
  errorComponent: () => h("strong", null, "Failed"),
  delay: 200,
  timeout: 3000,
  retry: 2,
  retryDelay: 100,
});
```

`provide()` 和 `inject()` 可以在组件树中传递值，避免层层透传 props。组件级 provider 会覆盖
app-level provider。没有找到 key 时，`inject()` 可以返回 `undefined`，也可以返回传入的默认值。
生命周期 hooks 在组件 setup 期间注册，并分别在挂载后、更新后和卸载清理时运行。

```ts
import { defineComponent, h, inject, onMounted, provide } from "@italone/solace";

const ThemeProvider = defineComponent((_props: object, { slots }) => {
  provide("theme", "dark");
  return () => h("section", null, slots.default?.() ?? null);
});

const ThemeLabel = defineComponent(() => {
  const theme = inject("theme", "light");
  onMounted(() => console.log("mounted"));
  return () => h("span", null, `theme: ${theme}`);
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

| 示例          | 命令             | 覆盖范围                                       |
| ------------- | ---------------- | ---------------------------------------------- |
| Basic counter | `pnpm dev`       | JSX runtime、响应式状态、DOM 事件              |
| Todo app      | `pnpm dev:todo`  | 表单输入、keyed list 更新、checkbox 状态、删除 |
| Large list    | `pnpm dev:large` | 10,000 个 keyed rows、定向 class/text 更新     |

运行浏览器 e2e 覆盖：

```bash
pnpm test:e2e
```

示例详情和固定本地端口见 [docs/examples.md](./docs/examples.md)。

## 包入口

计划中的公开包结构如下：

- `@italone/solace`：核心运行时 API。
- `@italone/solace/jsx-runtime`：自动 JSX runtime。
- `@italone/solace/jsx-dev-runtime`：开发环境 JSX runtime。
- `@italone/solace/devtools`：底层 DevTools listener 和 recorder API。

公开发布后可通过以下命令安装：

```bash
pnpm add @italone/solace
```

在正式发布前，请使用仓库示例，或参考 [docs/package-usage.md](./docs/package-usage.md) 中的 packed-consumer 冒烟测试。

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

运行 benchmark 冒烟检查：

```bash
pnpm benchmark
pnpm benchmark:browser
```

方法论、当前本地趋势记录和 benchmark 原则见 [docs/performance.md](./docs/performance.md)。

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
- [Performance](./docs/performance.md)
- [Release](./docs/release.md)
- [DevTools](./docs/devtools.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [License](./LICENSE)

## 路线图

当前重点是运行时稳定性、renderer 性能、包发布就绪度和文档质量。等核心运行时契约稳定后，后续可以继续扩展 compiler tooling、DevTools 集成和生态适配器。

## 贡献

Issue 和 pull request 应保持改动聚焦，并包含与影响范围匹配的验证。对于运行时改动，优先在修改行为前新增或更新测试。对于公共 API 改动，需要同步更新相关文档和包冒烟测试覆盖。

提交 pull request 前，请运行：

```bash
pnpm quality
pnpm release:check
```
