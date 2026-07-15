import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: [
      "tests/e2e/**",
      "tests/integration/package-exports.test.ts",
      "node_modules/**",
      "dist/**",
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 90,
        lines: 90,
        branches: 75,
        functions: 70,
      },
    },
  },
});
