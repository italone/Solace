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
  await verifyDocumentReferences(root, evidence);
  return {
    ...evidence,
    performance: {
      ...evidence.performance,
      summary: performanceSummary,
    },
  };
}

async function verifyDocumentReferences(root, evidence) {
  const paths = [];
  for (const application of Array.isArray(evidence?.applications) ? evidence.applications : []) {
    if (application?.evidence !== undefined) paths.push(application.evidence);
    if (application?.rollback?.evidence !== undefined) paths.push(application.rollback.evidence);
  }
  if (evidence?.contract?.evidence !== undefined) paths.push(evidence.contract.evidence);
  for (const procedure of Object.values(evidence?.migrationPolicy ?? {})) {
    for (const path of Array.isArray(procedure?.evidence) ? procedure.evidence : []) {
      paths.push(path);
    }
  }

  for (const path of paths) {
    if (!isSafeEvidencePath(path)) {
      throw new Error(`Invalid readiness evidence document path: ${String(path)}`);
    }
    try {
      await readFile(resolve(root, path), "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        throw new Error(`Readiness evidence file not found: ${path}`);
      }
      throw error;
    }
  }
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
