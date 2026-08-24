# API

[简体中文](./api.zh-CN.md)

This document describes the public Solace runtime API. Solace's primary authoring path is
React-style function components with JSX/TSX and explicit runtime APIs. Import runtime features from
the package root, server rendering and SSG from `@italone/solace/server`, JSX support from the JSX
subpaths, and DevTools integration from `@italone/solace/devtools`.

Internal files under `src/**`, generated files under `dist/**`, scheduler queues, shape flags,
component instances, and VNode factory internals are not part of the compatibility contract.

## Public Root Export

The package root exposes the documented runtime surface:

| Area       | APIs                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App        | `createApp`                                                                                                                                                                                                                                                                                            |
| Reactivity | `reactive`, `ref`, `computed`, `effect`, `watch`, `watchEffect`                                                                                                                                                                                                                                        |
| Rendering  | `h`, `render`, `Fragment`, `useStyle`                                                                                                                                                                                                                                                                  |
| Components | `defineComponent`, `defineAsyncComponent`                                                                                                                                                                                                                                                              |
| Context    | `provide`, `inject`                                                                                                                                                                                                                                                                                    |
| Lifecycle  | `onMounted`, `onUpdated`, `onUnmounted`                                                                                                                                                                                                                                                                |
| Scheduler  | `nextTick`                                                                                                                                                                                                                                                                                             |
| Store      | `createStore`                                                                                                                                                                                                                                                                                          |
| Router     | `createRouter`, `createMemoryHistory`, `createWebHistory`, `createWebHashHistory`, `RouterLink`, `RouterView`, `RouterNavigationError`, `RouterHydrationError`, `createRouterSnapshot`, `parseRouterSnapshot`, `serializeRouterSnapshot`, `verifyRouterSnapshot`, `lazyRoute`, `useRouter`, `useRoute` |

Public TypeScript helper types include:

- App and plugins: `App`, `Plugin`, `PluginInstall`, `PluginObject`
- Async components: `AsyncComponentLoader`, `AsyncComponentOptions`, `AsyncComponentSetupResult`,
  `AsyncComponentSource`, `AsyncComponentType`
- Component setup: `ComponentSetupContext`, `EmitFn`, `Slot`, `SlotProps`, `Slots`
- Store: `Store`, `StoreActionsInput`, `StoreContext`, `StoreGetterContext`, `StoreGetters`, `StoreOptions`
- Router: `LazyRouteComponent`, `NavigationGuard`, `NavigationGuardResult`, `RouteComponent`,
  `RouteLocationNormalized`, `RouteLocationRaw`, `RouteRecord`, `Router`, `RouterHistory`,
  `RouterLinkProps`, `RouterOptions`, `RouterScrollBehavior`, `RouterScrollBehaviorResult`,
  `RouterScrollPosition`, `RouterSnapshot`, `RouteRecordIdentity`, `RouterHydrationErrorField`
- VNodes: `AsyncComponentVNodeChildren`, `AsyncVNodeChild`, `AsyncVNodeChildren`, `ComponentProps`,
  `ComponentRender`, `ComponentType`, `ComponentVNodeChildren`, `FragmentType`, `VNode`,
  `VNodeChild`, `VNodeChildren`, `VNodeProps`, `VNodeSlots`, `VNodeType`

## API Layers And Stability

Use Solace through the documented package entries only:

| Entry                              | Stability | Purpose                                                           |
| ---------------------------------- | --------- | ----------------------------------------------------------------- |
| `@italone/solace`                  | Public    | App, reactivity, rendering, function components, scheduler, store |
| `@italone/solace/jsx-runtime`      | Public    | Automatic JSX runtime used by TypeScript and bundlers             |
| `@italone/solace/jsx-dev-runtime`  | Public    | Development JSX runtime used by Vite and JSX dev tooling          |
| `@italone/solace/devtools`         | Public    | Low-level listener and recorder APIs consumed by tooling          |
| `@italone/solace/server`           | Public    | Server rendering, in-memory SSG, and static asset helpers         |
| `@italone/solace/sfc`              | Public    | Optional experimental type shim entry for `.solace` imports       |
| `@italone/solace/vite`             | Public    | Optional experimental Vite plugin for `.solace` components        |
| `src/**`, `dist/**`, deep subpaths | Private   | Internal implementation details, not compatibility targets        |

