import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePublicContract } from "./public-contract-check-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const manifest = JSON.parse(
    await readFile(resolve(root, "release/public-contract.json"), "utf8"),
  );
  const result = evaluatePublicContract({ packageJson, manifest });
  console.log(`public contract check: ${result.valid ? "PASS" : "FAIL"}`);
  for (const error of result.errors) console.error(`- ${error}`);
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
