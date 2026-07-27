# API

[简体中文](./api.zh-CN.md)

This document describes the public Solace runtime API. Import runtime features from the package
root, JSX support from the JSX subpaths, and DevTools integration from `@italone/solace/devtools`.

Internal files under `src/**`, generated files under `dist/**`, scheduler queues, shape flags,
component instances, and VNode factory internals are not part of the compatibility contract.

## Public Root Export

The package root exposes the documented runtime surface:

| Area       | APIs                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| App        | `createApp`                                                                                                     |
| Reactivity | `reactive`, `ref`, `computed`, `effect`, `watch`, `watchEffect`                                                 |
| Rendering  | `h`, `render`, `Fragment`                                                                                       |
| Components | `defineComponent`, `defineAsyncComponent`                                                                       |
| Context    | `provide`, `inject`                                                                                             |
| Lifecycle  | `onMounted`, `onUpdated`, `onUnmounted`                                                                         |
| Scheduler  | `nextTick`                                                                                                      |
| Store      | `createStore`                                                                                                   |
| Router     | `createRouter`, `createWebHistory`, `createWebHashHistory`, `RouterLink`, `RouterView`, `useRouter`, `useRoute` |

Public TypeScript helper types include:

- App and plugins: `App`, `Plugin`, `PluginInstall`, `PluginObject`
- Async components: `AsyncComponentLoader`, `AsyncComponentOptions`, `AsyncComponentSource`
- Component setup: `ComponentSetupContext`, `EmitFn`, `Slot`, `SlotProps`, `Slots`
- Store: `Store`, `StoreActionsInput`, `StoreContext`, `StoreGetterContext`, `StoreGetters`, `StoreOptions`
- Router: `RouteLocationNormalized`, `RouteLocationRaw`, `RouteRecord`, `Router`, `RouterHistory`,
  `RouterLinkProps`, `RouterOptions`
- VNodes: `ComponentProps`, `ComponentRender`, `ComponentType`, `ComponentVNodeChildren`,
  `FragmentType`, `VNode`, `VNodeChild`, `VNodeChildren`, `VNodeProps`, `VNodeSlots`, `VNodeType`

## API Layers And Stability

Use Solace through the documented package entries only:

| Entry                              | Stability | Purpose                                                     |
| ---------------------------------- | --------- | ----------------------------------------------------------- |
| `@italone/solace`                  | Public    | App, reactivity, rendering, components, scheduler, store    |
| `@italone/solace/jsx-runtime`      | Public    | Automatic JSX runtime used by TypeScript and bundlers       |
| `@italone/solace/jsx-dev-runtime`  | Public    | Development JSX runtime used by Vite and JSX dev tooling    |
| `@italone/solace/devtools`         | Public    | Low-level listener and recorder APIs for tooling            |
| `@italone/solace/sfc`              | Public    | Type shim entry for `.solace` single-file component imports |
| `@italone/solace/vite`             | Public    | Vite plugin for alpha `.solace` single-file components      |
| `src/**`, `dist/**`, deep subpaths | Private   | Internal implementation details, not compatibility targets  |

The alpha compatibility contract is intentionally narrow. Public entries should remain usable across
patch releases, while internal modules, event emit helpers, scheduler queues, renderer diagnostics,
component instances, and generated file layout can change without notice.

The `.solace` compiler contract is currently limited to the documented Vite plugin and the
`@italone/solace/sfc` type shim. The parser, generated JavaScript shape, scoped-style implementation,
and internal compiler modules remain alpha implementation details.

The router exports in the package root are beta APIs for small SPA examples. Route guards, nested
route records, scroll behavior, named routes, lazy route loading, SSR integration, auth, permissions,
and a long-term router compatibility policy remain deferred.

Most applications should import from the root package. Use JSX subpaths only through `jsxImportSource`
or bundler-generated imports. Use the DevTools subpath only when building instrumentation or examples
that need event snapshots.

## App

### `createApp(rootComponent)`

Creates an app wrapper around a root component or an already-created VNode.

```ts
import { createApp, h } from "@italone/solace";

const App = () => h("p", null, "hello");

createApp(App).mount(document.querySelector("#app") as Element);
```