The beta-line compatibility contract remains intentionally narrow. Documented public entries should
remain usable across patch releases, while internal modules, event emit helpers, scheduler queues,
renderer diagnostics, component instances, and generated file layout can change without notice.

The `.solace` compiler contract is optional, narrow, and experimental. It is limited to the
documented Vite plugin and the `@italone/solace/sfc` type shim, and it is not the primary Solace
component model. The parser, generated JavaScript shape, and internal compiler modules remain
implementation details behind the auxiliary compiler surface. Scoped styles are registered through
the public `useStyle()` runtime helper, but generated module shape and compiler internals are not
compatibility targets. The Vite plugin does not accept public options yet; passing options throws a
`TypeError` so syntax expansion is not implied. SFC block attributes and custom top-level blocks are
rejected; the documented block model remains one `<template>`, optional `<script>`, and optional
`<style>`. Vite transform failures are the public diagnostics surface for invalid `.solace` files,
and the current transform policy intentionally returns `map: null` instead of publishing source
maps. Do not import compiler or router deep subpaths such as `@italone/solace/compiler`,
`@italone/solace/router`, or `@italone/solace/dist/**`.

The router exports in the package root are beta APIs for small SPA examples. Nested route records,
redirects, global `beforeEach` guards, route-level `beforeEnter` guards, route `meta`, route names,
aliases, route props, named locations, memory history, and explicit route lazy components through
`lazyRoute()` are supported. Router scroll behavior through the `scrollBehavior` option is supported
after successful navigations. Auth, permissions, SSR/SSG/hydration router integration, and a
long-term router compatibility policy remain deferred. Passing still-deferred router options throws
a `TypeError` instead of silently widening the beta contract.

Most applications should import from the root package. Use `@italone/solace/server` only from
server-side code. Use JSX subpaths only through `jsxImportSource` or bundler-generated imports. Use
the DevTools subpath only when building instrumentation, examples that need event snapshots, or the
browser DevTools extension example under `examples/devtools-extension`.

For the protected entries, patch-release rules, maturity labels, and migration requirements, see the
[Compatibility and deprecation policy](./compatibility.md). The policy keeps router and async APIs
beta and SFC/Vite APIs experimental without silently removing their documented entry paths.

## Deferred Beta Boundaries

The current public contract intentionally rejects still-deferred integration surfaces instead of
silently accepting options that Solace does not implement. Router auth, permissions,
direct router options on SSR/hydration, out-of-order streaming SSR, Suspense/selective hydration, and
async update scheduling remain outside the beta contract. Sequential streaming SSR through
`renderToStream()` is available as a beta server entry; see its section below. Composable router
readiness, server context, and route
snapshot primitives are available without widening those renderer options. Route `meta` is developer-authored data for
application code and examples; it is not an authentication or permission enforcement mechanism.
Router options or route records that use `auth` or `permissions` fields are rejected with explicit
deferred-boundary errors; use application guards for local UX routing and backend authorization for
enforcement. Public API work that widens any of these boundaries must update README, project-status,
package-usage, package boundary tests, consumer smoke coverage, and the release gate in the same
change.

The first router integration is composable rather than renderer-owned. See the
[router-aware SSR and hydration design](./superpowers/specs/2026-08-14-router-aware-ssr-hydration-design.md)
for the request-scoped memory history, canonical route snapshot, server context, and hydration
verification flow. SSR, SSG, and hydration continue rejecting direct `router` options.

## App

### `createApp(rootComponent)`

Creates an app wrapper around a root component or an already-created VNode.

```tsx
import { createApp } from "@italone/solace";

const App = () => <p>hello</p>;

createApp(App).mount(document.querySelector("#app") as Element);
```

