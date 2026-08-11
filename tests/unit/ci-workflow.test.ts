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
});
