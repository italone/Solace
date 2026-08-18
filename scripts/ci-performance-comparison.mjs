import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const shaPattern = /^[0-9a-f]{40}$/u;
const zeroSha = "0".repeat(40);

if (process.argv[1] === scriptPath) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export function resolveComparisonRevisions({
  explicitBaseSha,
  explicitHeadSha,
  eventName,
  event = {},
  githubSha,
} = {}) {
  const pullRequest = isRecord(event.pull_request) ? event.pull_request : undefined;
  const baseSha =
    explicitBaseSha ??
    (eventName === "pull_request" && isRecord(pullRequest?.base)
      ? pullRequest.base.sha
      : event.before);
  const headSha =
    explicitHeadSha ??
    (eventName === "pull_request" && isRecord(pullRequest?.head)
      ? pullRequest.head.sha
      : (githubSha ?? event.after));

  validateRevisionSha("base", baseSha, { rejectZero: true });
  validateRevisionSha("head", headSha);
  if (baseSha === headSha) throw new Error("base and head revisions must be different commits");

  return { baseSha, headSha };
}

export function normalizeRevisionRecords(records, revisionSha) {
  validateRevisionSha("record", revisionSha);
  if (!Array.isArray(records)) throw new Error("benchmark records must be an array");

  return records.map((record) => {
    if (!isRecord(record)) throw new Error("benchmark record must be an object");
    if (record.kind === "browser-benchmark") {
      const summary = isRecord(record.summary) ? record.summary : {};
      const metadata = bindCommitSha("browser", summary.metadata, revisionSha);
      return { ...record, summary: { ...summary, metadata } };
    }
    if (record.kind === "jsdom-benchmark") {
      return { ...record, metadata: bindCommitSha("jsdom", record.metadata, revisionSha) };
    }
    throw new Error(`unsupported benchmark record kind: ${String(record.kind)}`);
  });
}

export function createComparisonArtifactPaths(artifactDirectory, baseSha, headSha) {
  validateRevisionSha("base", baseSha, { rejectZero: true });
  validateRevisionSha("head", headSha);
  const root = resolve(artifactDirectory);
  return {
    root,
    baseRecords: join(root, `base-${baseSha}.jsonl`),
    headRecords: join(root, `head-${headSha}.jsonl`),
    report: join(root, "performance-cross-commit-report.json"),
  };
}

export function assertCandidateCheckoutRevision(currentSha, headSha) {
  validateRevisionSha("candidate checkout", currentSha);
  validateRevisionSha("head", headSha);
  if (currentSha !== headSha) {
    throw new Error(`candidate checkout ${currentSha} does not match head revision ${headSha}`);
  }
}

