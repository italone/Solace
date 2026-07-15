import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  const plan = createRunPlan(sampleSize);

  if (dryRun) {
    if (jsonOnly) {
      console.log(JSON.stringify(plan));
      return;
    }

    console.log(`benchmark dry run: ${plan.sampleSize} sample(s)`);
    return;
  }

  await runCommand("node", [
    "scripts/benchmark-metadata.mjs",
    "--sample-size",
    String(plan.sampleSize),
  ]);

  for (let index = 1; index <= plan.sampleSize; index += 1) {
    console.log(`benchmark sample ${index}/${plan.sampleSize}`);
    await runCommand(plan.command, plan.args);
  }
}

function createRunPlan(sampleSize) {
  return {
    command: benchmarkCommand,
    args: benchmarkArgs,
    sampleSize,
  };
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
