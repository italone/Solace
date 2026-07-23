# Solace

[简体中文](./readme.zh-CN.md)

Solace is a TypeScript-first frontend framework for building reactive, component-driven web interfaces.

Solace focuses on a small runtime core: reactive state, scheduled rendering, VNode diffing, functional components, JSX support, and a lightweight application API. The project is designed as a readable framework implementation with production-style tooling, tests, examples, package exports, and release checks.

## Why Solace

- **TypeScript-first runtime**: the source, public API, examples, and tests are written in TypeScript.
- **Reactive by default**: `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are available from the package root.
- **Component rendering pipeline**: Solace includes VNodes, DOM rendering, keyed children diffing, Fragment support, component lifecycle hooks, props, emit, slots, and async components.
- **Small app surface**: `createApp()` provides mounting, plugins, and app-level dependency injection without requiring a large framework shell.
- **JSX-ready**: automatic JSX runtime entries are included for Vite and TypeScript projects.
- **Quality-gated development**: the repository includes unit tests, integration tests, browser e2e tests, package consumer smoke tests, coverage, and benchmark smoke checks.

## Project Status

Solace is currently an early alpha runtime. The repository is functional and validated locally, but the npm package is intentionally not publishable while `package.json` keeps `"private": true`.

Use the local development workflow below to explore the framework today. The package installation command becomes valid after the maintainer explicitly enables public publishing.

## Alpha Scope

Solace is suitable today for studying a compact frontend runtime, experimenting with reactive rendering, and validating framework implementation ideas in small examples. It is not yet positioned as a full replacement for React, Vue, Svelte, or other mature production frameworks. The current alpha does not include a compiler, router, SSR/SSG runtime, hydration, first-party UI components, browser extension DevTools, or a compatibility guarantee for internal modules.

## Quick Start

Clone the repository and install dependencies:

```bash
pnpm install
```

Run the default example:

```bash
pnpm dev
```

Run the main quality gate:

```bash
pnpm quality
```

Run the full release check before publishing decisions:

```bash
pnpm release:check
```

## Minimal Example

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

## JSX Example

Configure TypeScript:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

Write a component:

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

## Core APIs

Solace keeps its public API small. The package root is the stable runtime entry point; internal
modules under `src/**` and generated files under `dist/**` are implementation details.

### App

- `createApp(rootComponent)`
- `app.mount(container)`
- `app.use(plugin, ...options)`
- `app.provide(key, value)`

`createApp()` accepts a component or an already-created VNode, renders it into a DOM container, and
returns a chainable app instance. `app.use()` installs function plugins or object plugins with an
`install()` method once per app instance. `app.provide()` registers app-level values that descendants
can read with `inject()`.

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

The reactivity system tracks property reads and triggers dependent work on writes. `reactive()`
wraps an object in a proxy. `ref()` stores primitive or object values behind `.value`. `computed()`
is lazy and cached until one of its tracked dependencies changes. `effect()` runs immediately and
reruns when tracked dependencies update. `watch()` observes a getter source and receives the new and
old values. `watchEffect()` runs immediately and returns a stop handle, as does `watch()`.

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

`h()` creates VNodes for DOM elements, components, and fragments. Element props use the same
`onXxx` event convention shown in examples, so `onClick` maps to a DOM click listener. `render()`
mounts or patches a VNode tree into a container. `Fragment` groups children without adding an extra
DOM wrapper. VNodes support string children, array children, keyed children, and component slot
objects.

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

Solace components are functions that receive `props` and a setup context. A component can return a
VNode directly or return a render function. The setup context exposes `emit` for component events and
`slots` for default or named slots. `defineComponent()` preserves the same function component
contract while improving intent and type inference at declaration sites.

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

`defineAsyncComponent()` wraps a component loader. It supports a simple loader function or an
options object with `loadingComponent`, `errorComponent`, `delay`, `timeout`, `retry`, and
`retryDelay`. Resolved, loading, and error components receive the latest props and slot children.

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

`provide()` and `inject()` pass values through the component tree without prop drilling. Component
providers override app-level providers. `inject()` can return `undefined` or a supplied default when
the key is not found. Lifecycle hooks are registered during component setup and run after mount,
after update, and during unmount cleanup.

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

`createStore()` composes `reactive()` state, `computed()` getters, and named actions into a small
centralized state container. State is created through a factory, getters are exposed as readonly
derived values, and actions receive a context with `state` and `getters`.

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

### Scheduler And Types

- `nextTick()`
- Public TypeScript helper types

`nextTick()` resolves after queued component updates have flushed, which is useful when a test or
integration needs to observe DOM after a reactive update. The root package also exports public
TypeScript types for apps, plugins, async components, component setup context, emit functions,
slots, stores, VNodes, props, and render helpers.

```ts
import { nextTick } from "@italone/solace";

state.count += 1;
await nextTick();
```

See [docs/api.md](./docs/api.md) for public API details and examples.

## Examples

Solace includes Vite examples that exercise different runtime paths:

| Example       | Command          | Coverage                                                 |
| ------------- | ---------------- | -------------------------------------------------------- |
| Basic counter | `pnpm dev`       | JSX runtime, reactive state, DOM events                  |
| Todo app      | `pnpm dev:todo`  | form input, keyed list updates, checkbox state, deletion |
| Large list    | `pnpm dev:large` | 10,000 keyed rows, targeted class/text updates           |

Run browser e2e coverage:

```bash
pnpm test:e2e
```

See [docs/examples.md](./docs/examples.md) for example details and fixed local ports.

## Package Entries

The planned public package shape is:

- `@italone/solace`: core runtime APIs.
- `@italone/solace/jsx-runtime`: automatic JSX runtime.
- `@italone/solace/jsx-dev-runtime`: development JSX runtime.
- `@italone/solace/devtools`: low-level DevTools listener and recorder APIs.

After public release, install with:

```bash
pnpm add @italone/solace
```

Until then, use the repository examples or the packed-consumer smoke test described in [docs/package-usage.md](./docs/package-usage.md).

## Architecture

Solace is organized as a small runtime pipeline:

```text
reactivity -> scheduler -> component -> vnode -> renderer -> DOM
```

- `reactivity` tracks reads and triggers effects on writes.
- `scheduler` batches component updates and exposes `nextTick`.
- `component` owns props, render effects, emit, lifecycle hooks, slots, and context.
- `vnode` represents elements, components, fragments, props, keys, and children.
- `renderer` mounts, patches, diffs, moves, and unmounts DOM nodes.
- `event` patches DOM listeners through invoker caching.
- `store` composes reactive state and computed getters into a lightweight state container.

See [docs/architecture.md](./docs/architecture.md) for the full runtime flow.

## Performance And Validation

Solace tracks performance through smoke benchmarks and browser production benchmarks. The project intentionally avoids unverified claims against React, Vue, Svelte, or other mature frameworks.

Current validation includes:

- Vitest unit and integration tests.
- Playwright browser e2e tests.
- Rollup ESM, CJS, and type declaration builds.
- Package export and packed-consumer smoke tests.
- Coverage thresholds.
- Tinybench jsdom benchmark smoke tests.
- Chromium production browser benchmark for large-list and keyed-reorder scenarios.

Run benchmark smoke checks:

```bash
pnpm benchmark
pnpm benchmark:browser
```

See [docs/performance.md](./docs/performance.md) for methodology, current local trend notes, and benchmark principles.

## Development

Common commands:

```bash
pnpm format:check
pnpm typecheck
pnpm typecheck:jsxdev
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

Run the package consumer smoke test:

```bash
pnpm package:smoke
```

Run the release readiness metadata check:

```bash
pnpm release:readiness
```

See [docs/release.md](./docs/release.md) for release gates and publishing requirements.

## Documentation

- [API](./docs/api.md)
- [Architecture](./docs/architecture.md)
- [Examples](./docs/examples.md)
- [Package usage](./docs/package-usage.md)
- [Performance](./docs/performance.md)
- [Release](./docs/release.md)
- [DevTools](./docs/devtools.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [License](./LICENSE)

## Roadmap

The current focus is runtime stability, renderer performance, package readiness, and documentation quality. Future work can expand around compiler tooling, DevTools integration, and ecosystem adapters after the core runtime contract is stable.

## Contributing

Issues and pull requests should keep changes focused and include validation that matches the affected area. For runtime changes, prefer adding or updating tests before changing behavior. For public API changes, update the relevant documentation and package smoke coverage.

Before opening a pull request, run:

```bash
pnpm quality
pnpm release:check
```
