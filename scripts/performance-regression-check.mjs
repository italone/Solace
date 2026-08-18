import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePerformanceRegression } from "./performance-regression-config.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

try {
  const budgets = await readJson(resolve(root, "release/performance-budgets.json"));
  const browserRecords = await readJsonLines(resolve(root, ".benchmark-history/browser.jsonl"));
  const jsdomRecords = await readJsonLines(resolve(root, ".benchmark-history/jsdom.jsonl"));
  const result = evaluatePerformanceRegression({ budgets, browserRecords, jsdomRecords });
  console.log(`performance regression: ${result.valid ? "PASS" : "FAIL"}`);
  for (const error of result.errors) console.log(`FAIL ${error}`);
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonLines(path) {
  const content = await readFile(path, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON at ${path}:${index + 1}`);
      }
    });
}
