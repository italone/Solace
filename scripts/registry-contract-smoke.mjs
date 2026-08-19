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
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal === null ? `exit code ${code}` : `signal ${signal}`}`,
        ),
      );
    });
  });
}
