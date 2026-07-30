# Package Usage

## Install

Solace is published as a public alpha package on npm:

```bash
pnpm add @italone/solace
```

The npm package represents the latest published alpha. The repository `main` branch can be ahead of
npm while documentation or release-preparation work is still local or not yet published. Check
[project-status.md](./project-status.md) before treating local repository state as npm package
state.

Before preparing another release, run `pnpm release:readiness -- --publishable` to check package
metadata, public access configuration, and local Git synchronization. Run `pnpm package:smoke`
separately to validate package consumption with the packed-consumer smoke test described below.

## Import Runtime APIs

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

## Use `.solace` Single-File Components

The `@italone/solace/vite` entry exposes the alpha Vite plugin for `.solace` files:

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

The public SFC contract is intentionally narrow: use `@italone/solace/vite` as the Vite plugin and
`@italone/solace/sfc` as the TypeScript type shim for `.solace` imports. The compiler remains an
alpha surface. It supports a small syntax subset, reports compile diagnostics through Vite transform
errors, routes scoped styles through the public `useStyle()` runtime helper, and currently returns
`map: null` to match the package policy of not publishing production source maps. Parser internals,
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
import { generateStaticSite, renderToString } from "@italone/solace/server";

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
rethrowing the mismatch. Passing deferred integration options such as `manifest`, `clientEntry`, or `router` to
`renderToString()` throws a `TypeError`, and `hydrate()` rejects the same fields at runtime.
Hydration mismatch errors expose stable path information plus `kind`, `expected`, and `actual`
fields so missing nodes, extra nodes, element tag mismatches, and text mismatches can be diagnosed
without guessing from a single message string.

This minimum loop includes synchronous `renderToString()`, in-memory SSG through
`generateStaticSite()`, server-side style collection, and hydration-safe style dedupe. It does not
include streaming SSR, async component SSR, production asset manifest integration, filesystem SSG
output, router-aware SSG adapters, or automatic hydration mismatch recovery beyond the explicit
`recover` deopt.
Async or thenable SSR render trees are explicitly rejected with a `TypeError` instead of being
rendered as an empty subtree.

Passing deferred integration fields such as `manifest`, `clientEntry`, or `router` to
`generateStaticSite()` throws a `TypeError`; route-level `manifest`, `clientEntry`, and `router`
fields are rejected too. Compose production assets or router-aware SSG behavior in an app-local
adapter until those contracts are separately designed. Route paths must be strings before rendering
starts, so malformed SSG route inputs fail with a stable `TypeError`.

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

## Use The Beta Router

Solace exposes a beta router from the package root for small SPA examples:

```ts
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHistory,
  h,
} from "@italone/solace";

const Home = () => h("p", null, "home");
const User = () => h("p", null, "user");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
  ],
});

const App = () => () =>
  h("main", null, [h(RouterLink, { to: "/users/42" }, "User"), h(RouterView)]);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

The current router supports path matching, dynamic params, query parsing, browser history adapters,
`RouterLink`, and `RouterView`. It does not yet include route guards, nested route records, named
routes, redirects, lazy-route contracts, scroll behavior, memory history, auth, permissions, SSR,
SSG, or hydration. Passing deferred route fields such as `name`, `redirect`, `children`,
`beforeEnter`, or `meta`, or deferred options such as `scrollBehavior`, throws a `TypeError`.
Object route locations only support `{ path, query }`; named locations, hash, and params objects are
rejected. Dynamic params are limited to simple `:name` segments and `/:pathMatch(.*)*` wildcard
fallback.

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

The example panel is not a stable browser-store distribution contract. It does not persist captures,
send events over the network, inspect private runtime objects, or include SSR/SSG/hydration-specific
views.

## Public Entry Points

- `@italone/solace`: core runtime APIs.
- `@italone/solace/jsx-runtime`: TypeScript automatic JSX runtime.
- `@italone/solace/jsx-dev-runtime`: development JSX runtime used by Vite.
- `@italone/solace/devtools`: low-level DevTools listener and recorder APIs consumed by the
  extension example.
- `@italone/solace/server`: server rendering and in-memory SSG for synchronous trees.
- `@italone/solace/sfc`: TypeScript type shim for `.solace` imports.
- `@italone/solace/vite`: Vite plugin for alpha `.solace` single-file components.

Do not import from `src/**`, `dist/**`, or internal runtime modules directly. Those paths are implementation details and are not part of the package compatibility contract.

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
jsdom benchmark smoke, Chromium production browser benchmark, and browser e2e tests. For public API
changes, treat `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e` as mandatory
gates even when you do not run the full release check.

See `docs/release.md` for versioning and publish steps.

See `docs/project-status.md` for the current completion map, known gaps, and release boundary.

See `docs/examples.md` for runnable Vite examples and their e2e coverage.