Returns:

- `mount(container: Element): void`
- `provide(key, value): App`
- `use(plugin, ...options): App`

`mount()` creates the root VNode when `rootComponent` is a component function, then renders it into
the target DOM container. `provide()` registers app-level values before mount and returns the app for
chaining. Descendant components can read those values with `inject()`, and component-level providers
override app-level values.

```ts
import { createApp } from "@italone/solace";

createApp(App)
  .provide("theme", "dark")
  .mount(document.querySelector("#app") as Element);
```

`use()` installs a plugin once per app instance. A plugin can be a function or an object with an
`install()` method. Options are forwarded after the app argument, and the method returns the app for
chaining.

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

The reactivity package tracks reads while reactive work is running and triggers the matching work on
writes. It is intentionally small: object proxies, ref-like values, cached computed values, effects,
and watchers.

### `reactive(target)`

Wraps an object in a proxy. Reading a property can be tracked by an active effect or component
render. Writing a changed property triggers dependent effects or scheduled component updates.

```ts
import { reactive } from "@italone/solace";

const state = reactive({ count: 0 });
state.count += 1;
```

### `ref(value)`

Creates a reactive value holder with `.value`. Assigning the same value does not trigger dependents.

```ts
import { ref } from "@italone/solace";

const count = ref(0);
count.value += 1;
```

### `computed(getter)`

Returns a readonly ref-like object with `.value`. The getter is lazy and cached until one of its
tracked dependencies changes.

```ts
import { computed, reactive } from "@italone/solace";

const state = reactive({ count: 1 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value);
```

### `effect(fn)`

Runs `fn` immediately and reruns it when tracked dependencies change. It returns a runner function
that can manually execute the effect again.

```ts
import { effect, reactive } from "@italone/solace";

const state = reactive({ count: 0 });
const rerun = effect(() => {
  console.log(state.count);
});

rerun();
```

### `watch(source, callback)`

Observes a getter source. The callback receives the new value and the previous value when the source
result changes. It returns a stop handle.

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

Runs immediately, tracks everything read during the function, reruns when tracked dependencies
change, and returns a stop handle.

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

Creates a VNode for a DOM element, component, or `Fragment`.

```ts
import { h } from "@italone/solace";

h("button", { onClick: save }, "Save");
```

Supported children shapes:

- `string` for text children.
- `VNode` or `VNode[]` for nested rendered children.
- `null` for no children.
- Slot objects for component children.

The renderer reads `props.key` as a string or number key for keyed diffing. Event props use the
`onXxx` convention. For example, `onClick` installs a DOM click listener, and later handler updates
reuse the same cached invoker where possible.

### `render(vnode, container)`

Mounts or patches a VNode into a DOM container. Components that read reactive state are scheduled for
batched updates instead of synchronously patching the DOM for every mutation.

```ts
import { h, render } from "@italone/solace";

render(h(App), document.querySelector("#app") as Element);
```

### `Fragment`

Groups multiple children without an extra DOM wrapper.

```ts
import { Fragment, h } from "@italone/solace";

h(Fragment, null, [h("span", null, "A"), h("span", null, "B")]);
```

## Components

Solace components are functions with this shape:

```ts
type ComponentType<Props extends object = Record<string, unknown>> = (
  props: Props,
  context: ComponentSetupContext,
) => VNode | (() => VNode);
```

The setup context exposes:

- `emit(event, ...args)` for component events.
- `slots` for default slots, named slots, and slot props.

Components can return a VNode directly or return a render function. Returning a render function is
useful when setup logic should run once and render should run repeatedly.

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

Component event names resolve to `onXxx` handlers. Kebab-case event names are camelized before the
handler lookup, so `emit("item-change")` can resolve `onItemChange`.

### `defineComponent(component)`

Declares a Solace component while preserving the function component contract.

```ts
import { defineComponent, h } from "@italone/solace";

const Button = defineComponent((props: { label: string }) => h("button", null, props.label));
```

### `defineAsyncComponent(loader | options)`

Declares a component that loads another component asynchronously.

