# Solace

[简体中文](./readme.zh-CN.md)

Solace is a JSX/TSX-first, TypeScript-first frontend framework for building reactive, component-driven web interfaces.

Solace focuses on a small runtime core: reactive state, scheduled rendering, VNode diffing, function components, JSX/TSX authoring, and explicit application APIs. The project is designed as a readable independent framework implementation with production-style tooling, tests, examples, package exports, and release checks.

## Why Solace

- **TypeScript-first runtime**: the source, public API, examples, and tests are written in TypeScript.
- **Reactive by default**: `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are available from the package root.
- **Function component pipeline**: Solace includes VNodes, DOM rendering, keyed children diffing, Fragment support, function components, lifecycle hooks, props, emit, slots, and async components.
- **Small app surface**: `createApp()` provides mounting, plugins, and app-level dependency injection without requiring a large framework shell.
- **JSX/TSX-first**: automatic JSX runtime entries are the primary authoring path for Vite and TypeScript projects.
- **Quality-gated development**: the repository includes unit tests, integration tests, browser e2e tests, package consumer smoke tests, coverage, and benchmark smoke checks.

## Project Status

Solace is currently on the `0.1.0` beta line. This repository package build is the published
`0.1.0-beta.5` release. npm `latest` remains `0.0.5`, and npm `beta` is
`0.1.0-beta.5`. The beta.5 release adds typed JSX/TSX component contracts, broader adoption
gates, and composable router-aware SSR/hydration primitives without adding streaming or direct
renderer-owned router options. Post-release hardening on `main` strengthened the JSX typed
named-slot contract, router stable-slice edge coverage, DevTools store action timeline and QA
checklists, and benchmark history evidence without widening the beta contract.

Use the local development workflow below to explore the framework. Install the default npm package
when you want the latest stable line, install `@italone/solace@beta` when you want the beta line, and
use the repository directly when you need unreleased documentation or runtime changes from `main`.

Current completion highlights:

- Runtime APIs for apps, reactivity, rendering, function components, context, lifecycle, scheduler,
  store, JSX/TSX, buffered async initial SSR/hydration, sequential async SSG, runtime style
  registration, and DevTools integration are implemented behind documented public entry points.
- Package outputs include ESM, CJS, TypeScript declarations, JSX runtime subpaths, `@italone/solace/server`, and the `@italone/solace/devtools` subpath.
- `.solace` SFC support remains available as an optional, narrow, experimental helper through `@italone/solace/vite` and `@italone/solace/sfc`; it is not the primary Solace authoring model.
- The repository includes an example browser DevTools timeline panel that consumes the public DevTools subpath without changing runtime payloads.
- Validation covers format, typecheck, lint, unit tests, integration tests, package export tests, coverage thresholds, packed-consumer smoke tests, jsdom benchmarks, Chromium production browser benchmarks, and browser e2e tests.
- Release publishing remains a separate maintainer decision. npm `latest` and npm `beta` may point
  to different maturity lines.

See [docs/project-status.md](./docs/project-status.md) for the current completion map and release boundary.

## Current Scope

Solace is suitable today for studying a compact JSX/TSX-first frontend runtime, experimenting with
reactive rendering, and validating framework implementation ideas in small examples. It is not yet
positioned as a full replacement for React, Vue, Svelte, or other mature production frameworks. The
beta line includes buffered async initial rendering through `renderToStringAsync()`, sequential
in-memory SSG through `generateStaticSiteAsync()`, and prepare-then-commit browser hydration through
`hydrateAsync()`. Router-aware SSR/hydration is available through explicit readiness, server-context,
and snapshot composition. Streaming SSR, direct renderer-owned router options, async update scheduling after initial
hydration, first-party UI components, production DevTools distribution, and compatibility guarantees
for internal modules remain outside the frozen production contract.

## Public Contract Gate

Public API changes should keep README, project-status, API, package-usage, package exports, and
consumer smoke coverage aligned before release. The beta contract now exposes composable
router-aware SSR and router-aware hydration through `router.isReady()`, canonical snapshots, and
`createRouterServerContext()`. It still defers auth, permissions, direct renderer-owned router
options, streaming SSR, Suspense/selective hydration, and async update scheduling after initial
hydration.
Router `auth` and `permissions` options or route record fields are explicitly rejected instead of
being treated as implicit client authorization.
SSR, hydration, and SSG option objects also reject unknown own fields with a field-specific
`TypeError` instead of silently accepting misspelled configuration.

For the `0.1.x` compatibility line, see the [Compatibility and deprecation policy](./docs/compatibility.md)
before relying on a package entry, planning a migration, or documenting a release. It protects the
eight published export paths while keeping router and async behavior beta and SFC/Vite behavior
experimental.

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

The full release check includes `pnpm test:e2e` and `pnpm test:e2e:devtools-extension` so regular
browser examples and the DevTools extension smoke stay aligned before release notes or publishing.

## Minimal Example

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
- `app.hydrate(container, options?)`
- `app.hydrateAsync(container, options?)`
- `app.use(plugin, ...options)`
- `app.provide(key, value)`

`createApp()` accepts a component or an already-created VNode, renders it into a DOM container, or
hydrates matching server-rendered DOM. Hydration throws on mismatches by default; pass
`{ recover: true }` to explicitly replace mismatched server DOM with the client tree. It returns a
chainable app instance. `app.use()` installs function plugins or object plugins with an `install()`
method once per app instance. `app.provide()` registers app-level values that descendants can read
with `inject()`.

Use `renderToStringAsync()` and `generateStaticSiteAsync()` from `@italone/solace/server` for
promised roots, async components, and promised child VNodes. Existing synchronous APIs keep their
synchronous return types and reject unresolved async values.

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

`defineAsyncComponent()` wraps a component loader. It supports a simple loader function or an
options object with `loadingComponent`, `errorComponent`, `delay`, `timeout`, `retry`, and
`retryDelay`. Resolved, loading, and error components receive the latest props and slot children.

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

Typed named slots can be provided directly in JSX through the `v-slots` prop when a component
declares a slot map through `defineComponent<Props, Events, SlotMap>`:

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

See [docs/api.md](./docs/api.md) for the full typed slot, typed event, and generic component
contract, including `h()` slot-object rules.

`provide()` and `inject()` pass values through the component tree without prop drilling. Component
providers override app-level providers. `inject()` can return `undefined` or a supplied default when
the key is not found. Lifecycle hooks are registered during component setup and run after mount,
after update, and during unmount cleanup.

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

| Example        | Command                       | Coverage                                                                              |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| Basic counter  | `pnpm dev`                    | JSX runtime, reactive state, DOM events                                               |
| Todo app       | `pnpm dev:todo`               | form input, keyed list updates, checkbox state, deletion                              |
| Large list     | `pnpm dev:large`              | 10,000 keyed rows, targeted class/text updates                                        |
| Router basic   | `pnpm dev:router`             | beta router, nested routes, redirects, guards, lazyRoute, surfaced lazy-load failures |
| SFC counter    | `pnpm dev:sfc`                | optional experimental `.solace` helper and Vite plugin                                |
| DevTools panel | `pnpm dev:devtools-extension` | browser DevTools extension timeline example                                           |

The `examples/sfc-counter` app demonstrates the optional experimental `.solace` helper and Vite plugin. Solace's primary example path remains JSX/TSX function components.
Before using the DevTools panel in a release note or demo, follow the browser extension QA checklist in [docs/devtools.md](./docs/devtools.md).

Run browser e2e coverage:

```bash
pnpm test:e2e
```

See [docs/examples.md](./docs/examples.md) for example details and fixed local ports.

## Package Entries

The public package shape is:

- `@italone/solace`: core runtime APIs.
- `@italone/solace/jsx-runtime`: automatic JSX runtime.
- `@italone/solace/jsx-dev-runtime`: development JSX runtime.
- `@italone/solace/devtools`: low-level DevTools listener and recorder APIs used by the extension example.
- `@italone/solace/sfc`: TypeScript type shim for `.solace` imports.
- `@italone/solace/vite`: Vite plugin for optional experimental `.solace` single-file components.
- `docs/large-app.md`: large-app structure, routing, state, SSR, performance, and release notes.

Install the npm `latest` dist-tag with:

```bash
pnpm add @italone/solace
```

Install the published beta line with:

```bash
pnpm add @italone/solace@beta
```

If the repository version is ahead of npm, use the repository examples or the packed-consumer smoke test described in [docs/package-usage.md](./docs/package-usage.md).

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
- Browser e2e and DevTools extension e2e smoke through `pnpm test:e2e` and
  `pnpm test:e2e:devtools-extension`.

Run benchmark smoke checks:

```bash
pnpm benchmark
pnpm benchmark:browser
```

Use `pnpm benchmark:history` when a performance claim needs a trend window. Keep the latest browser sample count, jsdom sample count, and scenario names together with any release note or README claim. For the current threshold rules, see [docs/performance.md](./docs/performance.md) and [docs/release.md](./docs/release.md).

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
- [Project status](./docs/project-status.md)
- [Performance](./docs/performance.md)
- [Large app guide](./docs/large-app.md)
- [Release](./docs/release.md)
- [Compatibility and deprecation policy](./docs/compatibility.md)
- [DevTools](./docs/devtools.md)
- [Roadmap](./docs/roadmap.md)
- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [License](./LICENSE)

## Roadmap

The current focus is JSX/TSX-first runtime ergonomics, function component examples, router beta API narrowing, DevTools extension hardening, package/version coordination, and documentation quality. SFC/Vite work is limited to keeping the existing optional experimental contract reliable unless a separate design explicitly expands it.

## Contributing

Issues and pull requests should keep changes focused and include validation that matches the affected area. For runtime changes, prefer adding or updating tests before changing behavior. For public API changes, update the relevant documentation and package smoke coverage.

Before opening a pull request, run:

```bash
pnpm quality
pnpm release:check
```
