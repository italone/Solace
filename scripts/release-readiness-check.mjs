import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishableMode = process.argv.includes("--publishable");

const packageJson = await readJson("package.json");
const changesetConfig = await readJson(".changeset/config.json");
const failures = [];
const warnings = [];

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
requireScript("release:check");
requireScript("release:version");
requireScript("release:publish");
requireReleaseCheckCommand("pnpm benchmark:browser");

if (changesetConfig.access !== "public") {
  failures.push('.changeset/config.json access must be "public" before public publishing.');
}

if (packageJson.private === true) {
  if (publishableMode) {
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
  console.log(`mode: ${publishableMode ? "publishable" : "default"}`);
}

for (const warning of warnings) {
  console.log(`note: ${warning}`);
}

if (!publishableMode) {
  console.log("publishability: skipped; run with --publishable after explicit publish approval.");
}

async function readJson(relativePath) {
  const raw = await readFile(resolve(root, relativePath), "utf8");
  return JSON.parse(raw);
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

  if (typeof releaseCheck !== "string" || !releaseCheck.includes(command)) {
    failures.push(`package.json release:check must include "${command}".`);
  }
}

function hasPackageFile(pattern) {
  return Array.isArray(packageJson.files) && packageJson.files.includes(pattern);
}
