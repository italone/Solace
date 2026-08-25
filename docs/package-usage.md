# Package Usage

## Install

Solace is published as a public npm package:

```bash
pnpm add @italone/solace
```

Install the published beta line with:

```bash
pnpm add @italone/solace@beta
```

npm `latest` currently points to the stable `@italone/solace@0.0.5` line; npm `beta` is the beta
install line. Run `npm view @italone/solace dist-tags --json` before treating the repository state,
npm `latest`, and npm `beta` as interchangeable.

Before preparing another release, run `pnpm release:readiness -- --publishable` to check package
metadata, public access configuration, and local Git synchronization. Run `pnpm package:smoke`
separately to validate package consumption with the packed-consumer smoke test described below.

## Import Runtime APIs

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

## Use JSX

Configure TypeScript with the Solace JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace"
  }
}
```

Then write components with JSX:

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

JSX `key` is available as a framework-level attribute for keyed children:

```tsx
const names = ["Ada", "Grace"];

const NameList = () => (
  <ul>
    {names.map((name) => (
      <li key={name}>{name}</li>
    ))}
  </ul>
);
```

Fragment shorthand works without adding a wrapper element:

```tsx
const Toolbar = () => (
  <>
    <button type="button">Save</button>
    <button type="button">Cancel</button>
  </>
);
```

Children passed to a function component become the component's default slot:

```tsx
import type { ComponentSetupContext } from "@italone/solace";

const Panel = (_props: object, { slots }: ComponentSetupContext) => (
  <section>{slots.default?.()}</section>
);

const App = () => (
  <Panel>
    <p>Inside</p>
  </Panel>
);
```

Component events use `emit()` with `onXxx` JSX handlers:

Declare typed event producers with `defineComponent<Props, Events>`:

For typed slots, use `defineComponent<Props, Events, SlotMap>`. Required/default slot presence is
checked in JSX, while named and scoped producer functions use `h(Component, props, slotObject)`.
Finite maps reject unknown slot names and incompatible scoped props. Omitting `SlotMap` preserves the
existing permissive behavior, and runtime slot normalization is unchanged.

```tsx
import { defineComponent } from "@italone/solace";
import type { ComponentEventMap } from "@italone/solace";

type CounterEvents = {
  increment: [count: number];
  "value-change": [value: number];
  reset: [];
};

const CounterButton = defineComponent<{ count: number }, CounterEvents>((props, { emit }) => (
  <button onClick={() => emit("increment", props.count)}>count: {props.count}</button>
));

const App = () => (
  <CounterButton
    count={1}
    onIncrement={(count: number) => console.log(count)}
    onValueChange={(value: number) => console.log(value)}
  />
);
```

`ComponentEventMap` is opt-in: components with no explicit event map remain permissive by default. It constrains the component's `emit()` calls at compile time and does not add runtime validation; explicit event maps infer precise `onXxx` listener payloads in JSX. Each listener accepts a function or an array of functions whose arguments match the event tuple; kebab-case events expose only their canonical camelized listener. This inference does not change the existing broad `h()` props contract.

DOM `onXxx` handlers accept functions only.

## Use `.solace` Single-File Components

Solace's primary authoring path is JSX/TSX function components through the package root and JSX
runtime entries. The `.solace` path is an optional, narrow, experimental helper for projects that
want to exercise the compiler and Vite plugin pipeline without making SFCs the framework's main
identity.

The `@italone/solace/vite` entry exposes the current experimental Vite plugin for `.solace` files:

```ts
import { defineConfig } from "vite";
import solace from "@italone/solace/vite";

export default defineConfig({
  plugins: [solace()],
});
```

Current `.solace` files support one `<template>`, optional `<script>`, and optional `<style>` block.
Template expressions use JSX-like braces and runtime identifiers from the script block:

```solace
<template>
  <button class="counter" onClick={increment}>
    count: {count.value}
  </button>
</template>

