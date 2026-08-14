import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { isSafeEvidencePath } from "./one-zero-readiness-config.mjs";

export async function loadOneZeroReadinessEvidence({
  root = process.cwd(),
  readinessPath = "release/one-zero-readiness.json",
} = {}) {
  if (!isSafeEvidencePath(readinessPath)) {
    throw new Error(`Invalid readiness evidence path: ${String(readinessPath)}`);
  }

  const evidence = await readJson(root, readinessPath);
  const performanceEvidencePath = evidence?.performance?.evidence;
  if (!isSafeEvidencePath(performanceEvidencePath)) {
    throw new Error(`Invalid performance evidence path in ${readinessPath}`);
  }

  const performanceSummary = await readJson(root, performanceEvidencePath);
  return {
    ...evidence,
    performance: {
      ...evidence.performance,
      summary: performanceSummary,
    },
  };
}

async function readJson(root, path) {
  let content;
  try {
    content = await readFile(resolve(root, path), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Readiness evidence file not found: ${path}`);
    }
    throw error;
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid readiness evidence JSON at ${path}`);
  }
}
