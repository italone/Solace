import { readFileSync } from "node:fs";
import { arch, cpus, platform, release, totalmem } from "node:os";

import { expect, test } from "@playwright/test";

import {
  appendBrowserBenchmarkHistory,
  parseBrowserBenchmarkHistoryPath,
  parseBrowserBenchmarkSampleSize,
  type BrowserBenchmarkHistoryMetadata,
  type DomMutationCounts,
  type MovePathCounts,
} from "./browser-benchmark-history";

type BrowserBenchmarkResult =
  | {
      scenario: "large-list";
      rows: number;
      initialRenderMs: number;
      updateMs: number;
      unmountMs: number;
      selectedText: string;
      remainingNodesAfterUnmount: number;
    }
  | {
      scenario: "keyed-reorder";
      shape: KeyedReorderShape;
      rows: number;
      initialRenderMs: number;
      reorderMs: number;
      unmountMs: number;
      firstRowText: string;
      remainingNodesAfterUnmount: number;
      domMutationCounts: DomMutationCounts;
      movePathCounts: MovePathCounts;
    };

type BrowserBenchmarkMetadata = BrowserBenchmarkHistoryMetadata;

type BrowserBenchmarkSummary = BrowserBenchmarkResult & {
  metadata: BrowserBenchmarkHistoryMetadata;
};

type KeyedReorderShape = "reverse" | "sorted" | "swap-neighbors" | "shuffle" | "shift-window";

type BrowserBenchmarkScenario =
  | "large-list"
  | { scenario: "keyed-reorder"; shape: KeyedReorderShape };

type PackageMetadata = {
  name: string;
  version: string;
};

const keyedReorderShapes: KeyedReorderShape[] = [
  "reverse",
  "sorted",
  "swap-neighbors",
  "shuffle",
  "shift-window",
];

const browserBenchmarkScenarios: BrowserBenchmarkScenario[] = [
  "large-list",
  ...keyedReorderShapes.map((shape) => ({ scenario: "keyed-reorder" as const, shape })),
];

const rowCount = 10_000;

test("measures browser benchmark scenarios in a production browser build", async ({
  browser,
  browserName,
  page,
}, testInfo) => {
  const historyPath = parseBrowserBenchmarkHistoryPath(process.env);
  const sampleSize = parseBrowserBenchmarkSampleSize(process.env);

  await page.goto("/");
  await expect(page.locator("#app")).toContainText("Browser benchmark ready");

  for (let sampleIndex = 1; sampleIndex <= sampleSize; sampleIndex += 1) {
    for (const scenario of browserBenchmarkScenarios) {
      const result = await page.evaluate(async (scenario) => {
        const benchmarkWindow = window as Window & {
          __SOLACE_BENCHMARK__?: {
            runScenario(scenario: BrowserBenchmarkScenario): Promise<BrowserBenchmarkResult>;
          };
        };
        const api = benchmarkWindow.__SOLACE_BENCHMARK__;
        if (api === undefined) {
          throw new Error("Missing browser benchmark API");
        }

        return api.runScenario(scenario);
      }, scenario);

      const summary = createBrowserBenchmarkSummary(
        result,
        {
          browserName,
          browserVersion: browser.version(),
          projectName: testInfo.project.name,
        },
        sampleSize,
      );

      expectBrowserBenchmarkSummary(summary, sampleSize, scenario);
      console.log(`browser benchmark summary: ${JSON.stringify(summary)}`);

      if (historyPath !== undefined) {
        await appendBrowserBenchmarkHistory(historyPath, summary);
      }
    }
  }
});

