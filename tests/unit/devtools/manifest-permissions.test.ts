import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type ExtensionManifest = {
  content_scripts?: Array<{ matches?: string[] }>;
  host_permissions?: string[];
  web_accessible_resources?: Array<{ matches?: string[] }>;
};

const LOCAL_DEMO_MATCHES = ["http://127.0.0.1:6174/*", "http://localhost:6174/*"];

describe("DevTools extension permissions", () => {
  it("restricts page access to the local demo origin", async () => {
    const manifest = JSON.parse(
      await readFile("examples/devtools-extension/manifest.json", "utf8"),
    ) as ExtensionManifest;

    expect(manifest.host_permissions).toEqual(LOCAL_DEMO_MATCHES);
    expect(manifest.content_scripts?.[0]?.matches).toEqual(LOCAL_DEMO_MATCHES);
    expect(manifest.web_accessible_resources?.[0]?.matches).toEqual(LOCAL_DEMO_MATCHES);
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });
});
