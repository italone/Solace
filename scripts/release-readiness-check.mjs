import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { hasReleaseCheckCommand } from "./release-readiness-check-commands.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const failures = [];
const warnings = [];
const options = parseArgs(process.argv.slice(2));

const packageJson = await readJson("package.json");
const changesetConfig = await readJson(".changeset/config.json");
const gitignore = await readText(".gitignore");

if (options.help) {
  printHelp();
  process.exit(0);
}

requireString(packageJson.name, "package.json name");
requireString(packageJson.version, "package.json version");
requireString(packageJson.main, "package.json main");
requireString(packageJson.module, "package.json module");
requireString(packageJson.types, "package.json types");
requireArray(packageJson.files, "package.json files");
requireObject(packageJson.exports, "package.json exports");
requireObject(packageJson.scripts, "package.json scripts");

requireScript("quality");
requireScript("package:smoke");
requireScript("stable:app");
requireScript("release:check");
requireScript("release:version");
requireScript("release:publish:beta");
requireScript("release:publish");
requireReleaseCheckCommand("pnpm release:readiness");
requireReleaseCheckCommand("pnpm package:smoke");
requireReleaseCheckCommand("pnpm stable:app");
requireReleaseCheckCommand("pnpm test:e2e");
requireReleaseCheckCommand("pnpm test:e2e:devtools-extension");
requireReleaseCheckCommand("pnpm benchmark:browser");
requireGitignorePattern(".benchmark-history/");

if (changesetConfig.access !== "public") {
  failures.push('.changeset/config.json access must be "public" before public publishing.');
}

const packageIsPrivate = packageJson.private === true;

if (packageIsPrivate) {
  if (options.publishable) {
    failures.push(
      'package.json still has "private": true; remove it only after explicit publish approval.',
    );
  } else {
    warnings.push(
      'package.json has "private": true; package is intentionally not publishable yet.',
    );
  }
} else if (packageJson.private !== undefined && packageJson.private !== false) {
  failures.push("package.json private must be true, false, or omitted.");
}

if (!hasPackageFile("dist")) {
  failures.push('package.json files must include "dist".');
}

if (!hasPackageFile("readme.md")) {
  failures.push('package.json files must include "readme.md".');
}

if (!hasPackageFile("docs/*.md")) {
  failures.push('package.json files must include "docs/*.md".');
}

let gitSynchronization = "checked";
if (options.skipGitCheck) {
  gitSynchronization = "skipped";
} else if (options.publishable) {
  const gitStatus = await readGitStatus(options.gitStatusFile);
  const gitFailure = validateGitStatus(gitStatus);
  if (gitFailure !== undefined) {
    failures.push(gitFailure);
  }
}

if (failures.length > 0) {
  console.error("release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("release readiness check passed");
  console.log(`package: ${packageJson.name}@${packageJson.version}`);
  console.log(`changeset access: ${changesetConfig.access}`);
  console.log(`mode: ${options.publishable ? "publishable" : "default"}`);
  console.log(
    "public API gates: pnpm release:readiness, pnpm package:smoke, pnpm stable:app, pnpm test:e2e, pnpm test:e2e:devtools-extension",
  );
  console.log("benchmark history: .benchmark-history/ ignored local JSONL artifacts");
  if (options.publishable) {
    console.log(`git synchronization: ${gitSynchronization}`);
  }
}

for (const warning of warnings) {
  console.log(`note: ${warning}`);
}

if (!options.publishable) {
  if (packageIsPrivate) {
    console.log("publishability: skipped; run with --publishable after explicit publish approval.");
  } else {
    console.log("publishability: ready; run with --publishable to verify publishable mode.");
  }
}

function parseArgs(args) {
  const parsed = {
    gitStatusFile: undefined,
    help: false,
    publishable: false,
    skipGitCheck: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--publishable") {
      parsed.publishable = true;
      continue;
    }

    if (arg === "--skip-git-check") {
      parsed.skipGitCheck = true;
      continue;
    }

    if (arg === "--git-status-file") {
      parsed.gitStatusFile = requireArgValue(args[index + 1], "--git-status-file");
      index += 1;
      continue;
    }

    if (arg.startsWith("--git-status-file=")) {
      parsed.gitStatusFile = requireArgValue(
        arg.slice("--git-status-file=".length),
        "--git-status-file",
      );
      continue;
    }

    failures.push(`Unknown option: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: pnpm release:readiness -- [options]

Options:
  --publishable              Verify stricter checks required before npm publishing.
  --skip-git-check           Skip publishable git synchronization checks for metadata-only audits.
  --git-status-file <path>   Read git status from a file, used by script tests.
  -h, --help                 Show this help message.
`);
}

function requireArgValue(value, optionName) {
  if (typeof value !== "string" || value.trim() === "") {
    failures.push(`${optionName} requires a non-empty value.`);
    return undefined;
  }

  return value;
}

async function readJson(relativePath) {
  const raw = await readText(relativePath);
  return JSON.parse(raw);
}

async function readText(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

async function readGitStatus(gitStatusFile) {
  if (gitStatusFile !== undefined) {
    return readFile(gitStatusFile, "utf8");
  }

  try {
    const { stdout } = await execFileAsync("git", ["status", "--short", "--branch"], { cwd: root });
    return stdout;
  } catch {
    return undefined;
  }
}

function validateGitStatus(status) {
  if (typeof status !== "string" || status.trim() === "") {
    return "local branch must be synchronized with its upstream before publishable mode; git status could not be read.";
  }

  const lines = status.trimEnd().split(/\r?\n/);
  const branchLine = lines[0] ?? "";
  const worktreeLines = lines.slice(1);

  if (!branchLine.startsWith("## ")) {
    return "local branch must be synchronized with its upstream before publishable mode; git branch status is missing.";
  }

  if (branchLine.includes("[ahead") || branchLine.includes("[behind")) {
    return `local branch must be synchronized with its upstream before publishable mode; current status is "${branchLine}".`;
  }

  if (!branchLine.includes("...")) {
    return "local branch must be synchronized with its upstream before publishable mode; no upstream branch is configured.";
  }

  if (worktreeLines.length > 0) {
    return "local worktree must be clean before publishable mode.";
  }

  return undefined;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    failures.push(`${label} must be a non-empty string.`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push(`${label} must be a non-empty array.`);
  }
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object.`);
  }
}

function requireScript(name) {
  if (packageJson.scripts === null || typeof packageJson.scripts !== "object") {
    failures.push(`package.json scripts must include "${name}".`);
    return;
  }

  if (typeof packageJson.scripts[name] !== "string" || packageJson.scripts[name].length === 0) {
    failures.push(`package.json scripts must include "${name}".`);
  }
}

function requireReleaseCheckCommand(command) {
  const releaseCheck = packageJson.scripts?.["release:check"];

  if (!hasReleaseCheckCommand(releaseCheck, command)) {
    failures.push(`package.json release:check must include "${command}".`);
  }
}

function requireGitignorePattern(pattern) {
  const ignoredPatterns = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (!ignoredPatterns.includes(pattern)) {
    failures.push(`.gitignore must include "${pattern}" for local benchmark history artifacts.`);
  }
}

function hasPackageFile(pattern) {
  return Array.isArray(packageJson.files) && packageJson.files.includes(pattern);
}