function expectBrowserBenchmarkResult(
  result: BrowserBenchmarkResult,
  scenario: BrowserBenchmarkScenario,
): void {
  expect(result.rows).toBe(rowCount);
  expectFinitePositive(result.initialRenderMs);
  expectFinitePositive(result.unmountMs);
  expect(result.remainingNodesAfterUnmount).toBe(0);

  if (result.scenario === "large-list") {
    expect(scenario).toBe("large-list");
    expectFinitePositive(result.updateMs);
    expect(result.selectedText).toContain("Row 5000 selected");
    return;
  }

  if (typeof scenario !== "object" || scenario.scenario !== "keyed-reorder") {
    throw new Error(`Expected keyed-reorder scenario, got ${JSON.stringify(scenario)}`);
  }

  expect(result.scenario).toBe("keyed-reorder");
  expect(result.shape).toBe(scenario.shape);
  expectFinitePositive(result.reorderMs);
  expectDomMutationCounts(result.domMutationCounts);
  expectMovePathCounts(result.movePathCounts);
  expect(result.movePathCounts.keyedMiddleSegments).toBeLessThanOrEqual(1);
  expect(result.movePathCounts.matchedOldChildren).toBeLessThanOrEqual(rowCount);
  expect(result.movePathCounts.newChildrenMounted).toBe(0);
  expect(result.movePathCounts.removedOldChildren).toBe(0);
  expect(result.movePathCounts.anchorLookups).toBe(0);

  expect(result.domMutationCounts.setAttribute).toBe(0);
  expect(result.domMutationCounts.removeAttribute).toBe(0);
  expect(result.domMutationCounts.textContent).toBe(0);
  expect(result.domMutationCounts.removeChild).toBe(0);

  switch (scenario.shape) {
    case "reverse":
      expect(result.firstRowText).toBe(`Row ${rowCount}`);
      expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
      expect(result.movePathCounts.matchedOldChildren).toBe(rowCount);
      expect(result.movePathCounts.lisLength).toBe(1);
      expect(result.movePathCounts.stableMoveSkips).toBe(1);
      expect(result.movePathCounts.movedExistingChildren).toBe(rowCount - 1);
      expect(result.domMutationCounts.insertBefore).toBe(rowCount - 1);
      break;
    case "sorted":
      expect(result.firstRowText).toBe("Row 1");
      expect(result.movePathCounts.keyedMiddleSegments).toBe(0);
      expect(result.movePathCounts.matchedOldChildren).toBe(0);
      expect(result.movePathCounts.lisLength).toBe(0);
      expect(result.movePathCounts.stableMoveSkips).toBe(0);
      expect(result.movePathCounts.movedExistingChildren).toBe(0);
      expect(result.domMutationCounts.insertBefore).toBe(0);
      break;
    case "swap-neighbors":
      expect(result.firstRowText).toBe("Row 2");
      expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
      expect(result.movePathCounts.matchedOldChildren).toBe(rowCount);
      expect(result.movePathCounts.lisLength).toBe(rowCount / 2);
      expect(result.movePathCounts.stableMoveSkips).toBe(rowCount / 2);
      expect(result.movePathCounts.movedExistingChildren).toBe(rowCount / 2);
      expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
      break;
    case "shuffle":
      expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
      expect(result.movePathCounts.matchedOldChildren).toBe(rowCount);
      expect(result.movePathCounts.movedExistingChildren).toBeGreaterThan(0);
      expect(result.domMutationCounts.insertBefore).toBeGreaterThan(0);
      break;
    case "shift-window": {
      const windowSize = 100;
      expect(result.firstRowText).toBe(`Row ${rowCount - windowSize + 1}`);
      expect(result.movePathCounts.keyedMiddleSegments).toBe(1);
      expect(result.movePathCounts.matchedOldChildren).toBe(rowCount);
      expect(result.movePathCounts.lisLength).toBe(rowCount - windowSize);
      expect(result.movePathCounts.stableMoveSkips).toBe(rowCount - windowSize);
      expect(result.movePathCounts.movedExistingChildren).toBe(windowSize);
      expect(result.domMutationCounts.insertBefore).toBe(windowSize);
      break;
    }
  }
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

function expectBrowserBenchmarkSummary(
  summary: BrowserBenchmarkSummary,
  sampleSize: number,
  scenario: BrowserBenchmarkScenario,
): void {
  expectBrowserBenchmarkResult(summary, scenario);
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

function expectDomMutationCounts(counts: DomMutationCounts): void {
  expectNonNegativeInteger(counts.insertBefore);
  expectNonNegativeInteger(counts.setAttribute);
  expectNonNegativeInteger(counts.removeAttribute);
  expectNonNegativeInteger(counts.textContent);
  expectNonNegativeInteger(counts.removeChild);
}

function expectMovePathCounts(counts: MovePathCounts): void {
  expectNonNegativeInteger(counts.keyedMiddleSegments);
  expectNonNegativeInteger(counts.matchedOldChildren);
  expectNonNegativeInteger(counts.newChildrenMounted);
  expectNonNegativeInteger(counts.removedOldChildren);
  expectNonNegativeInteger(counts.lisLength);
  expectNonNegativeInteger(counts.stableMoveSkips);
  expectNonNegativeInteger(counts.movedExistingChildren);
  expectNonNegativeInteger(counts.anchorLookups);
}

function expectNonNegativeInteger(value: number): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}
