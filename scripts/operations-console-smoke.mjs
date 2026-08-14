import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

import {
  baselineSupportsAsyncRendering,
  createConsumerPackageJson,
  createConsumerTsconfig,
  parseSmokeArguments,
} from "./operations-console-smoke-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const operationsSource = join(root, "examples", "operations-console", "src");
const operationsIndex = join(root, "examples", "operations-console", "index.html");
const operationsHydration = join(root, "examples", "operations-console", "hydration.html");
const browserGlobalNames = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "CustomEvent",
  "MutationObserver",
  "HTMLAnchorElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "location",
  "history",
  "fetch",
];
const activeChildren = new Set();
const activeChildExitPromises = new Set();
let activeWorkspace = null;
let interruptedSignal;
const signalHandlers = new Map();

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    if (process.exitCode === undefined) {
      process.exitCode = 1;
    }
  });
}

async function main() {
  const options = parseSmokeArguments(process.argv.slice(2));
  installSignalHandlers();

  try {
    activeWorkspace = await realpath(await mkdtemp(join(tmpdir(), "solace-operations-consumer-")));

    for (const baseline of options.baselines) {
      try {
        console.log(`Running baseline consumer with @italone/solace@${baseline}`);
        await runConsumer({
          consumerDir: join(activeWorkspace, `baseline-${baseline}`),
          packageSpec: baseline,
          includeAsync: baselineSupportsAsyncRendering(baseline),
        });
      } catch (error) {
        throw withFailurePrefix(`baseline ${baseline} compatibility failed`, error);
      }
    }

    try {
      const tarball = await packCandidate(activeWorkspace);
      console.log(`Running local candidate consumer from ${tarball}`);
      await runConsumer({
        consumerDir: join(activeWorkspace, "candidate"),
        packageSpec: `file:${tarball}`,
        includeAsync: true,
      });
    } catch (error) {
      throw withFailurePrefix("local candidate compatibility failed", error);
    }

    console.log("Operations Console packed consumer smoke passed");
  } finally {
    try {
      await waitForChildren();
      if (activeWorkspace !== null) {
        const workspace = activeWorkspace;
        activeWorkspace = null;
        await rm(workspace, { recursive: true, force: true });
      }
    } finally {
      removeSignalHandlers();
      if (interruptedSignal !== undefined) {
        process.exitCode = interruptedSignal === "SIGINT" ? 130 : 143;
      }
    }
  }
}

