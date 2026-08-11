import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@italone/solace/jsx-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-runtime.ts", import.meta.url)),
      },
      {
        find: "@italone/solace/jsx-dev-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-dev-runtime.ts", import.meta.url)),
      },
      {
        find: /^@italone\/solace$/,
        replacement: fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        hydration: fileURLToPath(new URL("./hydration.html", import.meta.url)),
      },
    },
  },
});
