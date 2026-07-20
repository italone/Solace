import { readFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";

import { expect, test } from "@playwright/test";

import {
  appendBrowserBenchmarkHistory,
  parseBrowserBenchmarkHistoryPath,
  parseBrowserBenchmarkSampleSize,
  type BrowserBenchmarkHistoryMetadata,
  type BrowserBenchmarkHistoryResult,
  type BrowserBenchmarkHistorySummary,
} from "./browser-benchmark-history";

type BrowserBenchmarkResult = BrowserBenchmarkHistoryResult;

type BrowserBenchmarkMetadata = BrowserBenchmarkHistoryMetadata;

type BrowserBenchmarkSummary = BrowserBenchmarkHistorySummary;

type PackageMetadata = {
  name: string;
  version: string;
};

test("measures large-list render, update, and unmount in a production browser build", async ({
  browser,
  browserName,
  page,
}, testInfo) => {
  const historyPath = parseBrowserBenchmarkHistoryPath(process.env);
  const sampleSize = parseBrowserBenchmarkSampleSize(process.env);

  await page.goto("/");
  await expect(page.locator("#app")).toContainText("Browser benchmark ready");

  for (let sampleIndex = 1; sampleIndex <= sampleSize; sampleIndex += 1) {
    const result = await page.evaluate(async () => {
      const api = window.__SOLACE_BENCHMARK__;
      if (api === undefined) {
        throw new Error("Missing browser benchmark API");
      }

      return api.run();
    });

    const summary = createBrowserBenchmarkSummary(
      result,
      {
        browserName,
        browserVersion: browser.version(),
        projectName: testInfo.project.name,
      },
      sampleSize,
    );

    expectBrowserBenchmarkSummary(summary, sampleSize);
    console.log(`browser benchmark summary: ${JSON.stringify(summary)}`);

    if (historyPath !== undefined) {
      await appendBrowserBenchmarkHistory(historyPath, summary);
    }
  }
});

function expectBrowserBenchmarkResult(result: BrowserBenchmarkResult): void {
  expect(result.scenario).toBe("large-list");
  expect(result.rows).toBe(10_000);
  expectFinitePositive(result.initialRenderMs);
  expectFinitePositive(result.updateMs);
  expectFinitePositive(result.unmountMs);
  expect(result.selectedText).toContain("Row 5000 selected");
  expect(result.remainingNodesAfterUnmount).toBe(0);
}

function createBrowserBenchmarkSummary(
  result: BrowserBenchmarkResult,
  options: Pick<BrowserBenchmarkMetadata, "browserName" | "browserVersion" | "projectName">,
  sampleSize: number,
): BrowserBenchmarkSummary {
  const packageMetadata = readPackageMetadata();
  const cpuList = cpus();
  const [primaryCpu] = cpuList;

  return {
    ...result,
    metadata: {
      packageName: packageMetadata.name,
      packageVersion: packageMetadata.version,
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpuModel: primaryCpu?.model ?? "unknown",
      logicalCpuCount: cpuList.length,
      totalMemoryBytes: totalmem(),
      browserName: options.browserName,
      browserVersion: options.browserVersion,
      projectName: options.projectName,
      sampleSize,
      runAt: new Date().toISOString(),
    },
  };
}

function expectBrowserBenchmarkSummary(summary: BrowserBenchmarkSummary, sampleSize: number): void {
  expectBrowserBenchmarkResult(summary);
  expect(summary.metadata.packageName).toBe("@italone/solace");
  expect(summary.metadata.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  expect(summary.metadata.node).toBe(process.version);
  expect(summary.metadata.platform).toBe(platform());
  expect(summary.metadata.release.length).toBeGreaterThan(0);
  expect(summary.metadata.arch.length).toBeGreaterThan(0);
  expect(summary.metadata.cpuModel.length).toBeGreaterThan(0);
  expect(summary.metadata.logicalCpuCount).toBeGreaterThan(0);
  expect(summary.metadata.totalMemoryBytes).toBeGreaterThan(0);
  expect(summary.metadata.browserName).toBe("chromium");
  expect(summary.metadata.browserVersion.length).toBeGreaterThan(0);
  expect(summary.metadata.projectName).toBe("chromium");
  expect(summary.metadata.sampleSize).toBe(sampleSize);
  expect(Date.parse(summary.metadata.runAt)).not.toBeNaN();
}

function readPackageMetadata(): PackageMetadata {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as Partial<PackageMetadata>;

  if (typeof packageJson.name !== "string" || typeof packageJson.version !== "string") {
    throw new Error("package.json must include string name and version for benchmark metadata");
  }

  return {
    name: packageJson.name,
    version: packageJson.version,
  };
}

function expectFinitePositive(value: number): void {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

declare global {
  interface Window {
    __SOLACE_BENCHMARK__?: {
      run(): Promise<BrowserBenchmarkResult>;
    };
  }
}