```ts
import { defineAsyncComponent, h } from "@italone/solace";

const LazyMessage = defineAsyncComponent<{ text: string }>(() =>
  Promise.resolve((props: { text: string }) => h("p", null, props.text)),
);
```

The options form supports:

| Option             | Behavior                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| `loader`           | Returns a promise resolving to the component.                               |
| `loadingComponent` | Rendered while loading after `delay`.                                       |
| `errorComponent`   | Rendered after loader rejection or timeout once retries are exhausted.      |
| `delay`            | Milliseconds before the loading component becomes visible. Defaults to `0`. |
| `timeout`          | Milliseconds before the attempt fails with a timeout error.                 |
| `retry`            | Number of additional attempts after rejection or timeout. Defaults to `0`.  |
| `retryDelay`       | Milliseconds to wait before each retry. Defaults to `0`.                    |

Resolved, loading, and error components receive the latest props and default slot children.

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

Passes values from an ancestor component setup to descendant component setup without prop drilling.
Keys can be strings or symbols. `inject()` searches component ancestors first, then app-level
providers. It returns the supplied default value when no provider exists.

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

### Lifecycle

- `onMounted(hook)`
- `onUpdated(hook)`
- `onUnmounted(hook)`

Lifecycle hooks register during component setup. Calls made outside component setup are ignored.

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

Resolves after queued component updates flush. Use it in tests or integration code when a reactive
mutation should be reflected in the DOM before the next assertion.

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

Creates a small centralized store from a state factory, computed getters, and named actions.

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

Store behavior:

- `state` is reactive and should be created through a factory.
- `getters` are computed values exposed as readonly properties.
- `actions` receive `{ state, getters }` as their first argument.
- Components that read store state or getters rerender through the same scheduler as other reactive
  reads.
- When DevTools listeners are installed, store actions emit small success or error summaries without
  action arguments, results, or raw state.

## Router

The router is a beta package-root API for small single-page examples. It supports static routes,
dynamic params, wildcard fallback records, query parsing/stringifying, browser history adapters,
`RouterLink`, `RouterView`, and app installation through `createApp(App).use(router)`.

```ts
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHistory,
  h,
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
    { path: "/:pathMatch(.*)*", component: () => h("p", null, "not found") },
  ],
});

const App = () => () =>
  h("main", null, [h(RouterLink, { to: "/users/42" }, "User"), h(RouterView)]);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

### `createRouter({ history, routes })`

Creates a router plugin. `routes` are matched by path. Static routes are prioritized before dynamic
routes, and `/:pathMatch(.*)*` can be used as a wildcard fallback. `router.currentRoute` is a ref
containing `{ path, fullPath, query, params, matched }`.

### `createWebHistory()` / `createWebHashHistory()`

Create browser-backed history adapters. Use `createWebHistory()` for normal path routing and
`createWebHashHistory()` for hash routing.

### `RouterLink` / `RouterView`

`RouterLink` renders an anchor and performs client navigation for primary unmodified clicks.
`RouterView` renders the matched route component or an empty fragment when no route matches.

Current beta router limitations:

- No route names, aliases, redirects, nested records, guards, scroll behavior, or lazy component
  loading contract.
- No SSR, SSG, or hydration integration.
- Direct URL fallback still depends on the hosting configuration.
- Unknown-route behavior should be handled by an explicit wildcard route.

## JSX

Use the TypeScript automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

Public JSX entry points:

- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`

Public tooling entry points:

- `@italone/solace/vite`

## Vite Plugin Subpath

Import the alpha `.solace` compiler plugin from `@italone/solace/vite`:

```ts
import solace, { solacePlugin } from "@italone/solace/vite";
```

Both the default export and named `solacePlugin` export create the same Vite plugin. The plugin
transforms files ending in `.solace`, returns JavaScript component modules, and leaves all other file
ids untouched. Compiler failures are reported as Vite transform errors that include the diagnostic
code, filename, line, and column when available.

## DevTools Subpath

DevTools APIs are intentionally not exported from the package root. Import them from
`@italone/solace/devtools`.

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

See [devtools.md](./devtools.md) for the payload boundary and privacy constraints.