Returns:

- `mount(container: Element): void`
- `hydrate(container: Element, options?: HydrationOptions): void`
- `hydrateAsync(container: Element, options?: HydrationOptions): Promise<void>`
- `provide(key, value): App`
- `use(plugin, ...options): App`

`mount()` creates the root VNode when `rootComponent` is a component function, then renders it into
the target DOM container. `hydrate()` creates the same root VNode but claims matching server-rendered
DOM, attaches event listeners, and lets later reactive updates patch through the normal renderer.
`provide()` registers app-level values before mount or hydration and returns the app for chaining.
Descendant components can read those values with `inject()`, and component-level providers override
app-level values.

```ts
import { createApp } from "@italone/solace";

createApp(App)
  .provide("theme", "dark")
  .mount(document.querySelector("#app") as Element);
```

Hydration is explicit and keeps throw-on-mismatch as the default:

```ts
import { createApp } from "@italone/solace";

createApp(App).hydrate(document.querySelector("#app") as Element);
```

When hydration throws without `recover: true`, the failed root hydration effect is cleaned up before
the error is rethrown, so later reactive changes do not keep retrying a failed server tree.
Use `recover: true` only when the client should deopt a mismatched server tree into a fresh client
render:

```ts
import { createApp } from "@italone/solace";

createApp(App).hydrate(document.querySelector("#app") as Element, { recover: true });
```

Hydration options must be a non-array object. `recover`, when provided, must be a boolean.

`hydrateAsync()` prepares a complete async initial tree before claiming server DOM. Preparation
failure leaves the container untouched. It supports the same mismatch behavior and `{ recover:
true }` deopt as `hydrate()`, then installs normal synchronous component effects for resolved
synchronous render functions.

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

## Server Rendering Subpath

Import SSR and SSG APIs from `@italone/solace/server`:

```ts
import { h } from "@italone/solace";
import {
  createStaticRoutesFromRouter,
  createRouterServerContext,
  generateStaticSite,
  generateStaticSiteAsync,
  renderToStream,
  renderToString,
  renderToStringAsync,
  resolveStaticAssets,
  serializeRouterSnapshot,
} from "@italone/solace/server";

const result = renderToString(h("p", null, "server"));
```

`renderToString(source)` returns `{ html, styles }`. The first server renderer supports synchronous
VNode and function component trees, escapes text and attributes, omits event props from HTML, and
does not run DOM lifecycle hooks. Components can register styles with `useStyle(scopeId, css)`;
server rendering collects them in `styles` as serialized `<style data-s-id="...">...</style>` tags.
Use `createApp(App).hydrate(container)` in the browser to attach behavior to matching server HTML and
reuse existing `style[data-s-id]` tags without duplicating matching styles. Hydration throws on
mismatches by default. `createApp(App).hydrate(container, { recover: true })` catches
`SolaceHydrationError`, replaces the mismatched container contents with the client VNode tree, and
keeps later reactive updates on the normal renderer path. Without `recover: true`, failed hydration
cleans up the root hydration effect before rethrowing the mismatch. Passing deferred integration
options such as `manifest`, `clientEntry`, `router`, or `stream` to `renderToString()` throws a
`TypeError`.
Hydration options must be a non-array object, and `recover` must be boolean when provided.
`renderToString()` context, when provided, must be a plain object.
Hydration options accept only `recover`, and `renderToString()` options accept only `context` and
`provides`; unknown own option fields throw a `TypeError` naming the field.
Async or thenable render trees, including direct sources, SSG route sources, and async child values,
are rejected by the synchronous `renderToString()`, `generateStaticSite()`, `hydrate()`, `render()`,
and `mount()` APIs. Existing synchronous APIs retain their return types; use the explicit async
entries instead of relying on implicit promise widening. Passing deferred `manifest`, `clientEntry`,
`router`, or `stream` fields to `hydrate()` or `hydrateAsync()` is also rejected at runtime.
Hydration mismatch errors include structured `kind`, `path`, `expected`, and `actual` fields so
callers can distinguish missing nodes, extra nodes, element tag mismatches, and text mismatches.

