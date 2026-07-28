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
import type { AsyncComponentOptions, ComponentSetupContext, Plugin, RouteLocationRaw, RouterHistory, StoreContext, StoreGetterContext } from "@italone/solace";
import { createDevtoolsRecorder, onDevtoolsEvent } from "@italone/solace/devtools";
import type { DevtoolsEvent } from "@italone/solace/devtools";
import { generateStaticSite, renderToString } from "@italone/solace/server";
import solacePlugin, { solacePlugin as namedSolacePlugin } from "@italone/solace/vite";

const state = reactive({ count: 0 });
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
router.resolve(targetRoute);
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
