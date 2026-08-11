import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(join(tmpdir(), "solace-consumer-"));
const packDir = join(workspace, "pack");
const consumerDir = join(workspace, "consumer");

try {
  await mkdir(packDir, { recursive: true });
  await mkdir(join(consumerDir, "src"), { recursive: true });

  await run("pnpm", ["build"], root);
  await run("pnpm", ["pack", "--pack-destination", packDir], root);

  const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one packed tarball in ${packDir}, found ${tarballs.length}`);
  }
  const tarball = join(packDir, tarballs[0]);

  await writeFile(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          "@italone/solace": `file:${tarball}`,
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(consumerDir, "index.html"),
    `<div id="app"></div><script type="module" src="/src/sfc-main.ts"></script>`,
  );
  await writeFile(
    join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          jsxImportSource: "@italone/solace",
          lib: ["ES2020", "DOM"],
          types: ["@italone/solace/sfc"],
          skipLibCheck: true,
        },
        include: ["src"],
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(consumerDir, "src", "main.tsx"),
    `import { RouterLink, RouterView, createApp, createMemoryHistory, createRouter, createStore, createWebHashHistory, createWebHistory, defineAsyncComponent, defineComponent, h, inject, lazyRoute, reactive, useRoute, useRouter, watchEffect } from "@italone/solace";
import type { AsyncComponentOptions, ComponentSetupContext, HydrationOptions, NavigationGuard, Plugin, RouteComponent, RouteLocationRaw, RouterHistory, StoreContext, StoreGetterContext } from "@italone/solace";
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
import { generateStaticSite, renderToString } from "@italone/solace/server";
import solacePlugin, { solacePlugin as namedSolacePlugin } from "@italone/solace/vite";

const state = reactive({ count: 0 });
const hydrationOptions: HydrationOptions = { recover: true };
const stopWatching = watchEffect(() => state.count);
stopWatching();
const ThemeKey = Symbol("theme");
type CounterState = { count: number };
const targetRoute: RouteLocationRaw = { path: "/users/1", query: { tab: "profile" } };
const memoryHistory: RouterHistory = {
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
};
const routeGuard: NavigationGuard = () => true;
const lazyChild: RouteComponent = lazyRoute(() => Promise.resolve(() => h("p", null, "child")));
const router = createRouter({
  history: memoryHistory,
  routes: [
    {
      path: "/",
      component: () => h("p", null, "home"),
      meta: { public: true },
      children: [{ path: "child", component: lazyChild }],
    },
    { path: "/legacy", redirect: "/" },
    { path: "/guarded", component: () => h("p", null, "guarded"), beforeEnter: routeGuard },
  ],
});
const routerApi = [createMemoryHistory, createWebHistory, createWebHashHistory, RouterLink, RouterView, useRouter, useRoute];
if (routerApi.some((item) => typeof item !== "function")) {
  throw new Error("router API export mismatch");
}
const observedDevtoolsEvents: DevtoolsEvent[] = [];
const stopDevtoolsListener = onDevtoolsEvent((event) => {
  observedDevtoolsEvents.push(event);
});
const devtoolsRecorder = createDevtoolsRecorder({ limit: 2 });
devtoolsRecorder.clear();
devtoolsRecorder.stop();
stopDevtoolsListener();
const vitePlugin = solacePlugin();
const namedVitePlugin = namedSolacePlugin();
if (vitePlugin.name !== "solace-sfc" || namedVitePlugin.name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
const serverRendered = renderToString(h("p", null, "server"));
if (serverRendered.html !== "<p>server</p>" || serverRendered.styles.length !== 0) {
  throw new Error("server rendering export mismatch");
}
const staticSite = generateStaticSite({
  routes: [{ path: "/ssg", source: h("p", null, "static") }],
});
if (
  staticSite.pages[0].path !== "/ssg" ||
  staticSite.pages[0].html !== "<p>static</p>" ||
  staticSite.pages[0].body !== "<p>static</p>"
) {
  throw new Error("static site generation export mismatch");
}

const store = createStore({
  state: (): CounterState => ({ count: 0 }),
  getters: {
    double({ state }: StoreGetterContext<CounterState>) {
      return state.count * 2;
    },
  },
  actions: {
    increment({ state }: StoreContext<CounterState, { double: number }>, amount: number) {
      state.count += amount;
    },
  },
});

const Button = defineComponent((props: { label: string }, { emit }: ComponentSetupContext) => (
  <button onClick={() => emit("change")}>{props.label}</button>
));

const ThemeLabel = () => {
  const theme = inject(ThemeKey, "light");

  return <span>{theme}</span>;
};

const Panel = defineComponent((_props: object, { slots }: ComponentSetupContext) => (
  <section>
    <header>{slots.header?.()}</header>
    <main>{slots.default?.({ label: "slotted" })}</main>
  </section>
));

const FrameworkList = () => (
  <>
    {["runtime", "jsx"].map((label) => (
      <span key={label}>{label}</span>
    ))}
  </>
);

// @ts-expect-error packaged TSX onXxx handlers must reject non-function values
<Button label="invalid" onChange="change" />;

// @ts-expect-error packaged DOM onXxx handlers must reject non-functions
<button onClick="click">invalid</button>;

// @ts-expect-error packaged DOM onXxx handlers must reject function arrays
<button onClick={[() => undefined]}>invalid</button>;

// @ts-expect-error packaged JSX key only accepts strings or numbers
<Button key={false} label="invalid" />;

const AsyncLoading = () => h("span", null, "loading");
const AsyncError = () => h("span", null, "error");

const lazyPanelOptions: AsyncComponentOptions<{ title: string }> = {
  loader: () =>
    Promise.resolve((props: { title: string }, { slots }: ComponentSetupContext) =>
      h("article", { "data-title": props.title }, slots.default?.() ?? null),
  ),
  loadingComponent: AsyncLoading,
  errorComponent: AsyncError,
  delay: 10,
  timeout: 5000,
  retry: 1,
  retryDelay: 10,
};

const LazyPanel = defineAsyncComponent(lazyPanelOptions);

const appPlugin: Plugin = (app, option) => {
  if (!app || option !== "enabled") {
    throw new Error("plugin option mismatch");
  }

  app.provide(ThemeKey, "dark");
};

const App = () => () => (
  <div>
    <Button
      label={\`count: \${state.count} double: \${store.getters.double}\`}
      onChange={[
        () => {
          state.count += 1;
        },
        () => {
          store.actions.increment(1);
        },
      ]}
    />
    <ThemeLabel />
    <Panel>
      <span>default slot</span>
    </Panel>
    {h(Panel, null, {
      header: () => <span>named</span>,
      default: (slotProps) => <strong>{String(slotProps?.label)}</strong>,
    })}
    <LazyPanel title="async">
      <em>loaded later</em>
    </LazyPanel>
    <FrameworkList />
  </div>
);

createApp(App).use(appPlugin, "enabled").mount(document.createElement("main"));
createApp(() => <p>client</p>).hydrate(document.createElement("main"), hydrationOptions);
router.resolve(targetRoute);
await router.push("/child");
`,
  );
  await writeFile(
    join(consumerDir, "src", "public-contract-types.ts"),
    `import { createApp, createMemoryHistory, createRouter, h, lazyRoute } from "@italone/solace";
import { jsx } from "@italone/solace/jsx-runtime";
import { jsxDEV } from "@italone/solace/jsx-dev-runtime";
import type { AsyncComponentType, HydrationOptions, NavigationGuard, RouteComponent, RouteLocationRaw, RouteRecord, RouterOptions, RouterScrollBehavior, RouterScrollPosition } from "@italone/solace";
import type { GenerateStaticSiteOptions, RenderToStringOptions } from "@italone/solace/server";
import { solacePlugin } from "@italone/solace/vite";

const Home = () => h("p", null, "home");
const AsyncRoot: AsyncComponentType = async () => () => h("p", null, "async");
const ConsumerButton = (props: { label: string }) => h("button", null, props.label);
const guard: NavigationGuard = () => true;
const lazyComponent: RouteComponent = lazyRoute(() => Promise.resolve(Home));
const scrollPosition: RouterScrollPosition = { left: 0, top: 20, behavior: "smooth" };
const scrollBehavior: RouterScrollBehavior = () => scrollPosition;

function acceptRouteRecord(record: RouteRecord): RouteRecord {
  return record;
}

function acceptRouterOptions(options: RouterOptions): RouterOptions {
  return options;
}

function acceptRouteLocationRaw(location: RouteLocationRaw): RouteLocationRaw {
  return location;
}

function acceptSSGOptions(options: GenerateStaticSiteOptions): GenerateStaticSiteOptions {
  return options;
}

function acceptRenderOptions(options: RenderToStringOptions): RenderToStringOptions {
  return options;
}

function acceptHydrationOptions(options: HydrationOptions): HydrationOptions {
  return options;
}

solacePlugin();
acceptRouteRecord({ path: "/", component: Home });
acceptRouteRecord({ path: "/named/:id", component: Home, name: "user", props: true });
acceptRouteRecord({ path: "/alias", component: Home, alias: ["/a", "relative-a"] });
acceptRouteRecord({ path: "/props-object", component: Home, props: { mode: "static" } });
acceptRouteRecord({ path: "/props-function/:id", component: Home, props: (route) => ({ id: route.params.id }) });
acceptRouteRecord({
  path: "/dashboard",
  component: Home,
  beforeEnter: guard,
  meta: { section: "dashboard" },
  children: [{ path: "settings", component: lazyComponent }],
});
acceptRouteRecord({ path: "/legacy", redirect: "/dashboard/settings" });
acceptRouterOptions({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: Home }],
  scrollBehavior,
});
acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });
acceptRouteLocationRaw({ name: "user", params: { id: 42 }, query: { tab: "profile" } });
acceptSSGOptions({ routes: [{ path: "/", source: h("p", null, "home") }] });
acceptSSGOptions({
  routes: [{ path: "/", source: h("p", null, "home") }],
  manifest: { "src/main.ts": { file: "assets/main.js" } },
  clientEntry: "src/main.ts",
});
acceptRenderOptions({ context: { title: "Home" } });
acceptHydrationOptions({ recover: true });
void createApp(AsyncRoot).hydrateAsync(document.createElement("main"));

// @ts-expect-error packaged direct jsx component props reject non-function handlers
jsx(ConsumerButton, { label: "ok", onChange: "change" });

// @ts-expect-error packaged direct jsxDEV component props reject non-function handlers
jsxDEV(ConsumerButton, { label: "ok", onChange: "change" });

// @ts-expect-error Vite plugin options are not part of the public SFC contract
solacePlugin({ customBlocks: true });

// @ts-expect-error hydration recovery is boolean-only
acceptHydrationOptions({ recover: "yes" });

// @ts-expect-error production manifest integration is not part of the hydration public contract
acceptHydrationOptions({ manifest: {} });

// @ts-expect-error streaming hydration integration is deferred
acceptHydrationOptions({ stream: true });

// @ts-expect-error auth integration is not part of the router beta contract
acceptRouterOptions({ history: {} as never, routes: [], auth: () => true });

// @ts-expect-error route record auth integration is not part of the router beta contract
acceptRouteRecord({ path: "/admin", auth: () => true });

// @ts-expect-error route record permissions integration is not part of the router beta contract
acceptRouteRecord({ path: "/admin", permissions: ["admin"] });

// @ts-expect-error named locations must include a string name
acceptRouteLocationRaw({ name: 42 });

// @ts-expect-error hash locations are deferred
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error params locations are deferred
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error object locations must include a string path
acceptRouteLocationRaw({ query: { tab: "profile" } });

// @ts-expect-error router-aware SSG adapters are deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });

// @ts-expect-error renderToString does not read production manifests
acceptRenderOptions({ manifest: {} });

// @ts-expect-error renderToString does not infer client entries
acceptRenderOptions({ clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSR integration is deferred
acceptRenderOptions({ router: {} });

// @ts-expect-error streaming SSR integration is deferred
acceptRenderOptions({ stream: true });

createRouter({
  history: {
    location: () => "/",
    push: () => undefined,
    replace: () => undefined,
    listen: () => () => undefined,
    back: () => undefined,
    forward: () => undefined,
  },
  routes: [{ path: "/", component: Home }],
});
`,
  );
  await writeFile(
    join(consumerDir, "src", "SfcSmoke.solace"),
    `<template>
  <button class="sfc-smoke" onClick={increment}>
    count: {count.value}
  </button>
</template>

<script>
  import { ref } from "@italone/solace";
  const count = ref(0);
  const increment = () => count.value++;
</script>

<style>
  .sfc-smoke { color: green; }
</style>
`,
  );
  await writeFile(
    join(consumerDir, "src", "sfc-main.ts"),
    `import { createApp } from "@italone/solace";

import SfcSmoke from "./SfcSmoke.solace";

createApp(SfcSmoke).mount(document.querySelector("#app") as Element);
`,
  );
  await writeFile(
    join(consumerDir, "vite.config.ts"),
    `import solace from "@italone/solace/vite";

export default {
  plugins: [solace()],
};
`,
  );
  await writeFile(
    join(consumerDir, "boundary-smoke.mjs"),
    `import * as api from "@italone/solace";
import * as server from "@italone/solace/server";
import solacePlugin, { solacePlugin as namedSolacePlugin } from "@italone/solace/vite";

const history = {
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
};
const Home = () => api.h("p", null, "home");
const AsyncPage = async () => api.h("p", null, "async");

function expectThrows(label, fn, pattern) {
  try {
    fn();
  } catch (error) {
    if (pattern.test(String(error?.message ?? error))) {
      return;
    }
    throw new Error(\`\${label} threw an unexpected error: \${String(error?.message ?? error)}\`);
  }
  throw new Error(\`\${label} did not throw\`);
}

async function expectRejects(label, promise, pattern) {
  try {
    await promise;
  } catch (error) {
    if (pattern.test(String(error?.message ?? error))) {
      return;
    }
    throw new Error(\`\${label} rejected with an unexpected error: \${String(error?.message ?? error)}\`);
  }
  throw new Error(\`\${label} did not reject\`);
}

if (solacePlugin().name !== "solace-sfc" || namedSolacePlugin().name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
expectThrows("vite plugin options", () => solacePlugin({ customBlocks: true }), /Solace Vite plugin options are not part of the public contract/);
expectThrows("vite plugin query transforms", () => solacePlugin().transform("<template><p>raw</p></template>", "/app/src/App.solace?raw"), /Solace Vite plugin query transforms are not part of the public contract/);
api.createRouter({ history, routes: [{ path: "/nested", component: Home, children: [{ path: "child", component: api.lazyRoute(() => Promise.resolve(Home)) }], beforeEnter: () => true, redirect: "/", meta: { beta: true } }] });
const contractRouter = api.createRouter({ history: api.createMemoryHistory(), routes: [{ path: "/users/:id", name: "user", alias: "/members/:id", component: Home, props: true }] });
const aliasRoute = contractRouter.resolve("/members/42?tab=profile");
if (aliasRoute.name !== "user" || aliasRoute.path !== "/members/42" || aliasRoute.matched[0].path !== "/users/:id") {
  throw new Error("router alias contract mismatch");
}
if (contractRouter.resolve({ name: "user", params: { id: 42 } }).fullPath !== "/users/42") {
  throw new Error("router named location contract mismatch");
}
expectThrows("router invalid route path", () => api.createRouter({ history, routes: [{ path: 42, component: Home }] }), /Router route record path must be a string/);
expectThrows("router invalid routes list", () => api.createRouter({ history, routes: null }), /Router routes must be an array/);
api.createRouter({ history, routes: [{ path: "/", component: Home }], scrollBehavior: () => ({ left: 0, top: 0 }) });
expectThrows("router deferred auth option", () => api.createRouter({ history, routes: [{ path: "/", component: Home }], auth: () => true }), /Router auth integration is not part of the beta contract/);
expectThrows("router deferred permissions route field", () => api.createRouter({ history, routes: [{ path: "/", component: Home, permissions: ["admin"] }] }), /Router route record permissions integration is not part of the beta contract/);
expectThrows("router deferred path syntax", () => api.createRouter({ history, routes: [{ path: "/users/:id?", component: Home }] }), /Deferred router path syntax/);
const router = api.createRouter({ history, routes: [{ path: "/", component: Home }] });
expectThrows("router missing location path", () => router.resolve({ query: { tab: "profile" } }), /Router location path must be a string/);
expectThrows("router invalid location path", () => router.resolve({ path: 42 }), /Router location path must be a string/);
expectThrows("router deferred location fields", () => router.resolve({ path: "/users/1", hash: "#profile" }), /Deferred router location field/);
await expectRejects("router deferred push location fields", router.push({ path: "/users/1", name: "user" }), /Deferred router location field/);
await expectRejects("router deferred replace location fields", router.replace({ path: "/users/1", params: { id: "1" } }), /Deferred router location field/);
expectThrows("SSR manifest option", () => server.renderToString(api.h("p", null, "server"), { manifest: {} }), /SSR manifest integration is deferred/);
expectThrows("SSR router option", () => server.renderToString(api.h("p", null, "server"), { router: {} }), /Router-aware SSR integration is deferred/);
expectThrows("SSR stream option", () => server.renderToString(api.h("p", null, "server"), { stream: true }), /Streaming SSR is deferred/);
expectThrows("SSR invalid context", () => server.renderToString(api.h("p", null, "server"), { context: [] }), /SSR context must be a plain object/);
expectThrows("SSR unknown option", () => server.renderToString(api.h("p", null, "server"), { contex: {} }), /Unknown SSR option: contex/);
expectThrows("hydration unknown option", () => api.createApp(Home).hydrate({}, { recvoer: true }), /Unknown hydration option: recvoer/);
expectThrows("async SSR source", () => server.renderToString(Promise.resolve(api.h("p", null, "async"))), /Async SSR is deferred/);
expectThrows("async SSR", () => server.renderToString(api.h(AsyncPage)), /Async SSR is deferred/);
expectThrows("async SSR child", () => server.renderToString(api.h("p", null, Promise.resolve(api.h("span", null, "async")))), /Async SSR is deferred/);
expectThrows("async SSG source", () => server.generateStaticSite({ routes: [{ path: "/", source: Promise.resolve(api.h("p", null, "async")) }] }), /Async SSR is deferred/);
expectThrows("SSG invalid route path", () => server.generateStaticSite({ routes: [{ path: 42, source: api.h("p", null, "home") }] }), /SSG route path must be a string/);
expectThrows("SSG partial manifest option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], manifest: {} }), /SSG manifest integration requires both manifest and clientEntry/);
expectThrows("SSG router option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], router: {} }), /Router-aware SSG integration is deferred/);
expectThrows("SSG unknown option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], shel: () => "typo" }), /Unknown SSG option: shel/);
expectThrows("SSG unknown route field", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home"), provdies: new Map() }] }), /Unknown SSG route field: provdies/);
const asyncRendered = await server.renderToStringAsync(Promise.resolve(api.h("p", null, "packed async")));
if (asyncRendered.html !== "<p>packed async</p>" || asyncRendered.styles.length !== 0) {
  throw new Error("async SSR package contract mismatch");
}
const asyncSite = await server.generateStaticSiteAsync({ routes: [{ path: "/async", source: Promise.resolve(api.h("p", null, "packed SSG")) }] });
if (asyncSite.pages.length !== 1 || asyncSite.pages[0].body !== "<p>packed SSG</p>") {
  throw new Error("async SSG package contract mismatch");
}
`,
  );
  await writeFile(
    join(consumerDir, "boundary-smoke.cjs"),
    `const api = require("@italone/solace");
const server = require("@italone/solace/server");
const vite = require("@italone/solace/vite");

const history = {
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
};
const Home = () => api.h("p", null, "home");
const AsyncPage = async () => api.h("p", null, "async");

function expectThrows(label, fn, pattern) {
  try {
    fn();
  } catch (error) {
    if (pattern.test(String(error && error.message ? error.message : error))) {
      return;
    }
    throw new Error(label + " threw an unexpected error: " + String(error && error.message ? error.message : error));
  }
  throw new Error(label + " did not throw");
}

async function expectRejects(label, promise, pattern) {
  try {
    await promise;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (pattern.test(message)) {
      return;
    }
    throw new Error(label + " rejected with an unexpected error: " + message);
  }
  throw new Error(label + " did not reject");
}

if (vite.solacePlugin().name !== "solace-sfc" || vite.default().name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
expectThrows("vite plugin options", () => vite.solacePlugin({ customBlocks: true }), /Solace Vite plugin options are not part of the public contract/);
expectThrows("vite plugin query transforms", () => vite.solacePlugin().transform("<template><p>raw</p></template>", "/app/src/App.solace?raw"), /Solace Vite plugin query transforms are not part of the public contract/);
api.createRouter({ history, routes: [{ path: "/nested", component: Home, children: [{ path: "child", component: api.lazyRoute(() => Promise.resolve(Home)) }], beforeEnter: () => true, redirect: "/", meta: { beta: true } }] });
const contractRouter = api.createRouter({ history: api.createMemoryHistory(), routes: [{ path: "/users/:id", name: "user", alias: "/members/:id", component: Home, props: true }] });
const aliasRoute = contractRouter.resolve("/members/42?tab=profile");
if (aliasRoute.name !== "user" || aliasRoute.path !== "/members/42" || aliasRoute.matched[0].path !== "/users/:id") {
  throw new Error("router alias contract mismatch");
}
if (contractRouter.resolve({ name: "user", params: { id: 42 } }).fullPath !== "/users/42") {
  throw new Error("router named location contract mismatch");
}
expectThrows("router invalid route path", () => api.createRouter({ history, routes: [{ path: 42, component: Home }] }), /Router route record path must be a string/);
expectThrows("router invalid routes list", () => api.createRouter({ history, routes: null }), /Router routes must be an array/);
api.createRouter({ history, routes: [{ path: "/", component: Home }], scrollBehavior: () => ({ left: 0, top: 0 }) });
expectThrows("router deferred auth option", () => api.createRouter({ history, routes: [{ path: "/", component: Home }], auth: () => true }), /Router auth integration is not part of the beta contract/);
expectThrows("router deferred permissions route field", () => api.createRouter({ history, routes: [{ path: "/", component: Home, permissions: ["admin"] }] }), /Router route record permissions integration is not part of the beta contract/);
expectThrows("router deferred path syntax", () => api.createRouter({ history, routes: [{ path: "/users/:id?", component: Home }] }), /Deferred router path syntax/);
const router = api.createRouter({ history, routes: [{ path: "/", component: Home }] });
expectThrows("router missing location path", () => router.resolve({ query: { tab: "profile" } }), /Router location path must be a string/);
expectThrows("router invalid location path", () => router.resolve({ path: 42 }), /Router location path must be a string/);
expectThrows("router deferred location fields", () => router.resolve({ path: "/users/1", hash: "#profile" }), /Deferred router location field/);
Promise.all([
  expectRejects("router deferred push location fields", router.push({ path: "/users/1", name: "user" }), /Deferred router location field/),
  expectRejects("router deferred replace location fields", router.replace({ path: "/users/1", params: { id: "1" } }), /Deferred router location field/),
  server.renderToStringAsync(Promise.resolve(api.h("p", null, "packed async"))).then((rendered) => {
    if (rendered.html !== "<p>packed async</p>" || rendered.styles.length !== 0) {
      throw new Error("async SSR package contract mismatch");
    }
  }),
  server.generateStaticSiteAsync({ routes: [{ path: "/async", source: Promise.resolve(api.h("p", null, "packed SSG")) }] }).then((site) => {
    if (site.pages.length !== 1 || site.pages[0].body !== "<p>packed SSG</p>") {
      throw new Error("async SSG package contract mismatch");
    }
  }),
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
expectThrows("SSR manifest option", () => server.renderToString(api.h("p", null, "server"), { manifest: {} }), /SSR manifest integration is deferred/);
expectThrows("SSR router option", () => server.renderToString(api.h("p", null, "server"), { router: {} }), /Router-aware SSR integration is deferred/);
expectThrows("SSR stream option", () => server.renderToString(api.h("p", null, "server"), { stream: true }), /Streaming SSR is deferred/);
expectThrows("SSR invalid context", () => server.renderToString(api.h("p", null, "server"), { context: [] }), /SSR context must be a plain object/);
expectThrows("SSR unknown option", () => server.renderToString(api.h("p", null, "server"), { contex: {} }), /Unknown SSR option: contex/);
expectThrows("hydration unknown option", () => api.createApp(Home).hydrate({}, { recvoer: true }), /Unknown hydration option: recvoer/);
expectThrows("async SSR source", () => server.renderToString(Promise.resolve(api.h("p", null, "async"))), /Async SSR is deferred/);
expectThrows("async SSR", () => server.renderToString(api.h(AsyncPage)), /Async SSR is deferred/);
expectThrows("async SSR child", () => server.renderToString(api.h("p", null, Promise.resolve(api.h("span", null, "async")))), /Async SSR is deferred/);
expectThrows("async SSG source", () => server.generateStaticSite({ routes: [{ path: "/", source: Promise.resolve(api.h("p", null, "async")) }] }), /Async SSR is deferred/);
expectThrows("SSG invalid route path", () => server.generateStaticSite({ routes: [{ path: 42, source: api.h("p", null, "home") }] }), /SSG route path must be a string/);
expectThrows("SSG partial manifest option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], manifest: {} }), /SSG manifest integration requires both manifest and clientEntry/);
expectThrows("SSG router option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], router: {} }), /Router-aware SSG integration is deferred/);
expectThrows("SSG unknown option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], shel: () => "typo" }), /Unknown SSG option: shel/);
expectThrows("SSG unknown route field", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home"), provdies: new Map() }] }), /Unknown SSG route field: provdies/);
`,
  );

  await run("pnpm", ["install", "--ignore-scripts"], consumerDir);
  await run(resolve(root, "node_modules/.bin/tsc"), ["-p", consumerDir], root);
  await run(resolve(root, "node_modules/.bin/vite"), ["build"], consumerDir);
  await assertFileExists(join(consumerDir, "dist", "index.html"));
  const builtAssets = await readdir(join(consumerDir, "dist", "assets"));
  if (!builtAssets.some((entry) => entry.endsWith(".js"))) {
    throw new Error("Expected consumer SFC Vite build to emit a JavaScript asset.");
  }
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      "const api = await import('@italone/solace'); const runtime = await import('@italone/solace/jsx-runtime'); const dev = await import('@italone/solace/jsx-dev-runtime'); const devtools = await import('@italone/solace/devtools'); const server = await import('@italone/solace/server'); const vite = await import('@italone/solace/vite'); if (!api.useStyle) throw new Error('missing useStyle export'); if (!api.createApp || !api.createMemoryHistory || !api.createRouter || !api.createWebHistory || !api.RouterLink || !api.RouterNavigationError || !api.RouterView || !api.lazyRoute || !api.h || !api.useRoute || !api.useRouter || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent || !server.renderToString || !vite.solacePlugin) throw new Error('package export mismatch'); const Styled = () => { api.useStyle('abc123', '.consumer-smoke { color: blue; }'); return api.h('button', { class: 'consumer-smoke' }, 'styled'); }; const styleRendered = server.renderToString(api.h(Styled)); if (styleRendered.html !== '<button class=\"consumer-smoke\">styled</button>' || styleRendered.styles.length !== 1 || styleRendered.styles[0] !== '<style data-s-id=\"abc123\">.consumer-smoke { color: blue; }</style>') throw new Error('style runtime export mismatch');",
    ],
    consumerDir,
  );
  await run(
    "node",
    [
      "-e",
      "const api = require('@italone/solace'); const runtime = require('@italone/solace/jsx-runtime'); const dev = require('@italone/solace/jsx-dev-runtime'); const devtools = require('@italone/solace/devtools'); const server = require('@italone/solace/server'); const vite = require('@italone/solace/vite'); if (!api.useStyle) throw new Error('missing useStyle export'); if (!api.createApp || !api.createMemoryHistory || !api.createRouter || !api.createWebHistory || !api.RouterLink || !api.RouterNavigationError || !api.RouterView || !api.lazyRoute || !api.h || !api.useRoute || !api.useRouter || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent || !server.renderToString || !vite.solacePlugin) throw new Error('package export mismatch'); const Styled = () => { api.useStyle('abc123', '.consumer-smoke { color: blue; }'); return api.h('button', { class: 'consumer-smoke' }, 'styled'); }; const styleRendered = server.renderToString(api.h(Styled)); if (styleRendered.html !== '<button class=\"consumer-smoke\">styled</button>' || styleRendered.styles.length !== 1 || styleRendered.styles[0] !== '<style data-s-id=\"abc123\">.consumer-smoke { color: blue; }</style>') throw new Error('style runtime export mismatch');",
    ],
    consumerDir,
  );
  await run("node", ["boundary-smoke.mjs"], consumerDir);
  await run("node", ["boundary-smoke.cjs"], consumerDir);

  console.log("package consumer smoke passed");
} finally {
  await rm(workspace, { recursive: true, force: true });
}

async function assertFileExists(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Expected file to exist: ${path}`);
  }
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });

    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
