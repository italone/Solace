import { spawn } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createBenchmarkMetadata } from "./benchmark-metadata.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const benchmarkCommand = "pnpm";
const benchmarkArgs = ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"];
const dryRun = process.argv.includes("--dry-run");
const jsonOnly = process.argv.includes("--json");

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function main() {
  const sampleSize = parseSampleSize(process.env);
  const historyPath = parseHistoryPath(process.env);
  const plan = createRunPlan({ sampleSize, historyPath });

  if (dryRun) {
    if (jsonOnly) {
      console.log(JSON.stringify(plan));
      return;
    }

    console.log(`benchmark dry run: ${plan.sampleSize} sample(s)`);
    return;
  }

  const metadata = await createBenchmarkMetadata(plan.sampleSize);
  const metricsPath =
    plan.historyPath === undefined ? undefined : await createBenchmarkMetricsPath();
  console.log(`benchmark metadata: ${JSON.stringify(metadata)}`);

  try {
    for (let index = 1; index <= plan.sampleSize; index += 1) {
      console.log(`benchmark sample ${index}/${plan.sampleSize}`);
      await runCommand(plan.command, plan.args, { metricsPath });
    }

    if (plan.historyPath !== undefined) {
      const tasks = metricsPath === undefined ? [] : await readBenchmarkMetrics(metricsPath);
      await appendBenchmarkHistory(plan.historyPath, {
        kind: "jsdom-benchmark",
        status: "passed",
        metadata,
        sampleCount: plan.sampleSize,
        command: plan.command,
        args: plan.args,
        ...(tasks.length === 0 ? {} : { summary: { tasks } }),
      });
    }
  } finally {
    if (metricsPath !== undefined) {
      await rm(dirname(metricsPath), { recursive: true, force: true });
    }
  }
}

function createRunPlan({ sampleSize, historyPath }) {
  const plan = {
    command: benchmarkCommand,
    args: benchmarkArgs,
    sampleSize,
  };

  if (historyPath !== undefined) {
    return {
      ...plan,
      historyPath,
    };
  }

  return plan;
}

function parseSampleSize(env) {
  const rawValue = env.SOLACE_BENCHMARK_SAMPLE_SIZE;
  if (rawValue === undefined || rawValue === "") {
    return 1;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("SOLACE_BENCHMARK_SAMPLE_SIZE must be a positive integer");
  }

  return value;
}

function parseHistoryPath(env) {
  const rawValue = env.SOLACE_BENCHMARK_HISTORY_PATH;
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue.trim() === "") {
    throw new Error("SOLACE_BENCHMARK_HISTORY_PATH must not be empty");
  }

  return rawValue;
}

async function createBenchmarkMetricsPath() {
  const directory = await mkdtemp(join(tmpdir(), "solace-benchmark-metrics-"));
  return join(directory, "metrics.jsonl");
}

async function readBenchmarkMetrics(metricsPath) {
  const content = await readFile(metricsPath, "utf8");
  const records = [];

  content.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "") {
      return;
    }

    try {
      records.push(JSON.parse(line));
    } catch {
      throw new Error(`Invalid benchmark metrics JSON at ${metricsPath}:${index + 1}`);
    }
  });

  return records;
}

async function appendBenchmarkHistory(historyPath, record) {
  const resolvedHistoryPath = resolve(root, historyPath);
  await mkdir(dirname(resolvedHistoryPath), { recursive: true });
  await appendFile(resolvedHistoryPath, `${JSON.stringify(record)}\n`, "utf8");
}

function runCommand(command, args, { metricsPath } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(metricsPath === undefined ? {} : { SOLACE_BENCHMARK_METRICS_PATH: metricsPath }),
      },
    });

    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      if (signal !== null) {
        rejectRun(new Error(`${command} ${args.join(" ")} failed with signal ${signal}`));
        return;
      }

      rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
