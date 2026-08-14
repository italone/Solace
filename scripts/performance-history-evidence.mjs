import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPerformanceHistoryEvidence,
  isSafeRepositoryRelativePath,
} from "./performance-history-evidence-config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const options = parseArguments(process.argv.slice(2));
  const evidence = await createPerformanceHistoryEvidence({
    root,
    browserPath: options.browserPath,
    jsdomPath: options.jsdomPath,
  });
  const output = `${JSON.stringify(evidence, null, 2)}\n`;

  if (options.outputPath === undefined) {
    process.stdout.write(output);
  } else {
    const resolvedOutputPath = resolve(root, options.outputPath);
    await mkdir(dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, output, "utf8");
    console.log(`Wrote performance history evidence: ${options.outputPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  const options = {
    browserPath: ".benchmark-history/browser.jsonl",
    jsdomPath: ".benchmark-history/jsdom.jsonl",
    outputPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (!["--browser", "--jsdom", "--output"].includes(argument)) throw new Error(usage());

    const value = args[index + 1];
    if (!isSafeRepositoryRelativePath(value)) {
      throw new Error(`${argument} must be a repository-relative path`);
    }
    if (argument === "--browser") options.browserPath = value;
    if (argument === "--jsdom") options.jsdomPath = value;
    if (argument === "--output") options.outputPath = value;
    index += 1;
  }

  return options;
}

function usage() {
  return "Usage: node scripts/performance-history-evidence.mjs [--browser <path>] [--jsdom <path>] [--output <path>]";
}
