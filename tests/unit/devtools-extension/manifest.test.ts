import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("devtools extension manifest policy", () => {
  it("restricts inspected-page permissions to the local demo origins", async () => {
    const [manifestRaw, devtools, release] = await Promise.all([
      readFile("examples/devtools-extension/manifest.json", "utf8"),
      readFile("docs/devtools.md", "utf8"),
      readFile("docs/release.md", "utf8"),
    ]);
    const manifest = JSON.parse(manifestRaw) as {
      content_scripts?: Array<{ matches?: string[] }>;
      host_permissions?: string[];
      web_accessible_resources?: Array<{ matches?: string[] }>;
    };

    const localDemoMatches = ["http://127.0.0.1:6174/*", "http://localhost:6174/*"];
    expect(manifest.content_scripts?.[0]?.matches).toEqual(localDemoMatches);
    expect(manifest.host_permissions).toEqual(localDemoMatches);
    expect(manifest.web_accessible_resources?.[0]?.matches).toEqual(localDemoMatches);

    expect(devtools).toContain("restricted to the fixed local demo origins");
    expect(devtools).toContain(
      "Review `matches`, `host_permissions`, and `web_accessible_resources.matches`",
    );
    expect(devtools).toContain("production browser-store package");
    expect(release).toContain("review and narrow extension permissions");
  });

  it("keeps the example extension local-only without storage, network, or tab powers", async () => {
    const [manifestRaw, devtools] = await Promise.all([
      readFile("examples/devtools-extension/manifest.json", "utf8"),
      readFile("docs/devtools.md", "utf8"),
    ]);
    const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;

    expect(manifest.permissions).toBeUndefined();
    expect(manifest.optional_permissions).toBeUndefined();
    expect(manifest.externally_connectable).toBeUndefined();
    expect(manifest.oauth2).toBeUndefined();
    expect(manifest.content_security_policy).toBeUndefined();
    expect(manifest).not.toHaveProperty("background.persistent");

    expect(JSON.stringify(manifest)).not.toMatch(/\b(storage|tabs|scripting|webRequest)\b/);
    expect(devtools).toContain("Do not add `permissions`, `optional_permissions`");
    expect(devtools).toContain(
      "`externally_connectable`, `oauth2`, or custom `content_security_policy`",
    );
    expect(devtools).toContain("without a separate");
    expect(devtools).toContain("production extension policy review");
  });
});
