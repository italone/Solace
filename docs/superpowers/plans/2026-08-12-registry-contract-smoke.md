# Registry Contract Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable, explicit network-backed command that validates a selected published `@italone/solace` version or dist-tag against the protected registry contract without changing runtime or release state.

**Architecture:** Keep argument validation, temporary consumer metadata, and generated probe source in a small pure config module. The CLI owns temporary-workspace lifecycle, dependency installation, probe execution, stage-prefixed errors, and cleanup; unit tests inject install/probe functions so they never reach npm. The command remains a manual post-publish audit and is not added to ordinary CI, quality, candidate, or publish gates.

**Tech Stack:** Node.js ESM, pnpm 10, Vitest, npm registry, Prettier, existing release documentation and project-log conventions.

---

## File Map

- Create `scripts/registry-contract-smoke-config.mjs`: pure target parsing, exact-version detection,
  consumer `package.json`, and generated registry probe.
- Create `scripts/registry-contract-smoke.mjs`: CLI entry, temporary workspace, install/probe
  orchestration, stage errors, and cleanup.
- Create `tests/unit/scripts/registry-contract-smoke.test.ts`: network-free tests for the pure
  contract and injected orchestration.
- Modify `package.json`: add only `registry:smoke`; leave version and existing gate commands intact.
- Modify `tests/unit/scripts/release-readiness-check.test.ts`: lock the new script and prove the
  existing release/candidate command arrays did not change.
- Modify `tests/unit/docs/release-docs.test.ts`: lock the documented post-publish command boundary.
- Modify `docs/release.md`: distinguish local candidate, pinned upgrade, and published registry
  validation.
- Create `solace-project-log/solace-entries/2026-08-12-002-registry-contract-smoke.md`: record the
  tooling and fresh exact-beta.4 result.
- Modify `solace-project-log/index.md`: add the new project-log row.

No task modifies `src/**`, package exports, the package version, `CHANGELOG.md`, `.changeset/**`, CI,
Git release tags, or npm dist-tags.

### Task 1: Define the target and generated-probe contract

**Files:**

- Create: `scripts/registry-contract-smoke-config.mjs`
- Create: `tests/unit/scripts/registry-contract-smoke.test.ts`

- [ ] **Step 1: Write the failing pure-contract tests**

Create `tests/unit/scripts/registry-contract-smoke.test.ts` with the initial contract tests:

```ts
import { describe, expect, it } from "vitest";

import {
  createRegistryConsumerPackageJson,
  createRegistryInstallArguments,
  createRegistryProbeSource,
  parseRegistrySmokeArguments,
} from "../../../scripts/registry-contract-smoke-config.mjs";

const protectedEntries = [
  "@italone/solace",
  "@italone/solace/jsx-runtime",
  "@italone/solace/jsx-dev-runtime",
  "@italone/solace/devtools",
  "@italone/solace/server",
  "@italone/solace/sfc",
  "@italone/solace/vite",
  "@italone/solace/package.json",
];

describe("registry contract smoke", () => {
  it("requires one explicit exact version or dist-tag", () => {
    expect(parseRegistrySmokeArguments(["0.1.0-beta.4"])).toEqual({
      exactVersion: "0.1.0-beta.4",
      target: "0.1.0-beta.4",
    });
    expect(parseRegistrySmokeArguments(["beta"])).toEqual({
      exactVersion: undefined,
      target: "beta",
    });
    expect(parseRegistrySmokeArguments(["--help"])).toEqual({ help: true });
  });

  it.each<[string[]]>([
    [[]],
    [["beta", "extra"]],
    [["@italone/solace@beta"]],
    [["file:../solace.tgz"]],
    [["https://registry.example/solace.tgz"]],
    [["../beta"]],
    [["beta latest"]],
    [["^0.1.0"]],
  ])("rejects unsafe or ambiguous targets: %j", (args) => {
    expect(() => parseRegistrySmokeArguments(args)).toThrow("registry smoke usage failed");
  });

  it("pins only the fixed Solace package", () => {
    expect(createRegistryConsumerPackageJson("0.1.0-beta.4")).toEqual({
      private: true,
      type: "module",
      dependencies: { "@italone/solace": "0.1.0-beta.4" },
    });
  });

  it("disables lifecycle scripts during registry installation", () => {
    expect(createRegistryInstallArguments()).toEqual(["install", "--ignore-scripts"]);
  });

  it("generates the complete protected-entry probe", () => {
    const source = createRegistryProbeSource("0.1.0-beta.4");

    for (const entry of protectedEntries) {
      expect(source).toContain(JSON.stringify(entry));
    }
    expect(source).toContain('import("@italone/solace/package.json", { with: { type: "json" } })');
    expect(source).toContain("Object.keys(sfc).length !== 0");
    expect(source).toContain("<p>registry contract smoke</p>");
    expect(source).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED");
    expect(source).toContain("@italone/solace/dist/index.js");
    expect(source).toContain('metadata.version !== "0.1.0-beta.4"');
  });

  it("embeds every stable failure stage", () => {
    const source = createRegistryProbeSource(undefined);

    for (const stage of [
      "registry smoke metadata failed",
      "registry smoke public entry failed",
      "registry smoke server render failed",
      "registry smoke private entry failed",
    ]) {
      expect(source).toContain(stage);
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts
```

