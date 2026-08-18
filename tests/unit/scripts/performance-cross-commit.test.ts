import { describe, expect, it } from "vitest";

import { evaluateCrossCommitPerformance } from "../../../scripts/performance-cross-commit-config.mjs";

const baseSha = "1111111111111111111111111111111111111111";
const headSha = "2222222222222222222222222222222222222222";

const config = {
  schemaVersion: 1,
  minimumSamples: 3,
  maximumRatio: 1.2,
  browser: { "large-list": ["initialRenderMs", "updateMs"] },
  jsdom: { render: ["latencyMeanMs"] },
};

const browserMetadata = {
  node: "v22.12.0",
  platform: "linux",
  release: "6.11.0",
  arch: "x64",
  cpuModel: "CI CPU",
  logicalCpuCount: 4,
  browserName: "chromium",
  browserVersion: "149.0.1",
  projectName: "chromium",
  sampleSize: 3,
};

const jsdomMetadata = {
  node: "v22.12.0",
  platform: "linux",
  release: "6.11.0",
  arch: "x64",
  cpuModel: "CI CPU",
  logicalCpuCount: 4,
  benchmarkRunner: "vitest",
  benchmarkEnvironment: "jsdom",
  sampleSize: 3,
};

function browserRecords(commitSha: string | undefined, updateValues = [10, 11, 12]) {
  return updateValues.map((updateMs, index) => ({
    kind: "browser-benchmark",
    status: "passed",
    summary: {
      scenario: "large-list",
      rows: 10_000,
      initialRenderMs: 20 + index,
      updateMs,
      metadata: { ...browserMetadata, ...(commitSha === undefined ? {} : { commitSha }) },
    },
  }));
}

function jsdomRecords(commitSha: string | undefined, values = [20, 21, 22]) {
  return [
    {
      kind: "jsdom-benchmark",
      status: "passed",
      metadata: { ...jsdomMetadata, ...(commitSha === undefined ? {} : { commitSha }) },
      summary: {
        tasks: values.map((latencyMeanMs) => ({
          name: "render",
          metrics: { latencyMeanMs },
        })),
      },
    },
  ];
}

function input({
  baseBrowser = browserRecords(baseSha),
  headBrowser = browserRecords(headSha),
  baseJsdom = jsdomRecords(baseSha),
  headJsdom = jsdomRecords(headSha),
}: {
  baseBrowser?: unknown[];
  headBrowser?: unknown[];
  baseJsdom?: unknown[];
  headJsdom?: unknown[];
} = {}) {
  return {
    config,
    base: { sha: baseSha, browserRecords: baseBrowser, jsdomRecords: baseJsdom },
    head: { sha: headSha, browserRecords: headBrowser, jsdomRecords: headJsdom },
  };
}

describe("cross-commit performance evaluator", () => {
  it("compares three-sample medians for matching environments", () => {
    const result = evaluateCrossCommitPerformance(input());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.comparisons.find(({ id }) => id === "browser:large-list.updateMs")).toMatchObject(
      {
        baseMedian: 11,
        headMedian: 11,
        ratio: 1,
        limit: 1.2,
      },
    );
  });

  it("accepts the exact ratio limit and rejects a larger regression", () => {
    const atLimit = evaluateCrossCommitPerformance(
      input({ headBrowser: browserRecords(headSha, [12, 13.2, 14]) }),
    );
    expect(atLimit.valid).toBe(true);

    const overLimit = evaluateCrossCommitPerformance(
      input({ headBrowser: browserRecords(headSha, [12, 13.75, 14]) }),
    );
    expect(overLimit.valid).toBe(false);
    expect(overLimit.errors).toContain(
      "FAIL browser:large-list.updateMs base=11.00ms head=13.75ms ratio=1.250 limit=1.200",
    );
  });

  it("rejects environment fingerprint mismatches", () => {
    const mismatched = browserRecords(headSha).map((record) => ({
      ...record,
      summary: {
        ...record.summary,
        metadata: { ...record.summary.metadata, cpuModel: "Different CPU" },
      },
    }));
    const result = evaluateCrossCommitPerformance(input({ headBrowser: mismatched }));

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "browser:large-list environment fingerprint mismatch",
    );
  });

  it("rejects missing required environment fingerprint fields", () => {
    const missing = browserRecords(headSha).map((record) => ({
      ...record,
      summary: {
        ...record.summary,
        metadata: { ...record.summary.metadata, cpuModel: undefined },
      },
    }));
    const result = evaluateCrossCommitPerformance(
      input({
        baseBrowser: browserRecords(baseSha).map((record) => ({
          ...record,
          summary: {
            ...record.summary,
            metadata: { ...record.summary.metadata, cpuModel: undefined },
          },
        })),
        headBrowser: missing,
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "browser:large-list environment fingerprint mismatch",
    );
  });

  it("binds legacy records to the supplied revision and rejects conflicting SHAs", () => {
    expect(
      evaluateCrossCommitPerformance(
        input({ baseBrowser: browserRecords(undefined), baseJsdom: jsdomRecords(undefined) }),
      ).valid,
    ).toBe(true);

    const result = evaluateCrossCommitPerformance(
      input({ baseBrowser: browserRecords(headSha), baseJsdom: jsdomRecords(baseSha) }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain(
      `browser base record commitSha ${headSha} conflicts with ${baseSha}`,
    );
  });

  it("rejects insufficient samples and missing metrics", () => {
    const result = evaluateCrossCommitPerformance(
      input({
        headBrowser: browserRecords(headSha, [10, 11]).map((record) => ({
          ...record,
          summary: { ...record.summary, initialRenderMs: undefined },
        })),
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("browser:large-list.updateMs has 2/3 head samples");
    expect(result.errors.join(" ")).toContain(
      "browser:large-list.initialRenderMs has 0/3 head samples",
    );
  });
});
