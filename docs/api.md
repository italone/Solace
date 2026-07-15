# API

## Public Root Export

The `solace` package root exposes the stable runtime surface:

- App: `createApp`
- Reactivity: `reactive`, `effect`, `computed`, `ref`, `watch`, `watchEffect`
- Rendering: `h`, `render`, `Fragment`
- Components: `defineComponent`, `defineAsyncComponent`, default slots
- Component context: `provide`, `inject`
- Lifecycle: `onMounted`, `onUpdated`, `onUnmounted`
- Scheduler: `nextTick`
- Store: `createStore`

Public TypeScript types include `App`, `AsyncComponentLoader`, `AsyncComponentOptions`, `AsyncComponentSource`, `ComponentSetupContext`, `EmitFn`, `Slot`, `Slots`, `Store`, `StoreContext`, `StoreGetterContext`, `StoreGetters`, `StoreOptions`, `VNode`, `VNodeProps`, and related component/VNode helper types.

Internal helpers such as scheduler queues, shape flags, component instance setup, and VNode factory internals are not exported from the package root.

## App

### `createApp(rootComponent)`

Creates an app wrapper around a root component or VNode.

```ts
import { createApp, h } from "solace";

const App = () => h("p", null, "hello");

createApp(App).mount(document.querySelector("#app") as Element);
```

Returns:

- `mount(container: Element): void`
- `provide(key, value): App`
- `use(plugin, ...options): App`

Provide an app-level value before mounting. Components can read it with `inject()`, and component-level
providers override app-level values.

```ts
import { createApp } from "solace";

createApp(App)
  .provide("theme", "dark")
  .mount(document.querySelector("#app") as Element);
```

Install a plugin before mounting an app. A plugin can be a function or an object with `install`.
Each plugin is installed once per app instance, and `use()` returns the app for chaining. Plugins can
also call `app.provide()` to expose values to the mounted component tree.

```ts
import { createApp } from "solace";
import type { App, Plugin } from "solace";

const plugin: Plugin = (app: App, option) => {
  app.provide("theme", "dark");
  console.log(app, option);
};

createApp(App)
  .use(plugin, "enabled")
  .mount(document.querySelector("#app") as Element);
```

## Reactivity

### `reactive(target)`

Wraps an object in a reactive proxy.

```ts
const state = reactive({ count: 0 });
state.count += 1;
```

### `effect(fn)`

Runs `fn` immediately and reruns it when tracked dependencies change.

```ts
effect(() => {
  console.log(state.count);
});
```

### `computed(getter)`

Returns a cached ref-like object with readonly `.value`.

```ts
const double = computed(() => state.count * 2);
console.log(double.value);
```

### `ref(value)`

Creates a reactive value holder.

```ts
const count = ref(0);
count.value += 1;
```

### `watch(source, callback)`

Runs `callback` when the source result changes.

```ts
watch(
  () => state.count,
  (value, oldValue) => {
    console.log(value, oldValue);
  },
);
```

### `watchEffect(effect)`

Runs `effect` immediately and reruns it when tracked dependencies change.

```ts
const stop = watchEffect(() => {
  console.log(state.count);
});

stop();
```

## Rendering

### `h(type, props?, children?)`

Creates a VNode for an element, component, or Fragment.

```ts
h("button", { onClick: save }, "Save");
```

### `render(vnode, container)`

Mounts or patches a VNode into a DOM container.

```ts
render(h(App), document.querySelector("#app") as Element);
```

### `Fragment`

Groups multiple children without an extra DOM wrapper.

## Components

Function components receive props and a setup context with `emit` and `slots`.

```ts
import { h } from "solace";
import type { ComponentSetupContext } from "solace";

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

### `defineComponent(component)`

Declares a Solace component while preserving the existing function component contract.

```ts
import { defineComponent, h } from "solace";

const Button = defineComponent((props: { label: string }) => h("button", null, props.label));
```

### `defineAsyncComponent(loader | options)`

Declares a component that loads another component asynchronously. While the loader is pending,
the wrapper renders an empty Fragment or `loadingComponent`. If the loader rejects, it renders
`errorComponent` when provided. Resolved, loading, and error components receive the latest props
and default slot children. Use `delay` to postpone the loading component and `timeout` to enter
the error state when loading takes too long. Use `retry` to make additional attempts after loader
rejection or timeout, and `retryDelay` to wait before each retry.

```ts
import { defineAsyncComponent, h } from "solace";

const LazyMessage = defineAsyncComponent<{ text: string }>(() =>
  Promise.resolve((props: { text: string }) => h("p", null, props.text)),
);

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

Passes values from an ancestor component setup to descendant component setup without prop drilling.

```ts
import { h, inject, provide } from "solace";

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

### Lifecycle

- `onMounted(hook)`
- `onUpdated(hook)`
- `onUnmounted(hook)`

Lifecycle hooks register during component setup.

## Scheduler

### `nextTick()`

Resolves after queued component updates flush.

```ts
state.count += 1;
await nextTick();
```

## Store

### `createStore({ state, getters, actions })`

Creates a small centralized store.

```ts
import { createStore } from "solace";
import type { StoreContext, StoreGetterContext } from "solace";

const store = createStore({
  state: () => ({ count: 0 }),
  getters: {
    double({ state }: StoreGetterContext<{ count: number }>) {
      return state.count * 2;
    },
  },
  actions: {
    increment({ state }: StoreContext<{ count: number }, { double: number }>, amount: number) {
      state.count += amount;
    },
  },
});

store.actions.increment(1);
console.log(store.getters.double);
```

## JSX

Use TypeScript automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "solace"
  }
}
```

Public JSX entry points:

- `solace/jsx-runtime`
- `solace/jsx-dev-runtime`
