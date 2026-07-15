import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
          solace: `file:${tarball}`,
        },
      },
      null,
      2,
    ),
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
          jsxImportSource: "solace",
          lib: ["ES2020", "DOM"],
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
    `import { createApp, createStore, defineAsyncComponent, defineComponent, h, inject, reactive, watchEffect } from "solace";
import type { AsyncComponentOptions, ComponentSetupContext, Plugin, StoreContext, StoreGetterContext } from "solace";
import { createDevtoolsRecorder, onDevtoolsEvent } from "solace/devtools";
import type { DevtoolsEvent } from "solace/devtools";

const state = reactive({ count: 0 });
const stopWatching = watchEffect(() => state.count);
stopWatching();
const ThemeKey = Symbol("theme");
type CounterState = { count: number };
const observedDevtoolsEvents: DevtoolsEvent[] = [];
const stopDevtoolsListener = onDevtoolsEvent((event) => {
  observedDevtoolsEvents.push(event);
});
const devtoolsRecorder = createDevtoolsRecorder({ limit: 2 });
devtoolsRecorder.clear();
devtoolsRecorder.stop();
stopDevtoolsListener();

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
`,
  );

  await run("pnpm", ["install", "--ignore-scripts"], consumerDir);
  await run(resolve(root, "node_modules/.bin/tsc"), ["-p", consumerDir], root);
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      "const api = await import('solace'); const runtime = await import('solace/jsx-runtime'); const dev = await import('solace/jsx-dev-runtime'); const devtools = await import('solace/devtools'); if (!api.createApp || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent) process.exit(1);",
    ],
    consumerDir,
  );
  await run(
    "node",
    [
      "-e",
      "const api = require('solace'); const runtime = require('solace/jsx-runtime'); const dev = require('solace/jsx-dev-runtime'); const devtools = require('solace/devtools'); if (!api.createApp || !api.defineAsyncComponent || !api.defineComponent || !api.inject || !api.provide || !api.watchEffect || !runtime.jsx || !dev.jsxDEV || !devtools.createDevtoolsRecorder || !devtools.onDevtoolsEvent || devtools.emitDevtoolsEvent) process.exit(1);",
    ],
    consumerDir,
  );

  console.log("package consumer smoke passed");
} finally {
  await rm(workspace, { recursive: true, force: true });
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
