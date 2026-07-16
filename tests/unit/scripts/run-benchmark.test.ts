import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkRunPlan = {
  command: string;
  args: string[];
  sampleSize: number;
  historyPath?: string;
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

  test("prints a dry-run plan with the configured history path", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/run-benchmark.mjs", "--dry-run", "--json"],
      {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_HISTORY_PATH: ".benchmark-history/jsdom.jsonl",
        },
      },
    );
    const plan = JSON.parse(stdout) as BenchmarkRunPlan;

    expect(plan.historyPath).toBe(".benchmark-history/jsdom.jsonl");
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

  test("rejects empty benchmark history paths", async () => {
    await expect(
      execFileAsync("node", ["scripts/run-benchmark.mjs", "--dry-run"], {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_HISTORY_PATH: "   ",
        },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("SOLACE_BENCHMARK_HISTORY_PATH must not be empty"),
    });
  });

  test("appends a benchmark history record after successful samples", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "solace-benchmark-history-"));
    const historyPath = join(tempDir, "history", "jsdom.jsonl");

    try {
      await execFileAsync("node", ["scripts/run-benchmark.mjs"], {
        env: {
          ...process.env,
          SOLACE_BENCHMARK_HISTORY_PATH: historyPath,
        },
      });

      const [line] = (await readFile(historyPath, "utf8")).trim().split("\n");
      const record = JSON.parse(line) as {
        kind: string;
        status: string;
        metadata: { benchmarkEnvironment: string; sampleSize: number };
        sampleCount: number;
        command: string;
        args: string[];
      };

      expect(record).toMatchObject({
        kind: "jsdom-benchmark",
        status: "passed",
        sampleCount: 1,
        command: "pnpm",
        args: ["exec", "vitest", "run", "--config", "vitest.benchmark.config.ts"],
      });
      expect(record.metadata.benchmarkEnvironment).toBe("jsdom");
      expect(record.metadata.sampleSize).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 45_000);
});
