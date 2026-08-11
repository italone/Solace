import { describe, expect, it } from "vitest";

import {
  createPnpmSpawnOptions,
  discoverBrowserEntry,
} from "../../../scripts/operations-console-smoke.mjs";
import {
  createConsumerPackageJson,
  createConsumerTsconfig,
  parseSmokeArguments,
} from "../../../scripts/operations-console-smoke-config.mjs";

describe("operations console package smoke", () => {
  it("uses the shell only when spawning pnpm on Windows", () => {
    expect(createPnpmSpawnOptions("C:\\consumer", "win32")).toEqual({
      cwd: "C:\\consumer",
      stdio: "inherit",
      shell: true,
    });
    expect(createPnpmSpawnOptions("/tmp/consumer", "linux")).toEqual({
      cwd: "/tmp/consumer",
      stdio: "inherit",
      shell: false,
    });
  });

  it("discovers the packed browser entry from the built index", () => {
    expect(
      discoverBrowserEntry(
        '<script type="module" src="/assets/index-abc123.js"></script>',
        "/tmp/consumer/dist/browser",
      ),
    ).toBe("file:///tmp/consumer/dist/browser/assets/index-abc123.js");
  });

  it("pins only the requested Solace package in the consumer", () => {
    expect(createConsumerPackageJson("file:/tmp/solace.tgz")).toEqual({
      private: true,
      type: "module",
      dependencies: { "@italone/solace": "file:/tmp/solace.tgz" },
    });
  });

  it("returns fresh package configuration objects", () => {
    const first = createConsumerPackageJson("first");
    const second = createConsumerPackageJson("second");

    expect(first).not.toBe(second);
    expect(first.dependencies).not.toBe(second.dependencies);
    expect(first.dependencies["@italone/solace"]).toBe("first");
    expect(second.dependencies["@italone/solace"]).toBe("second");
  });

  it("excludes candidate-only async server code from the beta.2 baseline", () => {
    const baseline = createConsumerTsconfig(false);
    const candidate = createConsumerTsconfig(true);

    expect(baseline.compilerOptions.strict).toBe(true);
    expect(baseline.include).toContain("src");
    expect(baseline.exclude).toContain("src/entries/server-async.tsx");
    expect(candidate.exclude).not.toContain("src/entries/server-async.tsx");
  });

  it("returns fresh TypeScript configuration objects", () => {
    const first = createConsumerTsconfig(false);
    const second = createConsumerTsconfig(false);

    expect(first).not.toBe(second);
    expect(first.compilerOptions).not.toBe(second.compilerOptions);
    expect(first.include).not.toBe(second.include);
    expect(first.exclude).not.toBe(second.exclude);
  });

  it("accepts no arguments or only the pinned baseline option", () => {
    expect(parseSmokeArguments([])).toEqual({});
    expect(parseSmokeArguments(["--baseline", "0.1.0-beta.2"])).toEqual({
      baseline: "0.1.0-beta.2",
    });
  });

  it.each(["latest", "beta", "^0.1.0-beta.2", ">=0.1.0-beta.2"])(
    "rejects the unsupported baseline %s",
    (baseline) => {
      expect(() => parseSmokeArguments(["--baseline", baseline])).toThrow(
        "Baseline must be 0.1.0-beta.2",
      );
    },
  );

  it.each<[string[]]>([
    [["--baseline"]],
    [["--baseline=0.1.0-beta.2"]],
    [["--unknown"]],
    [["0.1.0-beta.2"]],
    [["--baseline", "0.1.0-beta.2", "extra"]],
  ])("rejects malformed arguments: %j", (args) => {
    expect(() => parseSmokeArguments(args)).toThrow();
  });
});
