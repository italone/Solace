import { readFile } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), "..");
const jsonOnly = process.argv.includes("--json");
const isCli = process.argv[1] === scriptPath;

if (isCli) {
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
}

export function parseSampleSize(argv, env) {
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

export function parseBenchmarkCommitSha(env, { required = false } = {}) {
  const value = env.SOLACE_BENCHMARK_COMMIT_SHA;
  if (value === undefined || value === "") {
    if (required) {
      throw new Error("SOLACE_BENCHMARK_COMMIT_SHA is required for persisted benchmark history");
    }
    return undefined;
  }
  if (!/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error("SOLACE_BENCHMARK_COMMIT_SHA must be a 40-character lowercase hexadecimal SHA");
  }
  return value;
}

export async function createBenchmarkMetadata(sampleSize, env = process.env) {
  const packageJson = await readPackageJson();
  const cpuList = cpus();
  const [primaryCpu] = cpuList;
  const currentPlatform = platform();
  const currentArch = arch();
  const commitSha = parseBenchmarkCommitSha(env);

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
    ...(commitSha === undefined ? {} : { commitSha }),
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
