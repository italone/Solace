import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createPlaywrightWebServerEnv, sanitizePlaywrightProcessEnv } from "../../playwright.env";

describe("playwright config", () => {
  it("uses Solace-reserved e2e ports instead of common local Vite ports", () => {
    const config = readFileSync(resolve("playwright.config.ts"), "utf8");
    const devtoolsConfig = readFileSync(resolve("playwright.devtools-extension.config.ts"), "utf8");
    const devtoolsSpec = readFileSync(resolve("tests/e2e/devtools-extension.spec.ts"), "utf8");

    expect(config).not.toContain("--port 5174");
    expect(config).not.toContain("--port 5175");
    expect(config).toContain("--port 6174");
    expect(config).toContain("--port 6175");
    expect(config).toContain("--port 6176");
    expect(config).toContain("--port 6178");
    expect(config).toContain("--port 6179");
    expect(devtoolsConfig).not.toContain("--port 5174");
    expect(devtoolsConfig).not.toContain("--port 5177");
    expect(devtoolsConfig).toContain("--port 6174");
    expect(devtoolsConfig).toContain("--port 6177");
    expect(devtoolsSpec).not.toContain("http://127.0.0.1:5174");
    expect(devtoolsSpec).not.toContain("http://127.0.0.1:5177");
    expect(devtoolsSpec).toContain("http://127.0.0.1:6174");
    expect(devtoolsSpec).toContain("http://127.0.0.1:6177");
  });

  it("keeps hard-coded e2e example URLs aligned with the reserved ports", () => {
    const todoSpec = readFileSync(resolve("tests/e2e/todo-app.spec.ts"), "utf8");
    const largeListSpec = readFileSync(resolve("tests/e2e/large-list.spec.ts"), "utf8");
    const routerSpec = readFileSync(resolve("tests/e2e/router-basic.spec.ts"), "utf8");
    const asyncHydrationSpec = readFileSync(resolve("tests/e2e/async-hydration.spec.ts"), "utf8");

    expect(todoSpec).toContain("http://127.0.0.1:6175");
    expect(largeListSpec).toContain("http://127.0.0.1:6176");
    expect(routerSpec).toContain("http://127.0.0.1:6178");
    expect(asyncHydrationSpec).toContain("http://127.0.0.1:6179");
  });

  it("uses a shared Playwright web server env helper", () => {
    const config = readFileSync(resolve("playwright.config.ts"), "utf8");
    const benchmarkConfig = readFileSync(resolve("playwright.benchmark.config.ts"), "utf8");
    const devtoolsConfig = readFileSync(resolve("playwright.devtools-extension.config.ts"), "utf8");

    expect(config).toContain("env: createPlaywrightWebServerEnv()");
    expect(benchmarkConfig).toContain("env: createPlaywrightWebServerEnv()");
    expect(devtoolsConfig).toContain("env: createPlaywrightWebServerEnv()");
  });

  it("runs core e2e in Chromium, Firefox, and WebKit", () => {
    const config = readFileSync(resolve("playwright.config.ts"), "utf8");

    expect(config).toContain('name: "chromium"');
    expect(config).toContain('name: "firefox"');
    expect(config).toContain('name: "webkit"');
    expect(config).toContain('devices["Desktop Firefox"]');
    expect(config).toContain('devices["Desktop Safari"]');
  });

  it("keeps the DevTools extension e2e Chromium-only", () => {
    const config = readFileSync(resolve("playwright.devtools-extension.config.ts"), "utf8");

    expect(config).toContain('name: "chromium"');
    expect(config).not.toContain('name: "firefox"');
    expect(config).not.toContain('name: "webkit"');
  });

  it("sanitizes inherited Playwright runner environments in every config", () => {
    const config = readFileSync(resolve("playwright.config.ts"), "utf8");
    const benchmarkConfig = readFileSync(resolve("playwright.benchmark.config.ts"), "utf8");
    const devtoolsConfig = readFileSync(resolve("playwright.devtools-extension.config.ts"), "utf8");

    expect(config).toContain("sanitizePlaywrightProcessEnv();");
    expect(benchmarkConfig).toContain("sanitizePlaywrightProcessEnv();");
    expect(devtoolsConfig).toContain("sanitizePlaywrightProcessEnv();");
  });

  it("overrides inherited NO_COLOR in Playwright web server environments", () => {
    const env = createPlaywrightWebServerEnv({
      FORCE_COLOR: "1",
      KEEP_ME: "yes",
      NO_COLOR: "1",
    });

    expect(env).toMatchObject({ FORCE_COLOR: "1", KEEP_ME: "yes" });
    expect(env).toHaveProperty("NO_COLOR", undefined);
  });

  it("removes inherited NO_COLOR from Playwright runner environments", () => {
    const env: NodeJS.ProcessEnv = {
      FORCE_COLOR: "1",
      KEEP_ME: "yes",
      NO_COLOR: "1",
    };

    sanitizePlaywrightProcessEnv(env);

    expect(env).toMatchObject({ FORCE_COLOR: "1", KEEP_ME: "yes" });
    expect(env).not.toHaveProperty("NO_COLOR");
  });
});
