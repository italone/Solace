import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("keeps browser release gates aligned with the local release check", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    const installBrowsers = workflow.indexOf(
      "run: pnpm exec playwright install --with-deps chromium",
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