### `renderToStringAsync(source, options?)`

`renderToStringAsync()` buffers the complete initial tree before returning `{ html, styles }`. It
accepts promised roots, async components, promised child VNodes, and the same `context` and
`provides` options as `renderToString()`. Rejections propagate without exposing partial HTML.

```tsx
import { h } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";
import { renderToStringAsync } from "@italone/solace/server";

const AsyncMessage: AsyncComponentType = async () => () => <strong>ready</strong>;
const result = await renderToStringAsync(
  Promise.resolve(h("section", null, [h(AsyncMessage), Promise.resolve(h("i", null, "child"))])),
);
```

Async setup has setup-once semantics during initial preparation. Resolving to a synchronous render
function enables later reactive updates after `hydrateAsync()`; resolving directly to a VNode is a
fixed initial result, and promised children are one-shot values. `provide()`, `inject()`, lifecycle
registration, and `useStyle()` are supported before the first suspension and inside the resolved
synchronous render function. Ambient component-instance APIs in continuation code after `await` are
outside the beta.4 contract. Sequential streaming SSR is available through `renderToStream()`;
out-of-order streaming, direct router options on SSR/hydration, and
Suspense/selective hydration remain deferred; async update scheduling remains deferred.

### `renderToStream(source, options?)`

`renderToStream()` returns a `ReadableStream<Uint8Array>` of UTF-8 HTML for VNodes, component
functions, promised roots, and async components. Unlike the buffered `renderToStringAsync()`, it
does not accept VNodes with promised children — async boundaries must be expressed as async
components (or a promised root), and promised children are rejected with a `TypeError` rather than
awaited. For the sources it supports, byte order is identical to `renderToStringAsync().html`; rendering streams
sequentially, flushing each completed prefix before an unresolved async component is awaited, so
consumers receive earlier markup first. Styles registered with `useStyle()` are emitted inline at
first registration (deduplicated by style id; conflicting registrations for the same id throw), not
collected at the end.

```tsx
import { h } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";
import { renderToStream } from "@italone/solace/server";

const AsyncMessage: AsyncComponentType = async () => () => <strong>ready</strong>;
const stream = renderToStream(h("section", null, h(AsyncMessage)));
return new Response(stream, { headers: { "content-type": "text/html; charset=utf-8" } });
```

Rendering starts eagerly when `renderToStream()` is called; the returned stream does not support
consumer backpressure in this slice. Options accept only `context` and `provides`; unknown own option
fields — including `manifest`, `clientEntry`, and `router` — throw a `TypeError` naming the field.
Render errors reject the stream (the underlying `ReadableStream` errors via `controller.error()`),
which may surface after partial bytes have already been emitted. Out-of-order streaming,
Suspense/selective hydration, direct renderer-owned router options, and consumer backpressure are
not implemented.

### Router-aware SSR and hydration composition

This composable flow provides router-aware SSR and router-aware hydration without adding a router
option to renderer APIs.

`router.isReady()` starts the initial history navigation once and returns the same promise to every
caller. Redirects and global/route guards settle before it resolves. Initial guard cancellation or
navigation failure rejects, while later `push()` and `replace()` keep their existing semantics.

`createRouterServerContext()` creates a fresh `createMemoryHistory(url)` router for one request,
allows synchronous global guard registration through `configure`, waits for readiness, and returns
`{ router, route, snapshot, provides }`. Pass `provides` to the existing renderer; no renderer option
is widened:

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

In the browser, install the router, await `isReady()`, create a client snapshot with the same record
identity callback, and verify before calling `hydrateAsync()`:

