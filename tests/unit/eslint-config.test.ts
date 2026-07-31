import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("eslint config", () => {
  it("ignores transient Playwright artifact directories", () => {
    const source = readFileSync(resolve("eslint.config.js"), "utf8");

    expect(source).toContain('"test-results/**"');
    expect(source).toContain('"playwright-report/**"');
  });
});