Expected: FAIL because `scripts/registry-contract-smoke-config.mjs` does not exist.

- [ ] **Step 3: Implement argument parsing and consumer metadata**

Create `scripts/registry-contract-smoke-config.mjs` with these public helpers and exact validation:

```js
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

function usageError(detail) {
  const suffix = detail === undefined ? "" : `: ${detail}`;
  return new Error(
    `registry smoke usage failed${suffix}\nUsage: node scripts/registry-contract-smoke.mjs <version-or-dist-tag>`,
  );
}
```

- [ ] **Step 4: Implement the generated ESM probe**

In the same config module, add `createRegistryProbeSource(exactVersion)`. The returned source must
define `runRegistryProbe()` and perform the checks in separately prefixed `try` blocks:

```js
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
    ${exactVersion === undefined ? "" : `if (metadata.version !== ${JSON.stringify(exactVersion)}) throw new Error("package version mismatch");`}
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
```

- [ ] **Step 5: Run the pure-contract test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts
```

Expected: PASS with 6 tests and no network access.

- [ ] **Step 6: Commit the pure contract**

```bash
git add scripts/registry-contract-smoke-config.mjs tests/unit/scripts/registry-contract-smoke.test.ts
git commit -m "test: define registry smoke contract"
```

### Task 2: Implement temporary-consumer orchestration and cleanup

**Files:**

- Create: `scripts/registry-contract-smoke.mjs`
- Modify: `tests/unit/scripts/registry-contract-smoke.test.ts`

- [ ] **Step 1: Add failing orchestration and cleanup tests**

Extend the test file with Node filesystem imports and these tests. Inject install and probe behavior;
do not spawn pnpm:

```ts
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runRegistryContractSmoke } from "../../../scripts/registry-contract-smoke.mjs";