```tsx
import {
  createApp,
  createRouterSnapshot,
  parseRouterSnapshot,
  verifyRouterSnapshot,
} from "@italone/solace";

const app = createApp(App).use(router);
await router.isReady();
const serverSnapshot = parseRouterSnapshot(snapshotElement.textContent ?? "");
const clientSnapshot = createRouterSnapshot(router.currentRoute.value, identifyRecord);
verifyRouterSnapshot(serverSnapshot, clientSnapshot);
await app.hydrateAsync(container);
```

Record identities must be non-empty and unique for the matched chain. Snapshot params/query keys are
sorted, query arrays retain item order, and nullish router query inputs remain omitted by the existing
router contract. Serialization escapes script-sensitive characters; parsing rejects malformed,
unknown, or unsupported fields. `RouterHydrationError` reports the first mismatching field. Router
snapshot recovery is application-owned and separate from DOM-only `{ recover: true }`.

### `generateStaticSite(options)`

`generateStaticSite({ routes, shell })` renders explicit route entries through `renderToString()` and
returns `{ pages }`. Each route must have a string path that begins with `/` and is unique, plus a
`source` accepted by `renderToString()`. Optional route-level `provides` values are passed into
rendering and must be a `Map`; optional route `context` is forwarded to the shell and must be a
plain record object.
The shell receives read-only copies of `styles` and `context`, so shell mutations do not feed back
into the returned page metadata. When provided, the shell must return a string.
When app-level `manifest` and `clientEntry` are provided together, `generateStaticSite()` resolves
production asset tags once and passes them to each shell as `assets`. The shell owns placement of
`assets.modulePreloads`, `assets.stylesheets`, collected `styles`, and `assets.scripts`. Supplying
only `manifest` or only `clientEntry` throws a `TypeError`. Route-level `manifest` and `clientEntry`
fields remain rejected.
Passing deferred `manifest`, `clientEntry`, or `router` fields on a route entry is rejected at
runtime to keep the SSG contract narrow.
`generateStaticSite()` options accept only `routes`, `shell`, `manifest`, `clientEntry`, and `base`;
route entries accept only `path`, `source`, `context`, and `provides`. Unknown own option or route
fields throw a `TypeError` naming the field.

```ts
const site = generateStaticSite({
  routes: [{ path: "/", source: h("h1", null, "Home") }],
  shell: ({ body, styles }) =>
    `<!doctype html><html><head>${styles.join("")}</head><body>${body}</body></html>`,
});

site.pages[0].html;
```

### `generateStaticSiteAsync(options)`

`generateStaticSiteAsync()` accepts the same validated SSG options with async route sources. Routes
are awaited sequentially in declaration order, and the complete `{ pages }` result is returned only
after every route and shell call succeeds.

```ts
const site = await generateStaticSiteAsync({
  routes: [
    { path: "/", source: Promise.resolve(h("h1", null, "Home")) },
    { path: "/about", source: async () => () => h("p", null, "About") },
  ],
  shell: ({ body }) => `<!doctype html><body>${body}</body>`,
});
```

Place `styles.join("")` in the document `<head>` when composing a full shell. The first SSG core is
in-memory only. Filesystem output, route crawling, app-level `router`, and CLI integration remain
outside the current public contract.

### `resolveStaticAssets(options)`

`resolveStaticAssets({ manifest, entry, base })` converts a Vite-like production manifest and a
client entry id into complete HTML tag strings. Imported chunks are walked before the entry chunk,
CSS files are deduped in first-seen order, imported JavaScript files become `modulepreload` links,
and the entry file becomes the single module script. `base` defaults to `/` and is normalized to one
trailing slash. `options`, `manifest`, and each manifest chunk must be plain objects or
null-prototype records.

### `createStaticRoutesFromRouter(options)`

`createStaticRoutesFromRouter({ routes, paths })` converts beta router records and explicit concrete
paths into `generateStaticSite()` routes. Each generated route renders the matched component and gets
a default `{ route }` context containing `{ path, fullPath, query, params, matched }`. Optional
`context(route)` shallow-merges after the default context, and optional `provides(route)` is passed
to `renderToString()` for that route. `context(route)` must return a plain record object, and
`provides(route)` must return a `Map`.
Static router records intentionally use a narrower contract than SPA `RouteRecord`: only `path` and
an eager function `component` are accepted. Nested records, redirects, guards, `meta`, lazy route
components, and layout-less `null` components remain deferred for this adapter.

