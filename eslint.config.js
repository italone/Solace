import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "examples/**/dist/**",
      "node_modules/**",
      ".pnpm-store/**",
      "solace-project-log/**",
      "solace-project-plan/**",
      "**/*.md",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
]);
