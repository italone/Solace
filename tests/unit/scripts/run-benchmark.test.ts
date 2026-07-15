import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkRunPlan = {
  command: string;
  args: string[];
  sampleSize: number;
};

describe("benchmark runner CLI", () => {
  test("prints a dry-run plan with the default sample size", async () => {
    const { stdout } = await execFileAsync("node", [
      "scripts/run-benchmark.mjs",
      "--dry-run",
      "--json",
    ]);
    const plan = JSON.parse(stdout) as BenchmarkRunPlan;

    expect(plan).toEqual({
      command: "pnpm",
      args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
      sampleSize: 1,
    });
  });

  test("prints a dry-run plan with the configured sample size", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/run-benchmark.mjs", "--dry-run", "--json"],
      {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_SAMPLE_SIZE: "3",
        },
      },
    );
    const plan = JSON.parse(stdout) as BenchmarkRunPlan;

    expect(plan.sampleSize).toBe(3);
  });

  test("rejects invalid sample sizes", async () => {
    await expect(
      execFileAsync("node", ["scripts/run-benchmark.mjs", "--dry-run"], {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_SAMPLE_SIZE: "0",
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("SOLACE_BENCHMARK_SAMPLE_SIZE must be a positive integer"),
    });
  });
});