it("writes the consumer, disables install scripts, runs the probe, and cleans up", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
  let workspace = "";
  const calls: string[] = [];

  try {
    const result = await runRegistryContractSmoke("0.1.0-beta.4", {
      exactVersion: "0.1.0-beta.4",
      temporaryRoot,
      install: async (cwd, packageJsonPath) => {
        workspace = cwd;
        calls.push(`install:${cwd}`);
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
        expect(packageJson.dependencies).toEqual({ "@italone/solace": "0.1.0-beta.4" });
      },
      executeProbe: async (probePath) => {
        calls.push(`probe:${probePath}`);
        const probe = await readFile(probePath, "utf8");
        expect(probe).toContain("registry contract smoke");
        return { checkedEntries: 8, version: "0.1.0-beta.4" };
      },
      log: () => undefined,
    });

    expect(result).toEqual({ checkedEntries: 8, version: "0.1.0-beta.4" });
    expect(calls).toHaveLength(2);
    await expect(access(workspace)).rejects.toThrow();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

it("prefixes install failures and still cleans up", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
  let workspace = "";

  try {
    await expect(
      runRegistryContractSmoke("beta", {
        exactVersion: undefined,
        temporaryRoot,
        install: async (cwd) => {
          workspace = cwd;
          throw new Error("registry unavailable");
        },
        executeProbe: async () => {
          throw new Error("probe must not run");
        },
        log: () => undefined,
      }),
    ).rejects.toThrow("registry smoke install failed: registry unavailable");
    await expect(access(workspace)).rejects.toThrow();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

it("preserves probe stage failures and still cleans up", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-registry-test-"));
  let workspace = "";

  try {
    await expect(
      runRegistryContractSmoke("beta", {
        exactVersion: undefined,
        temporaryRoot,
        install: async (cwd) => {
          workspace = cwd;
        },
        executeProbe: async () => {
          throw new Error("registry smoke server render failed: output mismatch");
        },
        log: () => undefined,
      }),
    ).rejects.toThrow("registry smoke server render failed: output mismatch");
    await expect(access(workspace)).rejects.toThrow();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts
```

Expected: FAIL because `scripts/registry-contract-smoke.mjs` does not exist.

- [ ] **Step 3: Implement the CLI and injectable orchestration**

Create `scripts/registry-contract-smoke.mjs` with a main guard, exported orchestration for tests, and
these exact boundaries:

```js
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createRegistryConsumerPackageJson,
  createRegistryInstallArguments,
  createRegistryProbeSource,
  parseRegistrySmokeArguments,
} from "./registry-contract-smoke-config.mjs";

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function main() {
  const options = parseRegistrySmokeArguments(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/registry-contract-smoke.mjs <version-or-dist-tag>");
    return;
  }
  await runRegistryContractSmoke(options.target, { exactVersion: options.exactVersion });
}

export async function runRegistryContractSmoke(
  target,
  {
    exactVersion,
    temporaryRoot = tmpdir(),
    install = installRegistryPackage,
    executeProbe = executeRegistryProbe,
    log = console.log,
  } = {},
) {
  const workspace = await mkdtemp(join(temporaryRoot, "solace-registry-smoke-"));
  const packageJsonPath = join(workspace, "package.json");
  const probePath = join(workspace, "registry-probe.mjs");

  try {
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(createRegistryConsumerPackageJson(target), null, 2)}\n`,
      "utf8",
    );
    await writeFile(probePath, createRegistryProbeSource(exactVersion), "utf8");

    log(`Installing @italone/solace@${target} from npm`);
    try {
      await install(workspace, packageJsonPath);
    } catch (error) {
      throw prefixed("registry smoke install failed", error);
    }

    const result = await executeProbe(probePath);
    log(
      `Registry contract smoke passed: requested ${target}, resolved ${result.version}; checks: ${result.checkedEntries} public entries, server render, private entry`,
    );
    return result;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function installRegistryPackage(workspace) {
  await run("pnpm", createRegistryInstallArguments(), workspace);
}

async function executeRegistryProbe(probePath) {
  const probe = await import(`${pathToFileURL(probePath).href}?run=${Date.now()}`);
  return probe.runRegistryProbe();
}

function prefixed(stage, error) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${stage}: ${message}`, { cause: error });
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) return resolveRun();
      rejectRun(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal === null ? `exit code ${code}` : `signal ${signal}`}`,
        ),
      );
    });
  });
}
```

Do not add signal handling in this slice. The workspace `finally` covers normal command failures;
the existing Operations Console signal lifecycle remains separate and should not be copied without a
demonstrated registry-smoke need.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts
```

Expected: PASS with 9 tests; no npm request is made.

- [ ] **Step 5: Verify CLI usage without network**

Run:

```bash
node scripts/registry-contract-smoke.mjs --help
node scripts/registry-contract-smoke.mjs
```

Expected: `--help` exits 0 and prints usage. The missing-target call exits 1 with
`registry smoke usage failed` and does not create a persistent workspace.

- [ ] **Step 6: Commit orchestration**

```bash
git add scripts/registry-contract-smoke.mjs tests/unit/scripts/registry-contract-smoke.test.ts
git commit -m "feat: add registry contract smoke cli"
```

### Task 3: Wire the explicit package command without changing release gates

**Files:**

- Modify: `package.json:80-96`
- Modify: `tests/unit/scripts/release-readiness-check.test.ts:99-141`

- [ ] **Step 1: Add a failing package-script boundary test**

Add this test after the existing release gate ordering tests:

```ts
test("keeps registry smoke explicit and outside ordinary release gates", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };

  expect(packageJson.scripts?.["registry:smoke"]).toBe("node scripts/registry-contract-smoke.mjs");
  expect(packageJson.scripts?.quality).not.toContain("registry:smoke");
  expect(packageJson.scripts?.["release:check"]).not.toContain("registry:smoke");
  expect(packageJson.scripts?.["release:candidate:check"]).not.toContain("registry:smoke");
  expect(packageJson.scripts?.["release:publish:beta"]).not.toContain("registry:smoke");
});
```

- [ ] **Step 2: Run the focused script tests and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts
```

Expected: FAIL only because `package.json` does not yet contain `registry:smoke`.

- [ ] **Step 3: Add only the explicit package script**

Add this entry beside `package:smoke`:

```json
"registry:smoke": "node scripts/registry-contract-smoke.mjs"
```

Do not change `quality`, `release:check`, `release:candidate:check`, either publish command, or CI.
Do not make `release-readiness-check.mjs` require the post-publish command; availability is locked by
the package-script test while publish readiness stays candidate-focused.

- [ ] **Step 4: Run the focused script tests and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/scripts/registry-contract-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit package wiring**

```bash
git add package.json tests/unit/scripts/release-readiness-check.test.ts
git commit -m "chore: expose registry smoke command"
```

### Task 4: Document the post-publish boundary and record exact beta.4 evidence

**Files:**

- Modify: `tests/unit/docs/release-docs.test.ts`
- Modify: `docs/release.md`
- Create: `solace-project-log/solace-entries/2026-08-12-002-registry-contract-smoke.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add a failing release-document contract test**

Add this test to `tests/unit/docs/release-docs.test.ts`:

```ts
it("separates local, upgrade, and published package smoke checks", async () => {
  const release = await readFile("docs/release.md", "utf8");

  expect(release).toContain("## Post-Publish Registry Verification");
  expect(release).toContain("pnpm package:smoke");
  expect(release).toContain("pnpm stable:app:upgrade");
  expect(release).toContain("pnpm registry:smoke -- <version-or-dist-tag>");
  expect(release).toContain("explicit network-backed audit");
  expect(release).toContain("not part of routine pull-request CI");
  expect(release).toContain("does not replace the local candidate gates");
});
```

- [ ] **Step 2: Run the documentation test and verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/docs/release-docs.test.ts
```

Expected: FAIL because the post-publish section is absent.

- [ ] **Step 3: Add the release documentation section**

Insert this section after `Stable Compatibility Checklist` and before async compatibility:

```markdown
## Post-Publish Registry Verification

After npm reports the published version, validate the exact registry artifact with:

\`\`\`bash
pnpm registry:smoke -- <version-or-dist-tag>
\`\`\`

Prefer the exact published version in release evidence. A dist-tag such as `beta` or `latest` is
accepted for a manual current-line audit, and the command reports the resolved package version. This
is an explicit network-backed audit and is not part of routine pull-request CI. It does not replace
the local candidate gates: use `pnpm package:smoke` for the local tarball and
`pnpm stable:app:upgrade` for the pinned real-application compatibility comparison.

The registry smoke installs only `@italone/solace` with lifecycle scripts disabled, verifies all
eight protected public entries, checks one server-rendered paragraph, and confirms a private
`dist/**` deep path remains blocked. Install-stage DNS, authentication, timeout, and package-not-found
errors must be reported separately from package contract failures.
```

- [ ] **Step 4: Run documentation and focused tests**

Run:

```bash
pnpm exec vitest run tests/unit/docs/release-docs.test.ts tests/unit/scripts/registry-contract-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Run the exact published beta.4 registry smoke**

Run:

```bash
pnpm registry:smoke -- 0.1.0-beta.4
```

Expected success summary:

```text
Registry contract smoke passed: requested 0.1.0-beta.4, resolved 0.1.0-beta.4; checks: 8 public entries, server render, private entry
```

If the first attempt fails with DNS, timeout, or other install-stage network output, retry the same
command with approved network access. Do not weaken assertions or change the target.

- [ ] **Step 6: Run scoped full validation**

Run:

```bash
pnpm quality
pnpm release:readiness
pnpm format:check
git diff --check
git diff v0.1.0-beta.4^{}..HEAD --name-only | rg '^src/' || true
git status --short --branch
```

Expected:

- `quality` passes, including build, typechecks, lint, the complete current Vitest inventory, and all
  16 package tests;
- release readiness passes;
- formatting and diff checks pass;
- no `src/**` path is printed;
- only the approved script/test/package/docs/log files are modified.

- [ ] **Step 7: Add the project-log evidence**

Create `solace-project-log/solace-entries/2026-08-12-002-registry-contract-smoke.md` using the existing
Chinese log structure. Record:

```markdown
# 2026-08-12-002：固化 registry contract smoke

## 基本信息

- 日期：2026-08-12
- 类型：release tooling / registry contract / tests / docs
- 状态：已完成

## 变动摘要

新增显式 `pnpm registry:smoke -- <version-or-dist-tag>`，在临时消费者中安装指定 npm package，
验证八个受保护公开入口、服务端 paragraph 输出和私有 deep path 阻断。该命令不进入普通 CI、
`quality`、candidate 或 publish gate，不修改 runtime、版本、tag 或 dist-tag。

## 验证记录

| 验证项               | 命令                                                                                                                                                              | 结果                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Focused tests        | `pnpm exec vitest run tests/unit/docs/release-docs.test.ts tests/unit/scripts/registry-contract-smoke.test.ts tests/unit/scripts/release-readiness-check.test.ts` | 写入该次命令输出中的 test file 与 test 总数                                     |
| Exact registry smoke | `pnpm registry:smoke -- 0.1.0-beta.4`                                                                                                                             | 通过；resolved version 为 `0.1.0-beta.4`，八入口、SSR 和 private entry 检查通过 |
| Quality              | `pnpm quality`                                                                                                                                                    | 写入该次命令的实际 Vitest 与 package test 总数                                  |
| Release readiness    | `pnpm release:readiness`                                                                                                                                          | 通过；现有 candidate/release gate 未改变                                        |
| Formatting           | `pnpm format:check`                                                                                                                                               | 通过                                                                            |

## 边界

- `src/**`、package version、exports、Changesets、Git tag 与 npm dist-tags 未改变。
- registry 网络失败属于 install stage，不应被描述为 package contract regression。
```

Run the listed commands before writing their result cells, and copy only the observed file/test
counts from that execution. Do not reuse beta.4 publication counts if the new tests change them. Add
index row `002` under `2026-08-12` pointing to this file.

- [ ] **Step 8: Commit documentation and evidence**

```bash
git add docs/release.md tests/unit/docs/release-docs.test.ts solace-project-log/index.md solace-project-log/solace-entries/2026-08-12-002-registry-contract-smoke.md
git commit -m "docs: record registry contract smoke"
```

### Task 5: Final frozen-scope review

**Files:**

- No edits expected

- [ ] **Step 1: Review the complete implementation diff**

Run:

```bash
git diff 0f575a7..HEAD --name-only
git diff 0f575a7..HEAD --stat
```

Expected files are limited to:

```text
docs/release.md
package.json
scripts/registry-contract-smoke-config.mjs
scripts/registry-contract-smoke.mjs
solace-project-log/index.md
solace-project-log/solace-entries/2026-08-12-002-registry-contract-smoke.md
tests/unit/docs/release-docs.test.ts
tests/unit/scripts/registry-contract-smoke.test.ts
tests/unit/scripts/release-readiness-check.test.ts
```

- [ ] **Step 2: Verify immutable release state**

Run:

```bash
node -p "require('./package.json').version"
git rev-parse v0.1.0-beta.4^{}
npm view @italone/solace dist-tags --json
```

Expected:

```text
0.1.0-beta.4
fbe69842b13a1be6d2207976cb1f43e21ae369ef
latest = 0.0.5; beta = 0.1.0-beta.4
```

- [ ] **Step 3: Verify final clean branch after approved integration action**

Do not push, tag, publish, or create a PR unless the maintainer explicitly selects that integration
action. Before reporting completion, run:

```bash
git status --short --branch
git diff --check
```

Report any unpushed commits or skipped remote checks explicitly.
