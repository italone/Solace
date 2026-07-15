import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsonOnly = process.argv.includes("--json");

try {
  const sampleSize = parseSampleSize(process.argv, process.env);
  const metadata = await createBenchmarkMetadata(sampleSize);
  const payload = JSON.stringify(metadata);

  if (jsonOnly) {
    console.log(payload);
  } else {
    console.log(`benchmark metadata: ${payload}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseSampleSize(argv, env) {
  const sampleSizeIndex = argv.indexOf("--sample-size");
  const rawValue =
    sampleSizeIndex === -1 ? env.SOLACE_BENCHMARK_SAMPLE_SIZE : argv[sampleSizeIndex + 1];

  if (rawValue === undefined || rawValue === "") {
    return 1;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("SOLACE_BENCHMARK_SAMPLE_SIZE must be a positive integer");
  }

  return value;
}

async function createBenchmarkMetadata(sampleSize) {
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
    sampleSize,
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
