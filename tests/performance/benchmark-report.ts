import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import type { Bench } from "tinybench";

type BenchmarkTaskMetricRecord = {
  name: string;
  file: string;
  metrics: Record<string, number>;
};

const metricsPath = process.env.SOLACE_BENCHMARK_METRICS_PATH;
const root = process.cwd();

export function reportBenchmark(bench: Bench, fileUrl: string): void {
  const file = normalizeFilePath(fileUrl);

  for (const task of bench.tasks) {
    const result = task.result;
    if (result.state !== "completed") {
      console.log(`${task.name}: ${result.state}`);
      continue;
    }

    const { latency, throughput } = result;
    console.log(
      `${task.name}: latency mean ${latency.mean.toFixed(3)}ms, p99 ${latency.p99.toFixed(3)}ms, throughput ${throughput.mean.toFixed(2)} ops/sec`,
    );

    appendMetricRecord({
      name: task.name,
      file,
      metrics: {
        latencyMeanMs: latency.mean,
        latencyP99Ms: latency.p99,
        throughputMeanOpsPerSec: throughput.mean,
      },
    });
  }
}

function appendMetricRecord(record: BenchmarkTaskMetricRecord): void {
  if (metricsPath === undefined) {
    return;
  }

  mkdirSync(dirname(metricsPath), { recursive: true });
  appendFileSync(metricsPath, `${JSON.stringify(record)}\n`, "utf8");
}

function normalizeFilePath(fileUrl: string): string {
  return relative(root, fileURLToPath(fileUrl)).replace(/\\/g, "/");
}