async function main() {
  const options = parseComparisonArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const event = await readGithubEvent(process.env.GITHUB_EVENT_PATH);
  const revisions = resolveComparisonRevisions({
    explicitBaseSha: options.baseSha ?? process.env.SOLACE_PERFORMANCE_BASE_SHA,
    explicitHeadSha: options.headSha ?? process.env.SOLACE_PERFORMANCE_HEAD_SHA,
    eventName: process.env.GITHUB_EVENT_NAME,
    event,
    githubSha: process.env.GITHUB_SHA,
  });
  const currentSha = await readCommandOutput("git", ["rev-parse", "HEAD"], { cwd: projectRoot });
  assertCandidateCheckoutRevision(currentSha, revisions.headSha);
  const paths = createComparisonArtifactPaths(
    options.artifactsDir ?? join(projectRoot, ".performance-artifacts"),
    revisions.baseSha,
    revisions.headSha,
  );
  assertArtifactDirectory(paths.root);
  await rm(paths.root, { recursive: true, force: true });
  await mkdir(paths.root, { recursive: true });

  const temporaryRoot = await mkdtemp(join(tmpdir(), "solace-performance-comparison-"));
  const baseWorktree = join(temporaryRoot, "base");
  let worktreeCreated = false;

  try {
    await runCommand("git", ["worktree", "add", "--detach", baseWorktree, revisions.baseSha], {
      cwd: projectRoot,
    });
    worktreeCreated = true;

    await collectRevision(baseWorktree, revisions.baseSha, paths.baseRecords);
    await collectRevision(projectRoot, revisions.headSha, paths.headRecords);
    await runCommand(
      process.execPath,
      [
        resolve(projectRoot, "scripts/performance-cross-commit.mjs"),
        "--base",
        paths.baseRecords,
        "--head",
        paths.headRecords,
        "--config",
        resolve(projectRoot, "release/performance-cross-commit-budgets.json"),
        "--base-sha",
        revisions.baseSha,
        "--head-sha",
        revisions.headSha,
        "--output",
        paths.report,
      ],
      { cwd: projectRoot },
    );
  } finally {
    if (worktreeCreated) {
      await runCommand("git", ["worktree", "remove", "--force", baseWorktree], {
        cwd: projectRoot,
      }).catch((error) => console.error(error instanceof Error ? error.message : error));
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function collectRevision(cwd, revisionSha, recordsPath) {
  await runCommand("pnpm", ["install", "--frozen-lockfile"], { cwd });
  const env = {
    ...process.env,
    CI: "true",
    SOLACE_BENCHMARK_COMMIT_SHA: revisionSha,
    SOLACE_BENCHMARK_SAMPLE_SIZE: "3",
    SOLACE_BROWSER_BENCHMARK_SAMPLE_SIZE: "3",
    SOLACE_BENCHMARK_HISTORY_PATH: recordsPath,
    SOLACE_BROWSER_BENCHMARK_HISTORY_PATH: recordsPath,
  };
  await runCommand("pnpm", ["benchmark"], { cwd, env });
  await runCommand("pnpm", ["benchmark:browser"], { cwd, env });

  const records = await readJsonLines(recordsPath);
  await writeJsonLines(recordsPath, normalizeRevisionRecords(records, revisionSha));
}

export function parseComparisonArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--") continue;
    if (key === "--help") {
      options.help = true;
      continue;
    }
    if (!["--base-sha", "--head-sha", "--artifacts-dir"].includes(key)) {
      throw new Error(usage());
    }
    const value = args[index + 1];
    if (typeof value !== "string" || value.trim() === "") throw new Error(usage());
    const optionName =
      key === "--artifacts-dir" ? "artifactsDir" : key.slice(2).replace("-sha", "Sha");
    options[optionName] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return "Usage: pnpm performance:compare:ci [--base-sha <sha>] [--head-sha <sha>] [--artifacts-dir <path>]";
}

async function readGithubEvent(path) {
  if (path === undefined || path === "") return {};
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function readJsonLines(path) {
  const content = await readFile(path, "utf8");
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

async function writeJsonLines(path, records) {
  await writeFile(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function bindCommitSha(kind, rawMetadata, revisionSha) {
  const metadata = isRecord(rawMetadata) ? rawMetadata : {};
  if (metadata.commitSha !== undefined && metadata.commitSha !== revisionSha) {
    throw new Error(
      `${kind} record commitSha ${String(metadata.commitSha)} conflicts with ${revisionSha}`,
    );
  }
  return { ...metadata, commitSha: revisionSha };
}

function validateRevisionSha(label, value, { rejectZero = false } = {}) {
  if (value === undefined || value === "") throw new Error(`${label} revision is missing`);
  if (rejectZero && value === zeroSha)
    throw new Error(`${label} revision must not be the all-zero SHA`);
  if (typeof value !== "string" || !shaPattern.test(value)) {
    throw new Error(`${label} revision must be a 40-character lowercase hexadecimal SHA`);
  }
}

function assertArtifactDirectory(path) {
  const pathFromRoot = relative(projectRoot, path);
  if (pathFromRoot === "" || pathFromRoot.startsWith("..") || resolve(path) === projectRoot) {
    throw new Error("performance artifacts directory must be inside the project root");
  }
}

function runCommand(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      if (signal !== null) {
        rejectRun(new Error(`${command} ${args.join(" ")} failed with signal ${signal}`));
        return;
      }
      rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function readCommandOutput(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const output = [];
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", (chunk) => output.push(chunk));
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun(Buffer.concat(output).toString("utf8").trim());
        return;
      }
      if (signal !== null) {
        rejectRun(new Error(`${command} ${args.join(" ")} failed with signal ${signal}`));
        return;
      }
      rejectRun(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