This adapter does not install the router plugin, does not enable `useRoute()` during SSR, does not
render nested `RouterView` trees, and does not crawl or infer dynamic params. Use explicit paths such
as `/users/42`; do not pass `/users/:id` as a path to render. Static paths may include query strings
but must not include hash fragments.

## Runtime Style Registration

Register render-tree styles with `useStyle(scopeId, css)` from the package root:

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

`useStyle(scopeId, css)` must run while rendering a component. During server rendering, the style is
registered in the current `renderToString()` request scope. During browser `mount()` and `hydrate()`,
Solace writes through a document-backed style sink and dedupes existing `style[data-s-id]` tags by
`scopeId`. Reusing the same `scopeId` with different CSS in the same sink is treated as a style
conflict.

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
type ComponentType<
  Props extends object = ComponentProps,
  Events extends ComponentEventMap = ComponentEventMap,
  SlotMap extends object = Slots,
> = (props: Props, context: ComponentSetupContext<Events, SlotMap>) => VNode | (() => VNode);
```

The setup context exposes:

- `emit(event, ...args)` for component events.
- `slots` for default slots, named slots, and slot props.

Components can return a VNode directly or return a render function. Returning a render function is
useful when setup logic should run once and render should run repeatedly. In TSX, children passed
between component tags become `slots.default`, so wrapper components can keep their props focused on
explicit inputs.

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

Component event names resolve to `onXxx` handlers. Kebab-case event names are camelized before the
handler lookup, so `emit("item-change")` can resolve `onItemChange`.

Event typing is opt-in through `ComponentEventMap` and `defineComponent<Props, Events>`. Each event
maps to its argument tuple:

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

Components without an explicit event map remain permissive by default. This contract types events at compile time and does not add runtime validation; explicit event maps infer precise `onXxx` listener payloads in JSX. Listeners accept a function or an array of functions whose arguments match the event tuple. Kebab-case events expose only their canonical camelized listener, so `value-change` maps to `onValueChange`. This JSX inference does not change the existing broad `h()` props contract.

Slot typing is opt-in through `defineComponent<Props, Events, SlotMap>`. A finite slot map types both
component-side consumption and producer calls. A required `default` slot requires JSX children;
components without a declared `default` slot reject JSX children. `h()` accepts direct default
children or an exact slot object, requires declared required slots, and rejects unknown names or
incompatible scoped-slot parameters. JSX has no named-slot attribute syntax in this contract, so use
`h()` when a producer must provide named or scoped slot functions. Components without an explicit
slot map retain the permissive legacy producer contract. These checks do not add runtime slot
metadata or validation.

Typed named slots can also be provided directly in JSX through the `v-slots` prop. Pass a slot
object matching the declared slot map; JSX children still become `slots.default`:

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap, ComponentSetupContext } from "@italone/solace";

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

### `defineComponent(component)`

Declares a Solace component while preserving the function component contract.

```tsx
import { defineComponent } from "@italone/solace";

const Button = defineComponent((props: { label: string }) => <button>{props.label}</button>);
```

### `defineAsyncComponent(loader | options)`

Declares a component that loads another component asynchronously.

```tsx
import { defineAsyncComponent } from "@italone/solace";

