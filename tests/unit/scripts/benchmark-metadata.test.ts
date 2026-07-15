import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

type BenchmarkMetadata = {
  packageName: string;
  packageVersion: string;
  node: string;
  platform: string;
  release: string;
  arch: string;
  runtime: string;
  cpuModel: string;
  logicalCpuCount: number;
  totalMemoryBytes: number;
  benchmarkRunner: string;
  benchmarkEnvironment: string;
  sampleSize: number;
  runAt: string;
};

describe("benchmark metadata CLI", () => {
  test("prints machine and runtime metadata as JSON", async () => {
    const { stdout } = await execFileAsync("node", ["scripts/benchmark-metadata.mjs", "--json"]);
    const metadata = JSON.parse(stdout) as BenchmarkMetadata;

    expect(metadata.packageName).toBe("solace");
    expect(metadata.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(metadata.node).toBe(process.version);
    expect(metadata.platform.length).toBeGreaterThan(0);
    expect(metadata.release.length).toBeGreaterThan(0);
    expect(metadata.arch.length).toBeGreaterThan(0);
    expect(metadata.runtime).toContain(metadata.platform);
    expect(metadata.cpuModel.length).toBeGreaterThan(0);
    expect(metadata.logicalCpuCount).toBeGreaterThan(0);
    expect(metadata.totalMemoryBytes).toBeGreaterThan(0);
    expect(metadata.benchmarkRunner).toBe("vitest");
    expect(metadata.benchmarkEnvironment).toBe("jsdom");
    expect(metadata.sampleSize).toBe(1);
    expect(Date.parse(metadata.runAt)).not.toBeNaN();
  });
});
