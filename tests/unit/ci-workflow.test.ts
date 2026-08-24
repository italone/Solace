import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("tests the supported Node 20 and Node 22 lines", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("node-version: [20, 22]");
    expect(workflow).toContain("node-version: ${{ matrix.node-version }}");
  });

  it("keeps browser release gates aligned with the local release check", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("  browser:\n    needs: quality\n    timeout-minutes: 30");
    expect(workflow).toContain(
      "  performance-comparison:\n    needs: quality\n    timeout-minutes: 30",
    );
    const installBrowsers = workflow.indexOf(
      "run: pnpm exec playwright install --with-deps chromium firefox webkit",
    );
    const browserBenchmark = workflow.indexOf("run: pnpm benchmark:browser");
    const browserE2E = workflow.indexOf("run: pnpm test:e2e");
    const devtoolsExtensionE2E = workflow.indexOf("run: pnpm test:e2e:devtools-extension");

    expect(installBrowsers).toBeGreaterThan(-1);
    expect(browserBenchmark).toBeGreaterThan(installBrowsers);
    expect(browserE2E).toBeGreaterThan(browserBenchmark);
    expect(devtoolsExtensionE2E).toBeGreaterThan(browserE2E);
  });

  it("smokes DevTools distribution packaging between build and browser installation", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    const browserJob = workflow.slice(
      workflow.indexOf("  browser:"),
      workflow.indexOf("  performance-comparison:"),
    );
    const packageBuild = browserJob.indexOf("run: pnpm build");
    const devtoolsPackageSmoke = browserJob.indexOf("run: pnpm package:devtools-extension:smoke");
    const installBrowsers = browserJob.indexOf(
      "run: pnpm exec playwright install --with-deps chromium firefox webkit",
    );

    expect(devtoolsPackageSmoke).toBeGreaterThan(packageBuild);
    expect(installBrowsers).toBeGreaterThan(devtoolsPackageSmoke);
  });

  it("keeps ignored local performance history out of clean browser CI", async () => {
    const [workflow, packageJson] = await Promise.all([
      readFile(".github/workflows/ci.yml", "utf8"),
      readFile("package.json", "utf8"),
    ]);
    const browserJob = workflow.slice(
      workflow.indexOf("  browser:"),
      workflow.indexOf("  performance-comparison:"),
    );

    expect(browserJob).not.toContain("run: pnpm performance:regression");
    expect(JSON.parse(packageJson).scripts["release:check"]).toContain(
      "pnpm performance:regression",
    );
  });

  it("runs the packed adoption consumer in routine quality CI", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    const qualityJob = workflow.slice(
      workflow.indexOf("  quality:"),
      workflow.indexOf("  browser:"),
    );

    expect(qualityJob).toContain("name: Adoption consumer smoke");
    expect(qualityJob).toContain("run: pnpm adoption:smoke");
  });

  it("accumulates benchmark history across scheduled CI dates", async () => {
    const workflow = await readFile(".github/workflows/performance-history.yml", "utf8");

    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "23 3 * * *"');
    expect(workflow).toContain("uses: actions/cache/restore@v4");
    expect(workflow).toContain("uses: actions/cache/save@v4");
    expect(workflow).toContain("performance-history-${{ runner.os }}-${{ github.run_id }}");
    expect(workflow).toContain("SOLACE_BENCHMARK_HISTORY_PATH: .benchmark-history/jsdom.jsonl");
    expect(workflow).toContain(
      "SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: .benchmark-history/browser.jsonl",
    );
    expect(workflow).toContain("SOLACE_BENCHMARK_COMMIT_SHA: ${{ github.sha }}");
    expect(workflow).toContain("pnpm benchmark:history:evidence -- --output");
    expect(workflow).toContain("retention-days: 30");
  });
});