const LazyMessage = defineAsyncComponent<{ text: string }>(() =>
  Promise.resolve((props: { text: string }) => <p>{props.text}</p>),
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

Passes values from an ancestor component setup to descendant component setup without prop drilling.
Keys can be strings or symbols. `inject()` searches component ancestors first, then app-level
providers. It returns the supplied default value when no provider exists.

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

### Lifecycle

- `onMounted(hook)`
- `onUpdated(hook)`
- `onUnmounted(hook)`

Lifecycle hooks register during component setup. Calls made outside component setup are ignored.

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

Resolves after queued component updates flush. Use it in tests or integration code when a reactive
mutation should be reflected in the DOM before the next assertion.

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
nested route records, redirects, route names, aliases, route props, global `beforeEach` guards,
route-level `beforeEnter` guards, route `meta`, route lazy components through `lazyRoute()`,
`RouterLink`, `RouterView`, and app installation through `createApp(App).use(router)`.

```tsx
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHistory,
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
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home, alias: "/start" },
    { path: "/users/:id", name: "user", component: User, props: true },
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

Creates a router plugin. `routes` are matched by path. Static routes are prioritized before dynamic
routes, and `/:pathMatch(.*)*` can be used as a wildcard fallback. `router.currentRoute` is a ref
containing `{ path, fullPath, query, params, matched, name }`.
`options` must be a non-array object, and `history` must be a non-array object implementing
`location()`, `push()`, `replace()`, `listen()`, `back()`, and `forward()`. `routes` must be an
array, and route record paths must be strings; invalid options, history adapters, route list, or path
shapes are rejected before matcher compilation. Route record paths must be relative paths and must
not include query strings or hash fragments. Route records must be non-array objects, and route
components must be functions, valid `lazyRoute()` values, or omitted/`null` for layout-less records.
Route redirect strings and object locations are validated against the same route location contract at
router creation time.
Route locations must be strings or non-array objects. Object route locations are limited to
`{ path, query }`, and named locations use `{ name, params, query }`; hash fragments in string or
object-path locations are rejected. Object location `path` values must not include query strings;
use the separate `query` field instead.
String route locations and object location `path` values must be relative paths. Supported path
locations normalize to a leading slash and trim trailing slashes except for `/`. Empty string
locations resolve to `/`. Query strings use repeated keys for arrays, skip nullish object values,
keep `+` as a literal plus sign, and throw a TypeError for malformed percent encoding. String route
locations split path and query at the first `?`, so later `?` characters stay inside query values and
are encoded in the canonical `fullPath`. Object route location query values must be strings, numbers,
booleans, null, undefined, or arrays of those values. Navigating to the current `fullPath`, or to a
route redirect that resolves back to the current `fullPath`, resolves with the current route without
writing a duplicate history entry or running navigation guards.
Object route location `query` containers must be plain record objects; `URLSearchParams`, `Map`,
`Date`, arrays, and other object instances remain outside the beta contract.
Browser history listener updates for the current `fullPath` leave
`currentRoute` unchanged and skip navigation guards after the initial router install settlement.
For nested route matches, redirects are resolved from parent to child before any matched
`beforeEnter` guards run.

Route record names, aliases, and props are part of the public contract. Named locations resolve
through canonical paths, aliases preserve the canonical matched records and route name, and route
props support `true`, plain objects, or functions evaluated from the matched route. When
`props: true`, the router passes a shallow copy of `route.params`.

`router.isReady()` exposes the single initial history settlement promise. Calling it before install
starts settlement; calling it after `app.use(router)` waits for the same operation. It resolves to the
settled `currentRoute.value` after redirects and guards, and remains rejected after an initial
failure. Later explicit navigations are independent.

### `createWebHistory()` / `createWebHashHistory()` / `createMemoryHistory()`

Create browser-backed history adapters. Use `createWebHistory()` for normal path routing and
`createWebHashHistory()` for hash routing. `listen()` notifies each listener when the normalized
location changes, returns an unsubscribe function, and suppresses repeated native events for an
unchanged location. Adapter normalization adds a leading slash, trims trailing slashes from the path
except for `/`, keeps the query string, and rejects relative/absolute URL-like targets or hash
fragments in write targets. `push()` and `replace()` update browser state without invoking listeners
directly.

`createMemoryHistory()` provides the same `RouterHistory` interface with an in-memory stack. It is
deterministic, supports push/replace/back/forward navigation, and is the first-party adapter to use
for non-browser tests and controlled navigation flows.

### `RouterLink` / `RouterView`

`RouterLink` renders an anchor and performs async client navigation for primary unmodified clicks
targeting the current browsing context. Its `href` attribute is rendered from
`router.resolve(to).fullPath` and formatted by the installed first-party history adapter, so
supported string and object locations use the same canonical path and query serialization as
programmatic navigation. `createWebHashHistory()` renders hash hrefs such as
`#/users/42?tab=profile`. Clicks with a modifier, an already prevented event, a non-`_self` target,
or a `download` attribute remain browser-owned.
`RouterView` renders the matched route component for its current nested depth or an empty fragment
when no route matches or a lazy route component is still loading. If a lazy route component fails
to load, the wrapper surfaces `RouterNavigationError` with type `"lazy-load-failed"`. When one
`lazyRoute()` component is reused by multiple route records, that error's `from` and `to` locations
describe the active route at the time of failure, rather than the route where the component first
rendered. If a route redirect function throws or returns a deferred or otherwise invalid location,
navigation rejects with `RouterNavigationError` of type `"redirect-rejected"`; the error's `to`
location is the route whose redirect failed.

Programmatic `router.push()` and `router.replace()` preload `lazyRoute()` components for the target
route before committing the navigation, and a failing loader rejects the navigation promise with
`RouterNavigationError` of type `"lazy-load-failed"` (`from` is the current route, `to` is the
attempted location) while leaving the current route unchanged. Successful preloads are shared with
`RouterView`, so a loader runs at most once per `lazyRoute()` component; the initial route
settlement (`router.isReady()`) still surfaces lazy failures through the render wrapper.

Current beta router limitations:

- No auth, permissions, SSR, SSG, or hydration router integration.
- Dynamic params are limited to simple `:name` segments plus the documented wildcard
  `/:pathMatch(.*)*`; optional params, repeat params, and custom regex params throw a `TypeError`.
- Passing still-deferred options or route record fields such as `auth` or `permissions` throws a
  TypeError.
- Direct URL fallback still depends on the hosting configuration.
- Unknown-route behavior should be handled by an explicit wildcard route.

## JSX

Use JSX/TSX function components as the primary Solace authoring path. Configure the TypeScript
automatic JSX runtime:

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

JSX `key` is a framework-level attribute for keyed children and accepts strings or numbers. It does
not need to be declared on a function component's props type.
JSX component children are routed to the component setup context as `slots.default`; component props
do not need to declare a `children` field for normal slot children. Explicit finite slot maps make
required default children mandatory and reject children when no default slot exists. Named and
scoped producer functions use the typed `h()` slot-object form.
JSX `onXxx` attributes are the component event handler convention used by `emit()`, so
`emit("increment")` resolves `onIncrement` when present. TSX component `onXxx` values are typed as
a function or an array of functions; non-function values are outside the public JSX contract.
DOM `onXxx` attributes accept functions only. JSX fragment shorthand (`<>...</>`) is supported
through the automatic runtime and renders without an extra DOM wrapper.

Public tooling entry points:

- `@italone/solace/sfc`
- `@italone/solace/vite`

These tooling entries are for the optional experimental `.solace` helper path, not the main
component authoring model.

## Vite Plugin Subpath

Import the current optional experimental `.solace` compiler plugin from `@italone/solace/vite`:

```ts
import solace, { solacePlugin } from "@italone/solace/vite";
```

Both the default export and named `solacePlugin` export create the same Vite plugin. The plugin
transforms files ending in `.solace`, returns JavaScript component modules, and leaves all other file
ids untouched. Query-based `.solace?*` transforms are rejected until sub-request semantics are
separately designed. Compiler failures are reported as Vite transform errors that include the
diagnostic code, filename, line, and column when available. This subpath intentionally exports only
`default` and `solacePlugin`; compiler helpers remain private.

## DevTools Subpath

DevTools APIs are intentionally not exported from the package root. Import them from
`@italone/solace/devtools`.

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

See [devtools.md](./devtools.md) for the payload boundary and privacy constraints.
