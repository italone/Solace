import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createExtensionManifest,
  createZipArchive,
  packageDevtoolsExtension,
  parseConfiguredOrigins,
  parseDevtoolsPackageArguments,
} from "../../../scripts/devtools-extension-package-config.mjs";

const baseManifest = {
  manifest_version: 3,
  name: "Solace DevTools",
  version: "0.0.1",
  content_scripts: [{ matches: ["http://localhost:6174/*"], js: ["content-script.js"] }],
  host_permissions: ["http://localhost:6174/*"],
  web_accessible_resources: [{ resources: ["bridge.js"], matches: ["http://localhost:6174/*"] }],
};

describe("DevTools extension distribution package", () => {
  it("requires explicit exact HTTPS origins", () => {
    expect(
      parseDevtoolsPackageArguments([
        "--origin",
        "https://console.example.com",
        "--origin",
        "https://status.example.com:8443",
      ]),
    ).toEqual({
      origins: ["https://console.example.com", "https://status.example.com:8443"],
      outputPath: ".devtools-artifacts/solace-devtools.zip",
    });

    expect(() => parseDevtoolsPackageArguments([])).toThrow("at least one --origin");
    expect(() => parseDevtoolsPackageArguments(["--origin", "http://console.example.com"])).toThrow(
      "HTTPS origin",
    );
    expect(() => parseDevtoolsPackageArguments(["--origin", "https://*.example.com"])).toThrow(
      "HTTPS origin",
    );
    expect(() => parseDevtoolsPackageArguments(["--origin", "https://example.com/path"])).toThrow(
      "HTTPS origin",
    );
    expect(
      parseDevtoolsPackageArguments([
        "--origin",
        "https://console.example.com",
        "--output",
        "artifacts/devtools.zip",
      ]),
    ).toMatchObject({ outputPath: "artifacts/devtools.zip" });
    expect(() =>
      parseDevtoolsPackageArguments([
        "--origin",
        "https://console.example.com",
        "--output",
        "../devtools.zip",
      ]),
    ).toThrow("repository-relative .zip path");
    expect(() =>
      parseDevtoolsPackageArguments([
        "--origin",
        "https://console.example.com",
        "--output",
        "devtools.zip",
        "--output",
        "second.zip",
      ]),
    ).toThrow("Usage:");
  });

  it("parses Vite origin configuration as a non-empty JSON allowlist", () => {
    expect(parseConfiguredOrigins(undefined)).toBeUndefined();
    expect(
      parseConfiguredOrigins('["https://console.example.com","https://console.example.com"]'),
    ).toEqual(["https://console.example.com"]);
    expect(() => parseConfiguredOrigins("not-json")).toThrow("JSON array");
    expect(() => parseConfiguredOrigins("[]")).toThrow("non-empty JSON array");
  });

  it("applies the same minimal origin allowlist to every manifest boundary", () => {
    const manifest = createExtensionManifest(baseManifest, [
      "https://console.example.com",
      "https://status.example.com:8443",
    ]);
    const matches = ["https://console.example.com/*", "https://status.example.com:8443/*"];

    expect(manifest.host_permissions).toEqual(matches);
    expect(manifest.content_scripts[0]?.matches).toEqual(matches);
    expect(manifest.web_accessible_resources[0]?.matches).toEqual(matches);
    expect(manifest).not.toHaveProperty("permissions");
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("rejects malformed or privileged source manifests", () => {
    expect(() => createExtensionManifest(baseManifest, [])).toThrow("production origin");
    expect(() =>
      createExtensionManifest({ ...baseManifest, content_scripts: [] }, [
        "https://console.example.com",
      ]),
    ).toThrow("exactly one content script");
    expect(() =>
      createExtensionManifest({ ...baseManifest, web_accessible_resources: [] }, [
        "https://console.example.com",
      ]),
    ).toThrow("exactly one web-accessible resource");
    expect(() =>
      createExtensionManifest({ ...baseManifest, permissions: ["tabs"] }, [
        "https://console.example.com",
      ]),
    ).toThrow("must not declare permissions");
  });

  it("creates a deterministic ZIP archive with sorted relative entries", () => {
    const entries = [
      { name: "manifest.json", data: Buffer.from("{}\n") },
      { name: "assets/panel.js", data: Buffer.from("panel") },
    ];

    const first = createZipArchive(entries);
    const second = createZipArchive([...entries].reverse());

    expect(second).toEqual(first);
    expect(first.readUInt32LE(0)).toBe(0x04034b50);
    expect(first.includes(Buffer.from("assets/panel.js"))).toBe(true);
    expect(first.includes(Buffer.from("manifest.json"))).toBe(true);
    expect(first.readUInt32LE(first.length - 22)).toBe(0x06054b50);
    expect(() =>
      createZipArchive([
        { name: "manifest.json", data: Buffer.from("one") },
        { name: "manifest.json", data: Buffer.from("two") },
      ]),
    ).toThrow("Duplicate ZIP entry");
    expect(() =>
      createZipArchive([{ name: "../manifest.json", data: Buffer.from("bad") }]),
    ).toThrow("Invalid ZIP entry path");
  });

  it("builds, verifies, and packages the generated production manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-devtools-package-"));
    const manifestPath = join(root, "examples/devtools-extension/manifest.json");
    const distPath = join(root, "examples/devtools-extension/dist");

    try {
      await mkdir(join(distPath, "assets"), { recursive: true });
      await writeFile(manifestPath, `${JSON.stringify(baseManifest)}\n`, "utf8");

      const result = await packageDevtoolsExtension({
        root,
        origins: ["https://console.example.com"],
        outputPath: ".devtools-artifacts/solace-devtools.zip",
        runBuild: async ({ manifest }) => {
          await writeFile(join(distPath, "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");
          await writeFile(join(distPath, "panel.html"), "<main>panel</main>\n", "utf8");
          await writeFile(join(distPath, "assets/panel.js"), "export {};\n", "utf8");
        },
      });

      expect(result.entries).toEqual(["assets/panel.js", "manifest.json", "panel.html"]);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.origins).toEqual(["https://console.example.com"]);
      expect((await readFile(result.outputPath)).readUInt32LE(0)).toBe(0x04034b50);
      expect(result.evidence).toEqual({
        schemaVersion: 1,
        artifactPath: ".devtools-artifacts/solace-devtools.zip",
        sha256: result.sha256,
        manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        origins: ["https://console.example.com"],
      });
      expect(JSON.parse(await readFile(result.evidencePath, "utf8"))).toEqual(result.evidence);

      const firstEvidence = await readFile(result.evidencePath, "utf8");
      const repeated = await packageDevtoolsExtension({
        root,
        origins: ["https://console.example.com"],
        outputPath: ".devtools-artifacts/solace-devtools.zip",
        runBuild: async ({ manifest }) => {
          await writeFile(join(distPath, "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");
          await writeFile(join(distPath, "panel.html"), "<main>panel</main>\n", "utf8");
          await writeFile(join(distPath, "assets/panel.js"), "export {};\n", "utf8");
        },
      });
      expect(repeated.sha256).toBe(result.sha256);
      expect(await readFile(repeated.evidencePath, "utf8")).toBe(firstEvidence);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a build that widens or changes the requested permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-devtools-permissions-"));
    const manifestPath = join(root, "examples/devtools-extension/manifest.json");
    const distPath = join(root, "examples/devtools-extension/dist");

    try {
      await mkdir(distPath, { recursive: true });
      await writeFile(manifestPath, `${JSON.stringify(baseManifest)}\n`, "utf8");

      await expect(
        packageDevtoolsExtension({
          root,
          origins: ["https://console.example.com"],
          outputPath: ".devtools-artifacts/solace-devtools.zip",
          runBuild: async () => {
            await writeFile(
              join(distPath, "manifest.json"),
              `${JSON.stringify({ ...baseManifest, host_permissions: ["<all_urls>"] })}\n`,
              "utf8",
            );
          },
        }),
      ).rejects.toThrow("does not match requested origins");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symbolic links in the distribution tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-devtools-symlink-"));
    const manifestPath = join(root, "examples/devtools-extension/manifest.json");
    const distPath = join(root, "examples/devtools-extension/dist");

    try {
      await mkdir(distPath, { recursive: true });
      await writeFile(manifestPath, `${JSON.stringify(baseManifest)}\n`, "utf8");

      await expect(
        packageDevtoolsExtension({
          root,
          origins: ["https://console.example.com"],
          runBuild: async ({ manifest }) => {
            await writeFile(
              join(distPath, "manifest.json"),
              `${JSON.stringify(manifest)}\n`,
              "utf8",
            );
            await symlink("manifest.json", join(distPath, "linked-manifest.json"));
          },
        }),
      ).rejects.toThrow("contains a symlink");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
