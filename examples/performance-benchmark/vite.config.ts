import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "solace/jsx-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-runtime.ts", import.meta.url)),
      },
      {
        find: "solace/jsx-dev-runtime",
        replacement: fileURLToPath(new URL("../../src/jsx-dev-runtime.ts", import.meta.url)),
      },
      {
        find: /^solace$/,
        replacement: fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
      },
    ],
  },
});
