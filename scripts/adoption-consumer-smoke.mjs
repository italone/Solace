import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "@playwright/test";

import {
  createAdoptionConsumerPackageJson,
  parseAdoptionSmokeArguments,
  withAdoptionFailureStage,
} from "./adoption-consumer-smoke-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "examples", "adoption-consumer");

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runAdoptionConsumerSmoke(parseAdoptionSmokeArguments(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export async function runAdoptionConsumerSmoke(options) {
  const workspace = await realpath(await mkdtemp(join(tmpdir(), "solace-adoption-consumer-")));
  const consumerDir = join(workspace, "consumer");
  let preview;

  try {
    await cp(fixture, consumerDir, { recursive: true });
    const packageSpec = options.packageSpec ?? (await packCandidate(workspace));
    await prepareConsumer(consumerDir, packageSpec);

    try {
      await run("pnpm", ["install", "--ignore-scripts"], consumerDir);
      await run("pnpm", ["exec", "tsc", "--noEmit", "-p", consumerDir], root);
    } catch (error) {
      throw withAdoptionFailureStage("install or typecheck", error);
    }

    const viteConfig = await writeViteConfig(consumerDir);
    try {
      await run("pnpm", ["exec", "vite", "build", consumerDir, "--config", viteConfig], root);
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
          join(consumerDir, "src", "server.tsx"),
          "--outDir",
          join(consumerDir, "dist", "server"),
          "--emptyOutDir",
        ],
        root,
      );
    } catch (error) {
      throw withAdoptionFailureStage("bundle", error);
    }

    await assertServerBundle(consumerDir);

    if (options.browsers) {
      const port = await findFreePort();
      preview = spawn(
        "pnpm",
        [
          "exec",
          "vite",
          "preview",
          consumerDir,
          "--config",
          viteConfig,
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
        ],
        { cwd: root, stdio: "inherit" },
      );
      await waitForServer(`http://127.0.0.1:${port}/`);
      try {
        await assertBrowsers(port);
      } catch (error) {
        throw withAdoptionFailureStage("browser validation", error);
      }
    }

    console.log(
      `Adoption consumer smoke passed: ${packageSpec}; CSR bundle, SSR/hydration recovery${
        options.browsers ? ", Chromium/Firefox/WebKit" : ""
      }`,
    );
  } finally {
    preview?.kill("SIGTERM");
    await rm(workspace, { recursive: true, force: true });
  }
}

async function packCandidate(workspace) {
  const packDir = join(workspace, "pack");
  await mkdir(packDir, { recursive: true });
  await run("pnpm", ["build"], root);
  await run("pnpm", ["pack", "--pack-destination", packDir], root);
  const tarballs = (await readdir(packDir)).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1)
    throw new Error(`Expected one candidate tarball, found ${tarballs.length}`);
  return `file:${join(packDir, tarballs[0])}`;
}

async function prepareConsumer(consumerDir, packageSpec) {
  await writeFile(
    join(consumerDir, "package.json"),
    `${JSON.stringify(createAdoptionConsumerPackageJson(packageSpec), null, 2)}\n`,
  );
  await writeFile(
    join(consumerDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          jsxImportSource: "@italone/solace",
          lib: ["ES2020", "DOM"],
          skipLibCheck: true,
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );
}

async function writeViteConfig(consumerDir) {
  const configPath = join(consumerDir, "vite.config.mjs");
  await writeFile(
    configPath,
    `export default {
  root: ${JSON.stringify(consumerDir)},
  build: {
    outDir: ${JSON.stringify(join(consumerDir, "dist", "browser"))},
    rollupOptions: {
      input: {
        index: ${JSON.stringify(join(consumerDir, "index.html"))},
        hydration: ${JSON.stringify(join(consumerDir, "hydration.html"))},
        routerHydration: ${JSON.stringify(join(consumerDir, "router-hydration.html"))},
      },
    },
  },
};
`,
  );
  return configPath;
}

async function assertServerBundle(consumerDir) {
  const serverDir = join(consumerDir, "dist", "server");
  const entries = (await readdir(serverDir)).filter((name) => name.endsWith(".js"));
  if (entries.length !== 1) throw new Error(`Expected one SSR entry, found ${entries.length}`);
  const module = await import(
    `${pathToFileURL(join(serverDir, entries[0])).href}?run=${Date.now()}`
  );
  const result = await module.runAdoptionServerScenario();
  if (result.syncHtml !== '<button id="hydration-count">count: 1</button>') {
    throw new Error(`SSR output mismatch: ${result.syncHtml}`);
  }
  if (result.asyncHtml !== '<p id="async-server-output">async server output</p>') {
    throw new Error(`Async SSR output mismatch: ${result.asyncHtml}`);
  }
  if (result.routerHtml !== '<div id="router-shell"><main id="router-target">target</main></div>') {
    throw new Error(`Router SSR output mismatch: ${result.routerHtml}`);
  }
  if (!result.routerSnapshot.includes('"fullPath":"/target"')) {
    throw new Error(`Router snapshot output mismatch: ${result.routerSnapshot}`);
  }
  await writeRouterHydrationDocument(consumerDir, result);
}

async function writeRouterHydrationDocument(consumerDir, result) {
  const documentPath = join(consumerDir, "dist", "browser", "router-hydration.html");
  const template = await readFile(documentPath, "utf8");
  await writeFile(
    documentPath,
    template
      .replace("__SOLACE_ROUTER_HTML__", result.routerHtml)
      .replace("__SOLACE_ROUTER_SNAPSHOT__", result.routerSnapshot),
  );
}

async function assertBrowsers(port) {
  for (const [name, browserType] of [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.locator("#csr-count").click();
      if ((await page.locator("#csr-count").textContent())?.trim() !== "count: 1") {
        throw new Error(`${name} CSR counter did not update`);
      }
      await page.getByText("Details", { exact: true }).click();
      await page.waitForSelector("h1:text-is('Package-only route')");

      await page.goto(`http://127.0.0.1:${port}/hydration.html`);
      await page.waitForSelector("#matching-status:text-is('server node reused')");
      await page.waitForSelector("#recovery-status:text-is('mismatch recovered')");
      await page.locator("#hydration-count").click();
      if ((await page.locator("#hydration-count").textContent())?.trim() !== "count: 2") {
        throw new Error(`${name} hydrated counter did not update`);
      }

      await page.goto(`http://127.0.0.1:${port}/router-hydration.html`);
      try {
        await page.waitForSelector("#router-match-status:text-is('router DOM reused')");
        await page.waitForSelector(
          "#router-mismatch-status:text-is('router mismatch blocked before setup')",
        );
      } catch (error) {
        const matchStatus = await page.locator("#router-match-status").textContent();
        const mismatchStatus = await page.locator("#router-mismatch-status").textContent();
        throw new Error(
          `${name} router hydration failed at ${page.url()}; match=${matchStatus}; mismatch=${mismatchStatus}; pageErrors=${pageErrors.join(" | ")}; ${error instanceof Error ? error.message : error}`,
        );
      }
    } finally {
      await browser.close();
    }
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Preview server did not start: ${url}`);
}

async function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : undefined;
      server.close(() =>
        port === undefined
          ? reject(new Error("Unable to allocate preview port"))
          : resolvePort(port),
      );
    });
  });
}

async function run(command, args, cwd) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}
