import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { solacePlugin } from "./src/vite/index";

function resolveSolaceAlias(): Record<string, string> {
  try {
    return {
      "@italone/solace": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "@italone/solace/devtools": fileURLToPath(
        new URL("./src/devtools/index.ts", import.meta.url),
      ),
    };
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [solacePlugin()],
  resolve: {
    alias: resolveSolaceAlias(),
  },
  test: {
    environment: "jsdom",
    exclude: [
      "tests/e2e/**",
      "tests/integration/package-exports.test.ts",
      "node_modules/**",
      ...(isRunningInsideProjectWorktree() ? [] : [".worktrees/**"]),
      "**/node_modules/**",
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

function isRunningInsideProjectWorktree(): boolean {
  return process.cwd().split(sep).includes(".worktrees");
}
