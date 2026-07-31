import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("playwright config", () => {
  it("uses Solace-reserved e2e ports instead of common local Vite ports", () => {
    const config = readFileSync(resolve("playwright.config.ts"), "utf8");

    expect(config).not.toContain("--port 5174");
    expect(config).not.toContain("--port 5175");
    expect(config).toContain("--port 6174");
    expect(config).toContain("--port 6175");
    expect(config).toContain("--port 6176");
    expect(config).toContain("--port 6178");
  });

  it("keeps hard-coded e2e example URLs aligned with the reserved ports", () => {
    const todoSpec = readFileSync(resolve("tests/e2e/todo-app.spec.ts"), "utf8");
    const largeListSpec = readFileSync(resolve("tests/e2e/large-list.spec.ts"), "utf8");
    const routerSpec = readFileSync(resolve("tests/e2e/router-basic.spec.ts"), "utf8");

    expect(todoSpec).toContain("http://127.0.0.1:6175");
    expect(largeListSpec).toContain("http://127.0.0.1:6176");
    expect(routerSpec).toContain("http://127.0.0.1:6178");
  });
});
