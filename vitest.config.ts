import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { solacePlugin } from "./src/vite/index";

interface SolaceAlias {
  find: string | RegExp;
  replacement: string;
}

function resolveSolaceAlias(): SolaceAlias[] {
  try {
    return [
      {
        find: "@italone/solace/devtools",
        replacement: fileURLToPath(new URL("./src/devtools/index.ts", import.meta.url)),
      },
      {
        find: "@italone/solace/jsx-dev-runtime",
        replacement: fileURLToPath(new URL("./src/jsx-dev-runtime.ts", import.meta.url)),
      },
      {
        find: "@italone/solace/jsx-runtime",
        replacement: fileURLToPath(new URL("./src/jsx-runtime.ts", import.meta.url)),
      },
      {
        find: "@italone/solace/server",
        replacement: fileURLToPath(new URL("./src/server/index.ts", import.meta.url)),
      },
      {
        find: /^@italone\/solace$/,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ];
  } catch {
    return [];
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
      exclude: [
        "examples/**",
        "scripts/operations-console-smoke.mjs",
        "scripts/devtools-extension-package.mjs",
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        branches: 85,
        functions: 90,
      },
    },
  },
});

function isRunningInsideProjectWorktree(): boolean {
  return process.cwd().split(sep).includes(".worktrees");
}
