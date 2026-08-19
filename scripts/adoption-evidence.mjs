import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEvidenceBundle,
  parseAdoptionEvidenceArguments,
  serializeEvidenceBundle,
} from "./adoption-evidence-config.mjs";

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runAdoptionEvidence(parseAdoptionEvidenceArguments(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export async function runAdoptionEvidence(options, { root = process.cwd() } = {}) {
  const resolvedRoot = await realpath(root);
  const records = [];
  for (const recordPath of options.records) {
    const resolvedRecordPath = await realpath(resolve(resolvedRoot, recordPath));
    assertPathInsideRoot(resolvedRoot, resolvedRecordPath);
    records.push(JSON.parse(await readFile(resolvedRecordPath, "utf8")));
  }

  const bundle = createEvidenceBundle(records);
  const outputPath = resolve(resolvedRoot, options.output);
  assertPathInsideRoot(resolvedRoot, outputPath);
  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  assertPathInsideRoot(resolvedRoot, await realpath(outputDirectory));

  const temporaryPath = resolve(
    outputDirectory,
    `.${basename(outputPath)}.${String(process.pid)}.${String(Date.now())}.tmp`,
  );
  try {
    await writeFile(temporaryPath, serializeEvidenceBundle(bundle), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  console.log(`Adoption evidence bundle written: ${options.output} (${bundle.bundleSha256})`);
  return { outputPath, bundle };
}

function assertPathInsideRoot(root, path) {
  const pathFromRoot = relative(root, path);
  if (pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !pathFromRoot.startsWith("/"))) {
    return;
  }
  throw new Error(`Adoption evidence path must stay inside root: ${path}`);
}
