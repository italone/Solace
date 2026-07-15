import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/performance/**/*.bench.ts"],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
