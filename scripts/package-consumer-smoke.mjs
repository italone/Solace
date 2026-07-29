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
    `import { RouterLink, RouterView, createApp, createRouter, createStore, createWebHashHistory, createWebHistory, defineAsyncComponent, defineComponent, h, inject, reactive, useRoute, useRouter, watchEffect } from "@italone/solace";
import type { AsyncComponentOptions, ComponentSetupContext, HydrationOptions, Plugin, RouteLocationRaw, RouterHistory, StoreContext, StoreGetterContext } from "@italone/solace";
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
const router = createRouter({
  history: memoryHistory,
  routes: [{ path: "/", component: () => h("p", null, "home") }],
});
const routerApi = [createWebHistory, createWebHashHistory, RouterLink, RouterView, useRouter, useRoute];
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

const Button = defineComponent((
  props: { label: string; onChange?: () => void },
  { emit }: ComponentSetupContext,
) => <button onClick={() => emit("change")}>{props.label}</button>);

const ThemeLabel = () => {
  const theme = inject(ThemeKey, "light");

  return <span>{theme}</span>;
};

const Panel = defineComponent((_props: object, { slots }: ComponentSetupContext) =>
  h("section", null, [
    h("header", null, slots.header?.() ?? null),
    h("main", null, slots.default?.({ label: "slotted" }) ?? null),
  ]),
);

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

const App = () => () =>
  h("div", null, [
    h(Button, {
      label: \`count: \${state.count} double: \${store.getters.double}\`,
      onChange: () => {
        state.count += 1;
        store.actions.increment(1);
      },
    }),
    h(ThemeLabel),
    h(Panel, null, {
      header: () => <span>named</span>,
      default: (slotProps) => <strong>{String(slotProps?.label)}</strong>,
    }),
    h(LazyPanel, { title: "async" }, <em>loaded later</em>),
  ]);

createApp(App).use(appPlugin, "enabled").mount(document.createElement("main"));
createApp(() => h("p", null, "client")).hydrate(document.createElement("main"), hydrationOptions);
router.resolve(targetRoute);
`,
  );
  await writeFile(
    join(consumerDir, "src", "public-contract-types.ts"),
    `import { createRouter, h } from "@italone/solace";
import type { HydrationOptions, RouteLocationRaw, RouteRecord, RouterOptions } from "@italone/solace";
import type { GenerateStaticSiteOptions, RenderToStringOptions } from "@italone/solace/server";
import { solacePlugin } from "@italone/solace/vite";

const Home = () => h("p", null, "home");

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
acceptRouterOptions({
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
acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });
acceptSSGOptions({ routes: [{ path: "/", source: h("p", null, "home") }] });
acceptRenderOptions({ context: { title: "Home" } });
acceptHydrationOptions({ recover: true });

// @ts-expect-error Vite plugin options are not part of the public SFC contract
solacePlugin({ customBlocks: true });

// @ts-expect-error hydration recovery is boolean-only
acceptHydrationOptions({ recover: "yes" });

// @ts-expect-error production manifest integration is not part of the hydration public contract
acceptHydrationOptions({ manifest: {} });

// @ts-expect-error nested route records are deferred
acceptRouteRecord({ path: "/nested", component: Home, children: [] });

// @ts-expect-error route guards are deferred
acceptRouteRecord({ path: "/guarded", component: Home, beforeEnter: () => true });

// @ts-expect-error redirects are deferred
acceptRouteRecord({ path: "/redirect", component: Home, redirect: "/" });

// @ts-expect-error route meta is deferred
acceptRouteRecord({ path: "/meta", component: Home, meta: {} });

// @ts-expect-error named routes are deferred
acceptRouteRecord({ path: "/named", component: Home, name: "home" });

// @ts-expect-error scroll behavior is deferred
acceptRouterOptions({ history: {} as never, routes: [], scrollBehavior: () => undefined });

// @ts-expect-error named locations are deferred
acceptRouteLocationRaw({ name: "home" });

// @ts-expect-error hash locations are deferred
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error params locations are deferred
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error object locations must include a string path
acceptRouteLocationRaw({ query: { tab: "profile" } });

// @ts-expect-error production manifest integration is deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], manifest: {} });

// @ts-expect-error client entry inference is deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSG adapters are deferred
acceptSSGOptions({ routes: [{ path: "/", source: h("p") }], router: {} });

// @ts-expect-error renderToString does not read production manifests
acceptRenderOptions({ manifest: {} });

// @ts-expect-error renderToString does not infer client entries
acceptRenderOptions({ clientEntry: "/src/main.ts" });

// @ts-expect-error router-aware SSR integration is deferred
acceptRenderOptions({ router: {} });

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

if (solacePlugin().name !== "solace-sfc" || namedSolacePlugin().name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
expectThrows("vite plugin options", () => solacePlugin({ customBlocks: true }), /Solace Vite plugin options are not part of the public contract/);
expectThrows("vite plugin query transforms", () => solacePlugin().transform("<template><p>raw</p></template>", "/app/src/App.solace?raw"), /Solace Vite plugin query transforms are not part of the public contract/);
expectThrows("router deferred route fields", () => api.createRouter({ history, routes: [{ path: "/nested", component: Home, children: [] }] }), /Deferred router route record field/);
expectThrows("router deferred options", () => api.createRouter({ history, routes: [{ path: "/", component: Home }], scrollBehavior: () => ({ left: 0, top: 0 }) }), /Deferred router option/);
expectThrows("router deferred path syntax", () => api.createRouter({ history, routes: [{ path: "/users/:id?", component: Home }] }), /Deferred router path syntax/);
const router = api.createRouter({ history, routes: [{ path: "/", component: Home }] });
expectThrows("router missing location path", () => router.resolve({ query: { tab: "profile" } }), /Router location path must be a string/);
expectThrows("router invalid location path", () => router.resolve({ path: 42 }), /Router location path must be a string/);
expectThrows("router deferred location fields", () => router.resolve({ path: "/users/1", hash: "#profile" }), /Deferred router location field/);
expectThrows("router deferred push location fields", () => router.push({ path: "/users/1", name: "user" }), /Deferred router location field/);
expectThrows("router deferred replace location fields", () => router.replace({ path: "/users/1", params: { id: "1" } }), /Deferred router location field/);
expectThrows("SSR manifest option", () => server.renderToString(api.h("p", null, "server"), { manifest: {} }), /SSR manifest integration is deferred/);
expectThrows("SSR router option", () => server.renderToString(api.h("p", null, "server"), { router: {} }), /Router-aware SSR integration is deferred/);
expectThrows("SSG manifest option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], manifest: {} }), /SSG manifest integration is deferred/);
expectThrows("SSG router option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], router: {} }), /Router-aware SSG integration is deferred/);
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

if (vite.solacePlugin().name !== "solace-sfc" || vite.default().name !== "solace-sfc") {
  throw new Error("vite plugin export mismatch");
}
expectThrows("vite plugin options", () => vite.solacePlugin({ customBlocks: true }), /Solace Vite plugin options are not part of the public contract/);
expectThrows("vite plugin query transforms", () => vite.solacePlugin().transform("<template><p>raw</p></template>", "/app/src/App.solace?raw"), /Solace Vite plugin query transforms are not part of the public contract/);
expectThrows("router deferred route fields", () => api.createRouter({ history, routes: [{ path: "/nested", component: Home, children: [] }] }), /Deferred router route record field/);
expectThrows("router deferred options", () => api.createRouter({ history, routes: [{ path: "/", component: Home }], scrollBehavior: () => ({ left: 0, top: 0 }) }), /Deferred router option/);
expectThrows("router deferred path syntax", () => api.createRouter({ history, routes: [{ path: "/users/:id?", component: Home }] }), /Deferred router path syntax/);
const router = api.createRouter({ history, routes: [{ path: "/", component: Home }] });
expectThrows("router missing location path", () => router.resolve({ query: { tab: "profile" } }), /Router location path must be a string/);
expectThrows("router invalid location path", () => router.resolve({ path: 42 }), /Router location path must be a string/);
expectThrows("router deferred location fields", () => router.resolve({ path: "/users/1", hash: "#profile" }), /Deferred router location field/);
expectThrows("router deferred push location fields", () => router.push({ path: "/users/1", name: "user" }), /Deferred router location field/);
expectThrows("router deferred replace location fields", () => router.replace({ path: "/users/1", params: { id: "1" } }), /Deferred router location field/);
expectThrows("SSR manifest option", () => server.renderToString(api.h("p", null, "server"), { manifest: {} }), /SSR manifest integration is deferred/);
expectThrows("SSR router option", () => server.renderToString(api.h("p", null, "server"), { router: {} }), /Router-aware SSR integration is deferred/);
expectThrows("SSG manifest option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], manifest: {} }), /SSG manifest integration is deferred/);
expectThrows("SSG router option", () => server.generateStaticSite({ routes: [{ path: "/", source: api.h("p", null, "home") }], router: {} }), /Router-aware SSG integration is deferred/);
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
      "const api = await import('@italone/solace'); const runtime = await import('@italone/solace/jsx-runtime'); const dev = await import('@italone/solace/jsx-dev-runtime'); const devtools = await import('@italone/solace/devtools'); const server = await import('@italone/solace/server'); const vite = await import('@italone/solace/vite'); if (!api.useStyle) throw new Error('missing useStyle export'); if (!api.createApp || !api.createRouter || !api.createWebHistory || !api.RouterLink || !api.RouterView || !api.h || !api.useRoute || !api.useRouter || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent || !server.renderToString || !vite.solacePlugin) throw new Error('package export mismatch'); const Styled = () => { api.useStyle('abc123', '.consumer-smoke { color: blue; }'); return api.h('button', { class: 'consumer-smoke' }, 'styled'); }; const styleRendered = server.renderToString(api.h(Styled)); if (styleRendered.html !== '<button class=\"consumer-smoke\">styled</button>' || styleRendered.styles.length !== 1 || styleRendered.styles[0] !== '<style data-s-id=\"abc123\">.consumer-smoke { color: blue; }</style>') throw new Error('style runtime export mismatch');",
    ],
    consumerDir,
  );
  await run(
    "node",
    [
      "-e",
      "const api = require('@italone/solace'); const runtime = require('@italone/solace/jsx-runtime'); const dev = require('@italone/solace/jsx-dev-runtime'); const devtools = require('@italone/solace/devtools'); const server = require('@italone/solace/server'); const vite = require('@italone/solace/vite'); if (!api.useStyle) throw new Error('missing useStyle export'); if (!api.createApp || !api.createRouter || !api.createWebHistory || !api.RouterLink || !api.RouterView || !api.h || !api.useRoute || !api.useRouter || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent || !server.renderToString || !vite.solacePlugin) throw new Error('package export mismatch'); const Styled = () => { api.useStyle('abc123', '.consumer-smoke { color: blue; }'); return api.h('button', { class: 'consumer-smoke' }, 'styled'); }; const styleRendered = server.renderToString(api.h(Styled)); if (styleRendered.html !== '<button class=\"consumer-smoke\">styled</button>' || styleRendered.styles.length !== 1 || styleRendered.styles[0] !== '<style data-s-id=\"abc123\">.consumer-smoke { color: blue; }</style>') throw new Error('style runtime export mismatch');",
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
