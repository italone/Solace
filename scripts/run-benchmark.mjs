import { spawn } from "node:child_process";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  console.log(`benchmark metadata: ${JSON.stringify(metadata)}`);

  for (let index = 1; index <= plan.sampleSize; index += 1) {
    console.log(`benchmark sample ${index}/${plan.sampleSize}`);
    await runCommand(plan.command, plan.args);
  }

  if (plan.historyPath !== undefined) {
    await appendBenchmarkHistory(plan.historyPath, {
      kind: "jsdom-benchmark",
      status: "passed",
      metadata,
      sampleCount: plan.sampleSize,
      command: plan.command,
      args: plan.args,
    });
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

async function appendBenchmarkHistory(historyPath, record) {
  const resolvedHistoryPath = resolve(root, historyPath);
  await mkdir(dirname(resolvedHistoryPath), { recursive: true });
  await appendFile(resolvedHistoryPath, `${JSON.stringify(record)}\n`, "utf8");
}

function runCommand(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
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
