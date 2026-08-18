import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { evaluateCrossCommitPerformance } from "./performance-cross-commit-config.mjs";

try {
  const options = parseArguments(process.argv.slice(2));
  const [config, baseRecords, headRecords] = await Promise.all([
    readJson(options.config),
    readJsonLines(options.base),
    readJsonLines(options.head),
  ]);
  const result = evaluateCrossCommitPerformance({
    config,
    base: splitRevision(options.baseSha ?? inferRevisionSha(baseRecords), baseRecords),
    head: splitRevision(options.headSha ?? inferRevisionSha(headRecords), headRecords),
  });
  console.log(`performance cross-commit: ${result.valid ? "PASS" : "FAIL"}`);
  for (const error of result.errors) console.log(error);
  if (options.output !== undefined) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function parseArguments(rawArgs) {
  const options = {};
  for (let index = 0; index < rawArgs.length; index += 2) {
    const key = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!["--base", "--head", "--config", "--output", "--base-sha", "--head-sha"].includes(key)) {
      throw new Error(usage());
    }
    if (typeof value !== "string" || value.trim() === "") throw new Error(usage());
    options[key.slice(2).replace("-sha", "Sha")] = value;
  }
  if (options.base === undefined || options.head === undefined || options.config === undefined) {
    throw new Error(usage());
  }
  return options;
}

function usage() {
  return "Usage: node scripts/performance-cross-commit.mjs --base <jsonl> --head <jsonl> --config <json> [--base-sha <sha>] [--head-sha <sha>] [--output <json>]";
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function readJsonLines(path) {
  const content = await readFile(resolve(path), "utf8");
  return content
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON at ${path}:${index + 1}`);
      }
    });
}

function inferRevisionSha(records) {
  const values = new Set(
    records
      .map((record) => record?.metadata?.commitSha ?? record?.summary?.metadata?.commitSha)
      .filter((value) => typeof value === "string"),
  );
  if (values.size !== 1)
    throw new Error("A revision SHA must be supplied or uniquely present in records");
  return [...values][0];
}

function splitRevision(sha, records) {
  return {
    sha,
    browserRecords: records.filter((record) => record?.kind === "browser-benchmark"),
    jsdomRecords: records.filter((record) => record?.kind === "jsdom-benchmark"),
  };
}
