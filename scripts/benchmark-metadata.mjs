import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsonOnly = process.argv.includes("--json");

const metadata = await createBenchmarkMetadata();
const payload = JSON.stringify(metadata);

if (jsonOnly) {
  console.log(payload);
} else {
  console.log(`benchmark metadata: ${payload}`);
}

async function createBenchmarkMetadata() {
  const packageJson = await readPackageJson();
  const cpuList = cpus();
  const [primaryCpu] = cpuList;
  const currentPlatform = platform();
  const currentArch = arch();

  return {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    node: process.version,
    platform: currentPlatform,
    release: release(),
    arch: currentArch,
    runtime: `${currentPlatform} ${currentArch}`,
    cpuModel: primaryCpu?.model ?? "unknown",
    logicalCpuCount: cpuList.length,
    totalMemoryBytes: totalmem(),
    benchmarkRunner: "vitest",
    benchmarkEnvironment: "jsdom",
    sampleSize: 1,
    runAt: new Date().toISOString(),
  };
}

async function readPackageJson() {
  const raw = await readFile(resolve(root, "package.json"), "utf8");
  const packageJson = JSON.parse(raw);

  if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    throw new Error("package.json must include string name and version for benchmark metadata");
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}
