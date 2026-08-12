const PACKAGE_NAME = "@italone/solace";
const EXACT_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const DIST_TAG = /^[A-Za-z][A-Za-z0-9._-]*$/;

export function parseRegistrySmokeArguments(args) {
  if (args.length === 1 && args[0] === "--help") {
    return { help: true };
  }
  if (args.length !== 1 || typeof args[0] !== "string" || args[0].length === 0) {
    throw usageError();
  }

  const target = args[0];
  const exactVersion = EXACT_VERSION.test(target) ? target : undefined;
  if (exactVersion === undefined && !DIST_TAG.test(target)) {
    throw usageError(`Unsafe or unsupported target: ${JSON.stringify(target)}`);
  }

  return { target, exactVersion };
}

export function createRegistryConsumerPackageJson(target) {
  return {
    private: true,
    type: "module",
    dependencies: { [PACKAGE_NAME]: target },
  };
}

export function createRegistryInstallArguments() {
  return ["install", "--ignore-scripts"];
}

export function createRegistryProbeSource(exactVersion) {
  return `function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function stageError(stage, error) {
  return new Error(\`\${stage}: \${message(error)}\`, { cause: error });
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new Error(\`missing \${label}\`);
}

export async function runRegistryProbe() {
  let api, jsxRuntime, jsxDevRuntime, devtools, server, sfc, vite;
  try {
    [api, jsxRuntime, jsxDevRuntime, devtools, server, sfc, vite] = await Promise.all([
      import("@italone/solace"),
      import("@italone/solace/jsx-runtime"),
      import("@italone/solace/jsx-dev-runtime"),
      import("@italone/solace/devtools"),
      import("@italone/solace/server"),
      import("@italone/solace/sfc"),
      import("@italone/solace/vite"),
    ]);
    requireFunction(api.h, "root h export");
    requireFunction(api.createApp, "root createApp export");
    requireFunction(jsxRuntime.jsx, "jsx runtime export");
    requireFunction(jsxDevRuntime.jsxDEV, "jsx dev runtime export");
    requireFunction(devtools.onDevtoolsEvent, "DevTools listener export");
    requireFunction(devtools.createDevtoolsRecorder, "DevTools recorder export");
    requireFunction(server.renderToString, "server render export");
    requireFunction(vite.solacePlugin, "Vite plugin export");
    if (Object.keys(sfc).length !== 0) throw new Error("SFC shim runtime must stay empty");
  } catch (error) {
    throw stageError("registry smoke public entry failed", error);
  }

  let metadata;
  try {
    metadata = (await import("@italone/solace/package.json", { with: { type: "json" } })).default;
    if (metadata.name !== "@italone/solace") throw new Error("package name mismatch");
    if (typeof metadata.version !== "string") throw new Error("package version is missing");
    ${
      exactVersion === undefined
        ? ""
        : `if (metadata.version !== ${JSON.stringify(exactVersion)}) throw new Error("package version mismatch");`
    }
  } catch (error) {
    throw stageError("registry smoke metadata failed", error);
  }

  try {
    const rendered = server.renderToString(api.h("p", null, "registry contract smoke"));
    if (rendered.html !== "<p>registry contract smoke</p>" || rendered.styles.length !== 0) {
      throw new Error("server rendering output mismatch");
    }
  } catch (error) {
    throw stageError("registry smoke server render failed", error);
  }

  try {
    await import("@italone/solace/dist/index.js");
    throw new Error("private deep path unexpectedly resolved");
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      throw stageError("registry smoke private entry failed", error);
    }
  }

  return { checkedEntries: 8, version: metadata.version };
}
`;
}

function usageError(detail) {
  const suffix = detail === undefined ? "" : `: ${detail}`;
  return new Error(
    `registry smoke usage failed${suffix}\nUsage: node scripts/registry-contract-smoke.mjs <version-or-dist-tag>`,
  );
}
