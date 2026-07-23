# API

[English](./api.md)

本文档描述 Solace 的公共运行时 API。运行时能力从包根入口导入，JSX 支持从 JSX 子路径导入，DevTools 集成从 `@italone/solace/devtools` 导入。

`src/**` 下的内部文件、`dist/**` 下的生成文件、scheduler 队列、shape flags、组件实例和 VNode factory 内部实现都不属于兼容性契约。

## 公共根入口

包根入口暴露稳定运行时能力：

| 领域       | API                                                             |
| ---------- | --------------------------------------------------------------- |
| App        | `createApp`                                                     |
| Reactivity | `reactive`、`ref`、`computed`、`effect`、`watch`、`watchEffect` |
| Rendering  | `h`、`render`、`Fragment`                                       |
| Components | `defineComponent`、`defineAsyncComponent`                       |
| Context    | `provide`、`inject`                                             |
| Lifecycle  | `onMounted`、`onUpdated`、`onUnmounted`                         |
| Scheduler  | `nextTick`                                                      |
| Store      | `createStore`                                                   |

公共 TypeScript 辅助类型包括：

- App 和插件：`App`、`Plugin`、`PluginInstall`、`PluginObject`
- 异步组件：`AsyncComponentLoader`、`AsyncComponentOptions`、`AsyncComponentSource`
- 组件 setup：`ComponentSetupContext`、`EmitFn`、`Slot`、`SlotProps`、`Slots`
- Store：`Store`、`StoreActionsInput`、`StoreContext`、`StoreGetterContext`、`StoreGetters`、`StoreOptions`
- VNode：`ComponentProps`、`ComponentRender`、`ComponentType`、`ComponentVNodeChildren`、`FragmentType`、`VNode`、`VNodeChild`、`VNodeChildren`、`VNodeProps`、`VNodeSlots`、`VNodeType`

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
- `provide(key, value): App`
- `use(plugin, ...options): App`

当 `rootComponent` 是组件函数时，`mount()` 会先创建 root VNode，再渲染到目标 DOM 容器。
`provide()` 在 mount 前注册 app-level value，并返回 app 以支持链式调用。后代组件可以通过
`inject()` 读取这些值，组件级 provider 会覆盖 app-level provider。

```ts
import { createApp } from "@italone/solace";

createApp(App)
  .provide("theme", "dark")
  .mount(document.querySelector("#app") as Element);
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

## DevTools 子路径

DevTools API 有意不从包根入口导出。请从 `@italone/solace/devtools` 导入。

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

payload 边界和隐私约束见 [devtools.md](./devtools.md)。
