import { describe, expect, it } from "vitest";

import {
  createAdoptionConsumerPackageJson,
  parseAdoptionSmokeArguments,
  withAdoptionFailureStage,
} from "../../../scripts/adoption-consumer-smoke.mjs";

describe("adoption consumer smoke", () => {
  it("defaults to the local packed candidate", () => {
    expect(parseAdoptionSmokeArguments([])).toEqual({ browsers: false, packageSpec: undefined });
  });

  it("accepts an exact registry version and browser validation", () => {
    expect(parseAdoptionSmokeArguments(["--package", "0.1.0-beta.4", "--browsers"])).toEqual({
      browsers: true,
      packageSpec: "0.1.0-beta.4",
    });
  });

  it.each<[string[]]>([
    [["--package", "beta"]],
    [["--package", "^0.1.0"]],
    [["--package", "file:../candidate.tgz"]],
    [["--browsers", "extra"]],
    [["--unknown"]],
  ])("rejects ambiguous package arguments: %j", (args) => {
    expect(() => parseAdoptionSmokeArguments(args)).toThrow("adoption smoke usage failed");
  });

  it("creates an alias-free consumer package", () => {
    expect(createAdoptionConsumerPackageJson("file:/tmp/solace.tgz")).toEqual({
      private: true,
      type: "module",
      dependencies: { "@italone/solace": "file:/tmp/solace.tgz" },
    });
  });

  it("prefixes failures with a stable stage", () => {
    const error = withAdoptionFailureStage("browser validation", new Error("page failed"));
    expect(error.message).toBe("adoption browser validation failed: page failed");
    expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
  });
});
