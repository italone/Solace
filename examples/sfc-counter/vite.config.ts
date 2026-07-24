import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import solace from "../../src/vite/index";

export default defineConfig({
  plugins: [solace()],
  resolve: {
    alias: {
      "@italone/solace": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
    },
  },
});
