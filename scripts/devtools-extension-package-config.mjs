import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const DEFAULT_OUTPUT_PATH = ".devtools-artifacts/solace-devtools.zip";
const FORBIDDEN_MANIFEST_KEYS = [
  "permissions",
  "optional_permissions",
  "externally_connectable",
  "oauth2",
  "content_security_policy",
];

export function parseDevtoolsPackageArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  const origins = [];
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (option === "--origin" && value !== undefined) {
      origins.push(normalizeProductionOrigin(value));
      index += 1;
      continue;
    }
    if (option === "--output" && value !== undefined && outputPath === DEFAULT_OUTPUT_PATH) {
      if (!isSafeRepositoryRelativePath(value) || !value.endsWith(".zip")) {
        throw new Error("--output must be a repository-relative .zip path");
      }
      outputPath = value;
      index += 1;
      continue;
    }
    throw new Error(devtoolsPackageUsage());
  }

  const uniqueOrigins = [...new Set(origins)];
  if (uniqueOrigins.length === 0) {
    throw new Error(
      `DevTools packaging requires at least one --origin.\n${devtoolsPackageUsage()}`,
    );
  }
  return { origins: uniqueOrigins, outputPath };
}

export function parseConfiguredOrigins(value) {
  if (value === undefined) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("SOLACE_DEVTOOLS_ORIGINS must be a JSON array of HTTPS origins");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("SOLACE_DEVTOOLS_ORIGINS must be a non-empty JSON array");
  }
  return [...new Set(parsed.map(normalizeProductionOrigin))];
}

export function createExtensionManifest(baseManifest, origins) {
  const normalizedOrigins = [...new Set(origins.map(normalizeProductionOrigin))];
  if (normalizedOrigins.length === 0) throw new Error("At least one production origin is required");
  const matches = normalizedOrigins.map((origin) => `${origin}/*`);
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) {
    throw new Error("DevTools manifest must declare exactly one content script entry");
  }
  if (
    !Array.isArray(manifest.web_accessible_resources) ||
    manifest.web_accessible_resources.length !== 1
  ) {
    throw new Error("DevTools manifest must declare exactly one web-accessible resource entry");
  }
  for (const key of FORBIDDEN_MANIFEST_KEYS) {
    if (Object.hasOwn(manifest, key)) throw new Error(`DevTools manifest must not declare ${key}`);
  }

  manifest.host_permissions = matches;
  manifest.content_scripts[0].matches = matches;
  manifest.web_accessible_resources[0].matches = matches;
  return manifest;
}

export async function packageDevtoolsExtension({
  root = process.cwd(),
  origins,
  outputPath = DEFAULT_OUTPUT_PATH,
  runBuild = runExtensionBuild,
}) {
  if (!isSafeRepositoryRelativePath(outputPath) || !outputPath.endsWith(".zip")) {
    throw new Error("DevTools output must be a repository-relative .zip path");
  }
  const sourceManifestPath = resolve(root, "examples/devtools-extension/manifest.json");
  const distPath = resolve(root, "examples/devtools-extension/dist");
  const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
  const manifest = createExtensionManifest(sourceManifest, origins);

  await runBuild({ root, origins, manifest });

  const generatedManifest = JSON.parse(await readFile(join(distPath, "manifest.json"), "utf8"));
  if (JSON.stringify(generatedManifest) !== JSON.stringify(manifest)) {
    throw new Error("Generated DevTools manifest does not match requested origins and permissions");
  }

  const archiveEntries = await collectArchiveEntries(distPath);
  const archive = createZipArchive(archiveEntries);
  const resolvedOutputPath = resolve(root, outputPath);
  assertPathInsideRoot(root, resolvedOutputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, archive);

  const normalizedOrigins = [...new Set(origins.map(normalizeProductionOrigin))];
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const evidence = {
    schemaVersion: 1,
    artifactPath: outputPath,
    sha256,
    manifestSha256: createHash("sha256").update(JSON.stringify(generatedManifest)).digest("hex"),
    origins: normalizedOrigins,
  };
  const evidenceOutputPath = outputPath.replace(/\.zip$/u, ".evidence.json");
  const resolvedEvidencePath = resolve(root, evidenceOutputPath);
  assertPathInsideRoot(root, resolvedEvidencePath);
  await writeFile(resolvedEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  return {
    outputPath: resolvedOutputPath,
    evidencePath: resolvedEvidencePath,
    evidence,
    origins: normalizedOrigins,
    entries: archiveEntries.map(({ name }) => name),
    sha256,
  };
}

export function createZipArchive(rawEntries) {
  const entries = [...rawEntries]
    .map(({ name, data }) => {
      if (!isSafeArchivePath(name)) throw new Error(`Invalid ZIP entry path: ${String(name)}`);
      return { name, data: Buffer.from(data) };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(entries.map(({ name }) => name)).size !== entries.length) {
    throw new Error("Duplicate ZIP entry path");
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function devtoolsPackageUsage() {
  return "Usage: node scripts/devtools-extension-package.mjs --origin <https-origin> [--origin <https-origin>] [--output <relative.zip>]";
}

function normalizeProductionOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Expected an exact HTTPS origin: ${String(value)}`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    value.includes("*")
  ) {
    throw new Error(`Expected an exact HTTPS origin: ${String(value)}`);
  }
  return url.origin;
}

function isSafeRepositoryRelativePath(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !/^[/\\]|^[A-Za-z]:[/\\]/u.test(value) &&
    !value.split(/[/\\]+/u).includes("..")
  );
}

function isSafeArchivePath(value) {
  return isSafeRepositoryRelativePath(value) && !value.endsWith("/") && !value.includes("\\");
}

async function collectArchiveEntries(root) {
  const entries = [];
  await walk(root, "", entries);
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

async function walk(root, directory, entries) {
  const absoluteDirectory = resolve(root, directory);
  for (const entry of await readdir(absoluteDirectory, { withFileTypes: true })) {
    const name = directory === "" ? entry.name : `${directory}/${entry.name}`;
    const absolutePath = join(root, ...name.split("/"));
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink())
      throw new Error(`DevTools distribution contains a symlink: ${name}`);
    if (metadata.isDirectory()) {
      await walk(root, name, entries);
    } else if (metadata.isFile()) {
      entries.push({ name, data: await readFile(absolutePath) });
    }
  }
}

function assertPathInsideRoot(root, path) {
  const relativePath = relative(resolve(root), path);
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("DevTools output path must remain inside the repository");
  }
}

function runExtensionBuild({ root, origins }) {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn("pnpm", ["build:devtools-extension"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, SOLACE_DEVTOOLS_ORIGINS: JSON.stringify(origins) },
    });
    child.on("error", rejectBuild);
    child.on("exit", (code, signal) => {
      if (code === 0) return resolveBuild();
      rejectBuild(
        new Error(
          signal === null
            ? `pnpm build:devtools-extension failed with exit code ${String(code)}`
            : `pnpm build:devtools-extension failed with signal ${signal}`,
        ),
      );
    });
  });
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
