import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluateOneZeroReadiness,
  oneZeroReadinessUsage,
  parseOneZeroReadinessArguments,
} from "./one-zero-readiness-config.mjs";
import { loadOneZeroReadinessEvidence } from "./one-zero-readiness-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const mode = parseOneZeroReadinessArguments(process.argv.slice(2));
  if (mode === "help") {
    console.log(oneZeroReadinessUsage());
  } else {
    const evidence = await loadOneZeroReadinessEvidence({ root });
    const result = evaluateOneZeroReadiness(evidence);
    console.log(`Solace 1.0 evidence checklist: ${result.ready ? "READY" : "INCOMPLETE"}`);
    for (const criterion of result.criteria) {
      console.log(`${criterion.passed ? "PASS" : "FAIL"} ${criterion.id}: ${criterion.message}`);
    }
    if (!result.ready && mode === "check") process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