<script>
  import { ref } from "@italone/solace";
  const count = ref(0);
  const increment = () => count.value++;
</script>

<style>
  .counter { color: blue; }
</style>
```

The public SFC contract is intentionally narrow and experimental: use `@italone/solace/vite` as the
Vite plugin and `@italone/solace/sfc` as the TypeScript type shim for `.solace` imports. The
compiler remains an auxiliary compiler surface, not a mature compiler contract or the primary Solace
component model. It supports a small syntax subset, reports compile diagnostics through Vite
transform errors, routes scoped styles through the public `useStyle()` runtime helper, and currently
returns `map: null` because source maps are not part of the current contract. Parser internals,
generated module shape, and scoped-style implementation details are not public compatibility
targets. The plugin does not accept public options yet; passing options throws a `TypeError`. SFC
query transforms such as `.solace?raw` are rejected until sub-request semantics are designed. SFC
block attributes and custom top-level blocks also throw so the syntax remains the documented
one-template, optional-script, optional-style model. The `@italone/solace/vite` subpath
intentionally exports only `default` and `solacePlugin`; do not import compiler helpers or deep
subpaths such as `@italone/solace/compiler`, `@italone/solace/router`, or
`@italone/solace/dist/**`.

## Use Server Rendering And SSG

The server entry is `@italone/solace/server`:

```ts
import { h, useStyle } from "@italone/solace";
import {
  createRouterServerContext,
  createStaticRoutesFromRouter,
  generateStaticSite,
  generateStaticSiteAsync,
  renderToStream,
  renderToString,
  renderToStringAsync,
  resolveStaticAssets,
  serializeRouterSnapshot,
} from "@italone/solace/server";

const App = () => {
  useStyle("server-demo", ".server-demo { color: blue; }");
  return h("p", { class: "server-demo" }, "server");
};

const result = renderToString(h(App));
result.html;
result.styles; // ['<style data-s-id="server-demo">.server-demo { color: blue; }</style>']
```

Use `createApp(App).hydrate(container)` in the browser to attach behavior to matching server HTML.
Hydration reuses existing `style[data-s-id]` tags for matching `useStyle()` registrations and throws
on structural mismatches by default. Pass `{ recover: true }` to explicitly replace mismatched
server DOM with the client VNode tree while keeping later reactive updates on the normal renderer
path. Without `{ recover: true }`, failed hydration cleans up the root hydration effect before
rethrowing the mismatch. Passing deferred integration options such as `manifest`, `clientEntry`,
`router`, or `stream` to `renderToString()` throws a `TypeError`, and `hydrate()` rejects matching
manifest/router/streaming integration fields at runtime.
Hydration options must be a non-array object, and `recover` must be boolean when provided.
`renderToString()` context, when provided, must be a plain object.
Hydration options accept only `recover`, and `renderToString()` options accept only `context` and
`provides`; unknown own option fields throw a `TypeError` naming the field.
Hydration mismatch errors expose stable path information plus `kind`, `expected`, and `actual`
fields so missing nodes, extra nodes, element tag mismatches, and text mismatches can be diagnosed
without guessing from a single message string.

The buffered async server entries are `renderToStringAsync()` and `generateStaticSiteAsync()`. They
accept promised roots, async components, and VNodes with promised children. The buffered browser
hydration entry is `createApp(source).hydrateAsync(container)`. `hydrateAsync()` supports async
components and VNodes with promised children; `createApp()` accepts the source directly, not a
promised root. Async SSG routes run sequentially in declaration order. Async hydration prepares the
full tree before touching server DOM, then preserves node identity when the markup matches.
Preparation rejection leaves the container untouched.

```tsx
import { createApp, h, reactive } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";
import { generateStaticSiteAsync, renderToStringAsync } from "@italone/solace/server";

const state = reactive({ count: 0 });
const AsyncCounter: AsyncComponentType = async () => {
  await Promise.resolve();
  return () => h("button", { onClick: () => (state.count += 1) }, `count: ${state.count}`);
};

const rendered = await renderToStringAsync(AsyncCounter);
const site = await generateStaticSiteAsync({
  routes: [{ path: "/", source: Promise.resolve(h("h1", null, "Home")) }],
});
await createApp(AsyncCounter).hydrateAsync(document.querySelector("#app") as Element);
```

CommonJS consumers can await the server entries in an async IIFE:

```js
const { h } = require("@italone/solace");
const { generateStaticSiteAsync, renderToStringAsync } = require("@italone/solace/server");

(async () => {
  const rendered = await renderToStringAsync(Promise.resolve(h("p", null, "ready")));
  const site = await generateStaticSiteAsync({
    routes: [{ path: "/", source: Promise.resolve(h("h1", null, "Home")) }],
  });
  console.log(rendered.html, site.pages[0].html);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Existing synchronous APIs retain synchronous return types and explicitly reject unresolved async
values with `TypeError`; they do not render them as empty subtrees. Async setup is setup-once for
initial preparation. A setup promise that resolves to a synchronous render function supports later
reactive updates after `hydrateAsync()`; one that resolves directly to a VNode is fixed after initial
preparation, and promise children are one-shot. Ambient instance APIs after `await` and async update
scheduling remain deferred.

The sequential streaming server entry is `renderToStream()`. It accepts VNodes, component
functions, promised roots, and async components — but, unlike the buffered async entries, not
VNodes with promised children (async must go through async components or a promised root; promised
children are rejected with a `TypeError`). It returns a `ReadableStream<Uint8Array>` whose byte order matches
`renderToStringAsync().html` for the sources it supports. Completed prefixes are flushed before
unresolved async components are
awaited, `useStyle()` styles are emitted inline at first registration (deduplicated by style id;
conflicting registrations for the same id throw), rendering starts eagerly when the API is called,
and consumer backpressure is not handled in this slice. Options accept only `context` and
`provides`; unknown fields throw a `TypeError` naming the field. Render errors reject the stream,
possibly after partial bytes were emitted.

```ts
import { renderToStream } from "@italone/solace/server";
const stream = renderToStream(App, { mode: "out-of-order" });
return new Response(stream, { headers: { "content-type": "text/html; charset=utf-8" } });
```

Router-aware SSR and hydration use explicit composition rather than a renderer option. The server
creates one request-scoped context, renders with its injection map, and serializes the canonical
snapshot. This provides router-aware SSR and router-aware hydration while direct renderer options
remain rejected:

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

The browser installs its router, awaits the single initial readiness promise, verifies the same
record identities, and only then enters hydration:

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

The identity callback must return a non-empty unique string for each matched record. Snapshot
serialization escapes script-sensitive characters, parsing validates the exact version-1 schema,
and `RouterHydrationError` fails closed on the first route mismatch. Application code owns any fresh
mount recovery. Existing `{ recover: true }` remains limited to DOM hydration mismatch.

The public loop includes sequential streaming SSR through `renderToStream()` plus out-of-order
streaming via `renderToStream(source, { mode: "out-of-order" })`. It does not include
filesystem SSG output, route crawling, direct
renderer-owned router options, Suspense/selective hydration, or automatic router snapshot recovery.

Passing only one of `manifest` or `clientEntry` to `generateStaticSite()` throws a `TypeError`; pass
both to make the shell receive resolved production asset tags. Route-level `manifest`,
`clientEntry`, and `router` fields are rejected. App-level renderer `router` remains unsupported;
use `createRouterServerContext()` for request-scoped SSR composition, or convert narrow static
records with `createStaticRoutesFromRouter()` for explicit SSG routes.
Route paths must be strings before rendering starts, so malformed SSG route inputs fail with a stable
`TypeError`.
`generateStaticSite()` options accept only `routes`, `shell`, `manifest`, `clientEntry`, and `base`;
route entries accept only `path`, `source`, `context`, and `provides`. Unknown own option or route
fields throw a `TypeError` naming the field.

`generateStaticSite()` renders explicit route sources in memory and preserves collected
`renderToString()` styles for custom shells. Place `styles.join("")` in `<head>` when composing a
full HTML document:
The shell receives read-only copies of `styles` and `context`, so shell-local mutation does not
feed back into the returned page metadata.

```ts
const site = generateStaticSite({
  routes: [{ path: "/", source: h(App) }],
  shell: ({ body, styles }) =>
    `<!doctype html><html><head>${styles.join("")}</head><body>${body}</body></html>`,
});

site.pages[0].html;
```

```ts
const assets = resolveStaticAssets({
  manifest: {
    "src/main.ts": {
      file: "assets/main.js",
      css: ["assets/main.css"],
      imports: ["_vendor.js"],
    },
    "_vendor.js": {
      file: "assets/vendor.js",
    },
  },
  entry: "src/main.ts",
  base: "/app/",
});

assets.modulePreloads;
assets.stylesheets;
assets.scripts;
```

```tsx
const UserPage = () => <p>user</p>;
const NotFound = () => <p>not found</p>;

const staticRoutes = createStaticRoutesFromRouter({
  routes: [
    { path: "/", component: App },
    { path: "/users/:id", component: UserPage },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
  paths: ["/", "/users/42?tab=profile", "/missing"],
  context: (route) => ({ route }),
});

generateStaticSite({ routes: staticRoutes });
```

## Use The Beta Router

Solace exposes the beta router from the package root. The stabilized slice now includes route
names, aliases, route props, named locations, and `createMemoryHistory()` for small SPA examples:

```tsx
import {
  RouterLink,
  RouterView,
  createApp,
  createMemoryHistory,
  createRouter,
  lazyRoute,
} from "@italone/solace";

const Home = () => <p>home</p>;
const User = () => <p>user</p>;
const Dashboard = () => (
  <section>
    <h2>Dashboard</h2>
    <RouterView />
  </section>
);

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", name: "home", component: Home, alias: "/start" },
    { path: "/legacy", redirect: "/" },
    {
      path: "/dashboard",
      component: Dashboard,
      beforeEnter: () => true,
      meta: { section: "dashboard" },
      children: [{ path: "report", component: lazyRoute(() => import("./Report")) }],
    },
    { path: "/users/:id", name: "user", component: User, props: true },
  ],
});

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

The current beta router supports path matching, dynamic params, query parsing, browser history
adapters, nested route records, redirects, global `beforeEach` guards, route-level `beforeEnter`
guards, route `meta`, route names, aliases, route props, named locations, `createMemoryHistory()`,
`lazyRoute()` route components, `RouterLink`, `RouterView`, and `scrollBehavior` after successful
navigations. It also exposes `router.isReady()` plus canonical route snapshot primitives for explicit
SSR/hydration composition. The beta router still defers auth, permissions, direct renderer-owned
router options and Suspense/selective hydration (out-of-order streaming SSR is available through
`renderToStream(source, { mode: "out-of-order" })`). `props: true`
passes route params, plain object props are used as-is, and function props are evaluated from the
matched route. Named locations preserve canonical path generation, and alias URLs preserve canonical
matched/name behavior.
Do not treat route `meta` as authentication or permission enforcement. Use it as application-owned
metadata for examples or local UX decisions only, and keep backend authorization as the enforcement
boundary in real applications. Router-level `auth` and `permissions` options and route record fields
are rejected until Solace designs a first-party integration surface.
Object route locations support `{ path, query }` and `{ name, params, query }`; hash fragments in
string or object-path locations, and params objects on path-based locations, are rejected. Object
location `path` values must not include query strings; use the separate `query` field instead. Route
record paths must be relative paths and must not include query strings or hash fragments. Route
redirect strings and object locations are validated at router creation time. Dynamic params are
limited to simple `:name` segments and `/:pathMatch(.*)*` wildcard fallback. Lazy route component
load failures surface `RouterNavigationError` with type
`"lazy-load-failed"`.
Supported path locations normalize to a leading slash and trim trailing slashes except for `/`;
string locations split path and query at the first `?`, preserving later `?` characters inside
query values, string locations and object location `path` values must be relative paths, malformed
query percent encoding throws a TypeError, and browser history adapter write targets reject
relative/absolute URL-like targets or hash fragments.

## Use The DevTools Extension Example

The public DevTools package entry remains the low-level listener and recorder surface:

```ts
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
```

The repository also includes `examples/devtools-extension`, a browser DevTools extension example
that consumes the same public event contract. It opens a Solace panel, activates capture only for
the inspected tab, relays serialized events, and renders a local timeline with family filters,
pause/resume, clear, details, and a bounded capture limit.

Run the extension panel during development:

```bash
pnpm dev:devtools-extension
```

Build and smoke-test it:

```bash
pnpm build:devtools-extension
pnpm test:e2e:devtools-extension
```

Before using the extension example in a release note or demo, follow the browser extension QA
checklist in [docs/devtools.md](./devtools.md). The QA pass should confirm relayed public event
summaries, bounded captures, reconnect behavior, stale-port handling, and the absence of raw runtime
payloads. The example manifest is restricted to the fixed local demo origins
`http://127.0.0.1:6174/*` and `http://localhost:6174/*`; release notes and production browser-store
packaging must review the exact inspected origins before widening extension permissions.

The example panel is not a stable browser-store distribution contract. It does not persist captures,
send events over the network, inspect private runtime objects, or include SSR/SSG/hydration-specific
views.

## Public Entry Points

- `@italone/solace`: core runtime APIs.
- `@italone/solace/package.json`: package metadata for consumers that explicitly need it.
- `@italone/solace/jsx-runtime`: TypeScript automatic JSX runtime.
- `@italone/solace/jsx-dev-runtime`: development JSX runtime used by Vite.
- `@italone/solace/devtools`: low-level DevTools listener and recorder APIs consumed by the
  extension example.
- `@italone/solace/server`: server rendering, in-memory SSG, and static asset helpers.
- `@italone/solace/sfc`: TypeScript type shim for `.solace` imports.
- `@italone/solace/vite`: Vite plugin for optional experimental `.solace` single-file components.

Do not import from `src/**`, `dist/**`, or internal runtime modules directly. Those paths are implementation details and are not part of the package compatibility contract.

See the [Compatibility and deprecation policy](./compatibility.md) and [兼容性与弃用策略](./compatibility.zh-CN.md)
for the eight protected import paths, the `0.1.x` patch boundary, beta router/async maturity,
experimental SFC/Vite maturity, and the required migration evidence for deprecations.

## Verify A Packed Consumer

Before release, run the package consumer smoke test:

```bash
pnpm package:smoke
```

The smoke test builds Solace, packs the current package, installs the tarball into a temporary
consumer project, typechecks a JSX entry file, verifies ESM and CJS imports for all public entry
points including `@italone/solace/server`, checks `renderToString()`, and runs a Vite production
build of a `.solace` file through the packed `@italone/solace/vite` plugin.

For the full local release gate, run:

```bash
pnpm release:check
```

That command runs release readiness, quality checks, coverage thresholds, package consumer smoke,
stable application smoke (`pnpm stable:app`), jsdom benchmark smoke, Chromium production browser
benchmark, browser e2e tests, and DevTools extension e2e smoke. For public API changes, treat
`pnpm release:readiness`, `pnpm package:smoke`, `pnpm test:e2e`, and
`pnpm test:e2e:devtools-extension` as mandatory gates even when you do not run the full release
check. Treat `pnpm stable:app` as a mandatory gate as well.

See `docs/release.md` for versioning and publish steps.

See `docs/project-status.md` for the current completion map, known gaps, and release boundary.

See `docs/examples.md` for runnable Vite examples and their e2e coverage.
