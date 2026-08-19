import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createEvidenceBundle } from "./adoption-evidence-config.mjs";

export function isSafeEvidencePath(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !/^[/\\]|^[A-Za-z]:[/\\]/u.test(value) &&
    !value.split(/[/\\]+/u).includes("..")
  );
}

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
  const applications = await loadAdoptionEvidence(root, evidence);
  const devtools = await loadDevtoolsEvidence(root, evidence);
  const contract = await loadContractEvidence(root, evidence);
  return {
    ...evidence,
    applications,
    devtools,
    contract,
    performance: {
      ...evidence.performance,
      summary: performanceSummary,
    },
  };
}

async function loadAdoptionEvidence(root, evidence) {
  if (!Array.isArray(evidence?.applications) || evidence.applications.length === 0) {
    return evidence?.applications;
  }
  const path = evidence?.adoptionEvidence;
  if (!isSafeEvidencePath(path)) {
    throw new Error("Adoption evidence JSON path is required when applications are declared");
  }
  const document = await readJson(root, path);
  if (
    document?.schemaVersion !== 1 ||
    !Array.isArray(document.applications) ||
    document.applications.length === 0
  ) {
    throw new Error(`Invalid adoption evidence schema at ${path}`);
  }
  const records = new Map(document.applications.map((record) => [record?.name, record]));
  return Promise.all(
    evidence.applications.map(async (application) => {
      const record = records.get(application?.name);
      if (!record)
        throw new Error(`Missing adoption evidence record: ${String(application?.name)}`);
      if (record.evidencePath !== application?.evidence) {
        throw new Error(`Adoption evidence path does not match: ${String(application?.name)}`);
      }
      if (record.rollbackEvidencePath !== application?.rollback?.evidence) {
        throw new Error(
          `Adoption rollback evidence path does not match: ${String(application?.name)}`,
        );
      }
      const bundlePath = application?.adoptionEvidenceBundle;
      if (bundlePath === undefined) return { ...application, evidenceRecord: record };
      if (!isSafeEvidencePath(bundlePath)) {
        throw new Error(`Invalid adoption evidence bundle path: ${String(bundlePath)}`);
      }
      const bundle = await readJson(root, bundlePath);
      let rebuilt;
      try {
        rebuilt = createEvidenceBundle(bundle?.records);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Invalid adoption evidence bundle: ${String(application?.name)}: ${message}`,
        );
      }
      if (bundle?.bundleSha256 !== rebuilt.bundleSha256) {
        throw new Error(
          `Adoption evidence bundle digest does not match: ${String(application?.name)}`,
        );
      }
      return { ...application, evidenceRecord: record, evidenceBundle: bundle };
    }),
  );
}

async function loadDevtoolsEvidence(root, evidence) {
  const path = evidence?.devtools?.evidence;
  if (path === undefined) return evidence?.devtools;
  if (!isSafeEvidencePath(path)) throw new Error(`Invalid DevTools evidence path: ${String(path)}`);
  const document = await readJson(root, path);
  if (
    document?.schemaVersion !== 1 ||
    !Array.isArray(document.hostPermissions) ||
    !Array.isArray(document.testedOrigins)
  ) {
    throw new Error(`Invalid DevTools evidence schema at ${path}`);
  }
  if (!isSafeEvidencePath(document.manifestPath)) {
    throw new Error(`Invalid DevTools manifest path in ${path}`);
  }
  const manifest = await readJson(root, document.manifestPath);
  if (
    JSON.stringify(manifest.host_permissions ?? []) !==
    JSON.stringify(document.hostPermissions ?? [])
  ) {
    throw new Error(
      `DevTools manifest permissions do not match evidence: ${document.manifestPath}`,
    );
  }
  return { ...evidence.devtools, evidenceRecord: document };
}

async function loadContractEvidence(root, evidence) {
  const path = evidence?.contract?.evidence;
  if (path === undefined) return evidence?.contract;
  if (!isSafeEvidencePath(path)) throw new Error(`Invalid contract evidence path: ${String(path)}`);
  const document = await readJson(root, path);
  if (
    document?.schemaVersion !== 1 ||
    !Array.isArray(document.entries) ||
    document.entries.length === 0
  ) {
    throw new Error(`Invalid public contract evidence schema at ${path}`);
  }
  return { ...evidence.contract, evidenceRecord: document };
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

  if (content.trim() === "") throw new Error(`Empty readiness evidence document: ${path}`);

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid readiness evidence JSON at ${path}`);
  }
}
