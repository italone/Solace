import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rmSync } from "node:fs";
import dts from "rollup-plugin-dts";
import ts from "typescript";

function cleanDist() {
  let cleaned = false;

  return {
    name: "clean-dist",
    buildStart() {
      if (!cleaned) {
        rmSync("dist", { recursive: true, force: true });
        cleaned = true;
      }
    },
  };
}

function typescript() {
  return {
    name: "typescript-transpile",
    transform(code, id) {
      if (!id.endsWith(".ts")) {
        return null;
      }

      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          sourceMap: false,
        },
        fileName: id,
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}

export default [
  {
    input: {
      index: "src/index.ts",
      "jsx-runtime": "src/jsx-runtime.ts",
      "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
      devtools: "src/devtools/index.ts",
    },
    plugins: [
      cleanDist(),
      nodeResolve({ extensions: [".mjs", ".js", ".json", ".node", ".ts"] }),
      commonjs(),
      typescript(),
    ],
    output: [
      {
        dir: "dist",
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        format: "esm",
        sourcemap: false,
      },
      {
        dir: "dist",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name]-[hash].cjs",
        format: "cjs",
        sourcemap: false,
        exports: "named",
      },
    ],
  },
  {
    input: {
      index: "src/index.ts",
      "jsx-runtime": "src/jsx-runtime.ts",
      "jsx-dev-runtime": "src/jsx-dev-runtime.ts",
      devtools: "src/devtools/index.ts",
    },
    output: {
      dir: "dist",
      entryFileNames: "[name].d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
];
