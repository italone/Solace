import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const extensionRoot = new URL("./", import.meta.url);

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        background: fileURLToPath(new URL("src/background.ts", extensionRoot)),
        bridge: fileURLToPath(new URL("src/bridge.ts", extensionRoot)),
        "content-script": fileURLToPath(new URL("src/content-script.ts", extensionRoot)),
        devtools: fileURLToPath(new URL("devtools.html", extensionRoot)),
        index: fileURLToPath(new URL("index.html", extensionRoot)),
        panel: fileURLToPath(new URL("panel.html", extensionRoot)),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [
    {
      name: "solace-devtools-extension-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: readFileSync(new URL("manifest.json", extensionRoot), "utf8"),
        });
      },
    },
  ],
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
      {
        find: /^@italone\/solace\/devtools$/,
        replacement: fileURLToPath(new URL("../../src/devtools/index.ts", import.meta.url)),
      },
    ],
  },
});