async function packCandidate(workspace) {
  const packDir = join(workspace, "pack");
  await run("pnpm", ["build"], root);
  await run("pnpm", ["pack", "--pack-destination", packDir], root);

  const tarballs = (await readdir(packDir)).filter((entry) => entry.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one packed tarball in ${packDir}, found ${tarballs.length}`);
  }

  return join(packDir, tarballs[0]);
}

async function runConsumer({ consumerDir, packageSpec, includeAsync }) {
  await cp(operationsSource, join(consumerDir, "src"), { recursive: true });
  await cp(operationsIndex, join(consumerDir, "index.html"));
  await cp(operationsHydration, join(consumerDir, "hydration.html"));

  const viteConfig = join(consumerDir, "vite.config.mjs");
  await writeFile(
    join(consumerDir, "package.json"),
    `${JSON.stringify(createConsumerPackageJson(packageSpec), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(consumerDir, "tsconfig.json"),
    `${JSON.stringify(createConsumerTsconfig(includeAsync), null, 2)}\n`,
    "utf8",
  );
  await writeFile(viteConfig, createViteConfig(consumerDir), "utf8");

  await run("pnpm", ["install", "--ignore-scripts"], consumerDir);
  await run("pnpm", ["exec", "tsc", "-p", consumerDir], root);

  const browserDir = join(consumerDir, "dist", "browser");
  await runVite(consumerDir, viteConfig, "dist/browser");
  await assertBrowserBuild(browserDir);
  await assertBrowserRuntime(browserDir);

  const coreDir = join(consumerDir, "dist", "server-core");
  await buildServerEntry(consumerDir, viteConfig, "server-core.tsx", "dist/server-core");
  await assertCoreScenario(coreDir);

  if (includeAsync) {
    const asyncDir = join(consumerDir, "dist", "server-async");
    await buildServerEntry(consumerDir, viteConfig, "server-async.tsx", "dist/server-async");
    await assertAsyncScenario(asyncDir);
  }
}

function createViteConfig(consumerDir) {
  return `export default {
  root: ${JSON.stringify(consumerDir)},
  build: {
    rollupOptions: {
      input: {
        index: ${JSON.stringify(join(consumerDir, "index.html"))},
        hydration: ${JSON.stringify(join(consumerDir, "hydration.html"))},
      },
    },
  },
};
`;
}

async function runVite(consumerDir, viteConfig, outputDir) {
  await run(
    "pnpm",
    [
      "exec",
      "vite",
      "build",
      consumerDir,
      "--config",
      viteConfig,
      "--outDir",
      outputDir,
      "--emptyOutDir",
    ],
    root,
  );
}

async function buildServerEntry(consumerDir, viteConfig, entry, outputDir) {
  await run(
    "pnpm",
    [
      "exec",
      "vite",
      "build",
      consumerDir,
      "--config",
      viteConfig,
      "--ssr",
      join(consumerDir, "src", "entries", entry),
      "--outDir",
      outputDir,
      "--emptyOutDir",
    ],
    root,
  );
}

async function assertBrowserBuild(browserDir) {
  const files = await listFiles(browserDir);
  for (const expectedHtml of ["index.html", "hydration.html"]) {
    if (!files.includes(join(browserDir, expectedHtml))) {
      throw new Error(`Browser build did not emit ${expectedHtml}`);
    }
  }

  if (!files.some((file) => /\.js$/.test(file))) {
    throw new Error("Browser build did not emit a JavaScript asset");
  }
}

async function assertBrowserRuntime(browserDir) {
  await assertOperationsWorkflow(browserDir);
  await assertHydrationWorkflow(browserDir);
}

async function assertOperationsWorkflow(browserDir) {
  const indexPath = join(browserDir, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  const browserEntry = discoverBrowserEntry(indexHtml, browserDir);
  const dom = new JSDOM(indexHtml, { url: "http://operations-console.test/" });
  let restoreGlobals = () => {};
  let restoreAssetLoads = () => {};

  try {
    restoreGlobals = installBrowserGlobals(dom.window);
    restoreAssetLoads = simulateBuiltAssetLoads(dom.window);
    await import(browserEntry);
    const document = dom.window.document;
    await waitForCondition(
      "Operations overview mount",
      () =>
        document.querySelector("h1#overview-heading")?.textContent?.trim() ===
        "Operations overview",
    );

    clickLink(document, "View incident queue");
    await waitForCondition(
      "incident queue navigation",
      () =>
        dom.window.location.hash === "#/incidents" &&
        document.querySelector("h1#incident-queue-heading")?.textContent?.trim() ===
          "Incident queue",
    );

    const search = requireElement(document, "#incident-search", "incident search input");
    search.value = "checkout";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await waitForCondition("filtered checkout incident", () => {
      const rows = [...document.querySelectorAll("tbody tr[data-incident-id]")];
      return rows.length === 1 && rows[0]?.getAttribute("data-incident-id") === "INC-1042";
    });

    const status = requireElement(document, "#status-INC-1042", "INC-1042 status selector");
    status.value = "monitoring";
    status.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await waitForCondition(
      "INC-1042 monitoring status update",
      () => document.querySelector("#status-INC-1042")?.value === "monitoring",
    );

    clickLink(document, "INC-1042");
    await waitForCondition("INC-1042 monitoring detail", () => {
      const heading = document.querySelector("h1#incident-detail-heading");
      const monitoringStatus = document.querySelector(".page-heading .status--monitoring");
      return (
        dom.window.location.hash === "#/incidents/INC-1042" &&
        heading?.textContent?.includes("INC-1042: Checkout latency spike") === true &&
        monitoringStatus?.textContent?.trim() === "Monitoring"
      );
    });

    clickLink(document, "Releases");
    await waitForCondition("release activity async panels", () => {
      const heading = document.querySelector("h1#release-activity-heading");
      const table = [...document.querySelectorAll("table")].find(
        (candidate) =>
          candidate.querySelector("caption")?.textContent?.trim() === "Release activity",
      );
      const exhaustedAlert = [...document.querySelectorAll('[role="alert"]')].find(
        (candidate) => candidate.textContent?.trim() === "Dependency status unavailable",
      );
      return (
        dom.window.location.hash === "#/releases" &&
        heading?.textContent?.trim() === "Release activity" &&
        table?.querySelectorAll("tbody tr").length === 3 &&
        exhaustedAlert !== undefined
      );
    });
  } finally {
    try {
      restoreAssetLoads();
    } finally {
      try {
        restoreGlobals();
      } finally {
        dom.window.close();
      }
    }
  }
}

async function assertHydrationWorkflow(browserDir) {
  const hydrationPath = join(browserDir, "hydration.html");
  const hydrationHtml = await readFile(hydrationPath, "utf8");
  const hydrationEntry = discoverBrowserEntry(hydrationHtml, browserDir);
  const dom = new JSDOM(hydrationHtml, {
    url: "http://operations-console.test/hydration.html",
  });
  let restoreGlobals = () => {};

  try {
    const document = dom.window.document;
    const matchingRoot = requireElement(document, "#matching-root", "matching hydration root");
    const serverNode = matchingRoot.firstElementChild;
    if (serverNode === null) {
      throw new Error("Hydration browser runtime did not contain the matching server node");
    }

    restoreGlobals = installBrowserGlobals(dom.window);
    await import(hydrationEntry);
    await waitForCondition("hydration completion", () => {
      const matchingResult = document.querySelector("#matching-result");
      const recoveryResult = document.querySelector("#recovery-result");
      return (
        matchingResult?.textContent?.trim() === "server node reused" &&
        recoveryResult?.textContent?.trim() === "mismatch recovered"
      );
    });

    if (matchingRoot.firstElementChild !== serverNode) {
      throw new Error("Hydration browser runtime replaced the matching server node");
    }

    const scopedStyles = document.querySelectorAll(
      'style[data-s-id="operations-console-incident-summary"]',
    );
    if (scopedStyles.length !== 1) {
      throw new Error(`Hydration browser runtime emitted ${scopedStyles.length} scoped styles`);
    }

    clickButton(document, "Increment open incidents");
    await waitForCondition(
      "matching hydration increment",
      () => matchingRoot.querySelector(".operations-summary__count")?.textContent?.trim() === "4",
    );

    const recoveryRoot = requireElement(document, "#recovery-root", "recovery hydration root");
    if (
      recoveryRoot.textContent?.includes("Stale operations summary") === true ||
      recoveryRoot.querySelector(".operations-summary__count")?.textContent?.trim() !== "1"
    ) {
      throw new Error("Hydration browser runtime did not recover the mismatched summary");
    }

    clickButton(recoveryRoot, "Increment recovered count");
    await waitForCondition(
      "recovered hydration increment",
      () => recoveryRoot.querySelector(".operations-summary__count")?.textContent?.trim() === "2",
    );
  } finally {
    try {
      restoreGlobals();
    } finally {
      dom.window.close();
    }
  }
}

export function discoverBrowserEntry(indexHtml, browserDir) {
  const dom = new JSDOM(indexHtml);

  try {
    const script = dom.window.document.querySelector('script[type="module"][src]');
    const source = script?.getAttribute("src");
    if (source === null || source === undefined || source === "") {
      throw new Error("Browser build index did not identify a module entry");
    }

    const sourceUrl = new URL(source, "http://operations-console.test/");
    if (sourceUrl.origin !== "http://operations-console.test") {
      throw new Error(`Browser build module entry must be local: ${source}`);
    }

    return pathToFileURL(join(browserDir, sourceUrl.pathname.replace(/^\/+/, ""))).href;
  } finally {
    dom.window.close();
  }
}

async function waitForCondition(label, predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  }

  throw new Error(`Browser runtime timed out waiting for ${label}`);
}

function clickLink(document, text) {
  const link = [...document.querySelectorAll("a[href]")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (link === undefined) {
    throw new Error(`Browser runtime did not find link ${JSON.stringify(text)}`);
  }

  link.click();
}

function clickButton(root, text) {
  const button = [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (button === undefined) {
    throw new Error(`Browser runtime did not find button ${JSON.stringify(text)}`);
  }

  button.click();
}

function requireElement(root, selector, label) {
  const element = root.querySelector(selector);
  if (element === null) {
    throw new Error(`Browser runtime did not find ${label}`);
  }

  return element;
}

function simulateBuiltAssetLoads(window) {
  const appendChild = window.Node.prototype.appendChild;
  window.Node.prototype.appendChild = function appendBuiltAsset(node) {
    const result = appendChild.call(this, node);
    if (node.nodeName === "LINK" && node.rel === "stylesheet") {
      window.queueMicrotask(() => node.dispatchEvent(new window.Event("load")));
    }

    return result;
  };

  return () => {
    window.Node.prototype.appendChild = appendChild;
  };
}

function installBrowserGlobals(window) {
  const previousDescriptors = new Map();

  try {
    for (const name of browserGlobalNames) {
      previousDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: name === "fetch" ? () => Promise.resolve() : window[name],
      });
    }
  } catch (error) {
    restoreBrowserGlobals(previousDescriptors);
    throw error;
  }

  return () => restoreBrowserGlobals(previousDescriptors);
}

function restoreBrowserGlobals(previousDescriptors) {
  for (const [name, descriptor] of previousDescriptors) {
    if (descriptor === undefined) {
      delete globalThis[name];
    } else {
      Object.defineProperty(globalThis, name, descriptor);
    }
  }
}

async function assertCoreScenario(outputDir) {
  const scenario = await importScenario(outputDir, "server-core", "runCoreRenderingScenario");
  const result = await scenario.runCoreRenderingScenario();

  assertIncludes(result.hydrationBody, 'data-operations-summary=""', "core hydration markup");
  assertIncludes(result.hydrationBody, ">3<", "core hydration count");
  assertIncludes(result.rendered.html, "Open incidents", "core rendered label");
  assertIncludes(result.rendered.html, ">3<", "core rendered count");
  if (
    !result.rendered.styles.some((style) => style.includes("operations-console-incident-summary"))
  ) {
    throw new Error("Core rendered result did not include the incident summary styles");
  }

  const pages = result.site?.pages;
  if (!Array.isArray(pages) || pages.length !== 2) {
    throw new Error("Core SSG result must contain exactly two pages");
  }

  const [overview, incident] = pages;
  if (overview.path !== "/" || incident.path !== "/incidents/INC-1042") {
    throw new Error(`Core SSG paths mismatch: ${JSON.stringify(pages.map((page) => page.path))}`);
  }
  assertIncludes(overview.body, "Open incidents", "core overview SSG body");
  assertIncludes(incident.body, "Critical incidents", "core incident SSG body");
  assertIncludes(incident.body, ">1<", "core incident SSG count");
  assertIncludes(overview.html, "assets/hydration.js", "core SSG hydration asset");
  assertIncludes(overview.html, "assets/operations.css", "core SSG stylesheet asset");
}

async function assertAsyncScenario(outputDir) {
  const scenario = await importScenario(outputDir, "server-async", "runAsyncRenderingScenario");
  const result = await scenario.runAsyncRenderingScenario();

  assertIncludes(result.rendered.html, "Async operations snapshot", "async rendered label");
  assertIncludes(result.rendered.html, ">3<", "async rendered count");
  if (
    !result.rendered.styles.some((style) => style.includes("operations-console-incident-summary"))
  ) {
    throw new Error("Async rendered result did not include the incident summary styles");
  }
  if (JSON.stringify(result.paths) !== JSON.stringify(["/async-overview", "/async-incident"])) {
    throw new Error(`Async SSG paths mismatch: ${JSON.stringify(result.paths)}`);
  }
}

async function importScenario(outputDir, entryName, exportName) {
  const files = await listFiles(outputDir);
  const entry = files.find((file) => {
    const name = basename(file);
    return name === `${entryName}.js` || name === `${entryName}.mjs`;
  });
  if (entry === undefined) {
    throw new Error(`SSR build did not emit ${entryName}.js or ${entryName}.mjs`);
  }

  const module = await import(pathToFileURL(entry).href);
  if (typeof module[exportName] !== "function") {
    throw new Error(`SSR module ${entry} did not export ${exportName}()`);
  }
  return module;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

function assertIncludes(value, expected, label) {
  if (typeof value !== "string" || !value.includes(expected)) {
    throw new Error(`${label} did not include ${JSON.stringify(expected)}`);
  }
}

function withFailurePrefix(prefix, error) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${prefix}: ${message}`, { cause: error });
}

function run(command, args, cwd) {
  if (interruptedSignal !== undefined) {
    return Promise.reject(interruptionError());
  }

  let child;
  let settled = false;

  const exitPromise = new Promise((resolvePromise, rejectPromise) => {
    child = spawn(command, args, createPnpmSpawnOptions(cwd));
    activeChildren.add(child);

    const finish = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      activeChildren.delete(child);
      callback(value);
    };

    child.once("error", (error) => finish(rejectPromise, error));
    child.once("exit", (code, signal) => {
      if (code === 0) {
        finish(resolvePromise);
        return;
      }

      finish(
        rejectPromise,
        new Error(
          `${command} ${args.join(" ")} failed with ${signal === null ? `exit code ${code}` : `signal ${signal}`}`,
        ),
      );
    });

    if (interruptedSignal !== undefined) {
      child.kill(interruptedSignal);
      finish(rejectPromise, interruptionError());
    }
  });

  activeChildExitPromises.add(exitPromise);
  exitPromise.then(
    () => activeChildExitPromises.delete(exitPromise),
    () => activeChildExitPromises.delete(exitPromise),
  );
  return exitPromise;
}

export function createPnpmSpawnOptions(cwd, platform = process.platform) {
  return { cwd, stdio: "inherit", shell: platform === "win32" };
}

function interruptionError() {
  return new Error(`operations console smoke interrupted by ${interruptedSignal}`);
}

async function waitForChildren() {
  while (activeChildExitPromises.size > 0) {
    await Promise.allSettled([...activeChildExitPromises]);
  }
}

function installSignalHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      interruptedSignal ??= signal;
      for (const child of activeChildren) {
        child.kill(signal);
      }
    };

    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }
}

function removeSignalHandlers() {
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }

  signalHandlers.clear();
}
