import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createEvidenceBundle,
  parseAdoptionEvidenceArguments,
  sha256Json,
  validatePhaseRecord,
} from "../../../scripts/adoption-evidence-config.mjs";
import { runAdoptionEvidence } from "../../../scripts/adoption-evidence.mjs";

const digest = "a".repeat(64);

function phaseRecord(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    phase: "baseline",
    application: {
      name: "independent-console",
      independent: true,
      primaryRenderer: "solace",
      repository: "https://github.com/example/independent-console",
      productionOrigin: "https://console.example.com",
    },
    repository: { commit: "abc1234", dirty: false },
    package: {
      name: "@italone/solace",
      version: "0.1.0-beta.6",
      manager: "pnpm",
      lockfile: "pnpm-lock.yaml",
      lockfileSha256: digest,
    },
    workflows: {
      router: true,
      store: true,
      asyncComponents: true,
      errorRecovery: true,
      ssrHydration: true,
    },
    commands: [
      {
        argv: ["pnpm", "check"],
        exitCode: 0,
        durationMs: 120,
        stdoutSha256: digest,
        stderrSha256: digest,
      },
    ],
    verified: true,
    reviewer: { name: "release-reviewer", approved: true },
    ...overrides,
  };
}

describe("adoption evidence contract", () => {
  it("accepts a complete baseline phase record", () => {
    expect(validatePhaseRecord(phaseRecord())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [
      "non-HTTPS production origin",
      {
        application: {
          ...phaseRecord().application,
          productionOrigin: "http://console.example.com",
        },
      },
    ],
    ["version range", { package: { ...phaseRecord().package, version: "^0.1.0-beta.6" } }],
    ["dirty repository", { repository: { commit: "abc1234", dirty: true } }],
    [
      "missing lockfile digest",
      { package: { ...phaseRecord().package, lockfileSha256: undefined } },
    ],
    ["failed command", { commands: [{ ...phaseRecord().commands[0], exitCode: 1 }] }],
  ])("rejects %s", (_label, overrides) => {
    const result = validatePhaseRecord(phaseRecord(overrides));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it.each([
    ["missing application", phaseRecord({ application: undefined }), "application is required"],
    [
      "invalid application identity",
      phaseRecord({
        application: {
          name: "",
          independent: false,
          primaryRenderer: "react",
          repository: "https://user:password@github.com/example/app",
          productionOrigin: "https://console.example.com/path",
        },
      }),
      "application.name is required",
    ],
    [
      "missing repository commit",
      phaseRecord({ repository: { commit: "", dirty: false } }),
      "repository.commit is required",
    ],
    [
      "invalid package metadata",
      phaseRecord({
        package: {
          name: "solace-local",
          version: "0.1.0-beta.6",
          manager: "",
          lockfile: "",
          lockfileSha256: digest,
        },
      }),
      "package.name must be @italone/solace",
    ],
    [
      "incomplete workflows",
      phaseRecord({ workflows: { ...phaseRecord().workflows, router: false } }),
      "all required production workflows must be true",
    ],
    ["missing commands", phaseRecord({ commands: [] }), "commands are required"],
    [
      "invalid command audit fields",
      phaseRecord({
        commands: [
          {
            argv: [],
            exitCode: 1,
            durationMs: -1,
            stdoutSha256: "invalid",
            stderrSha256: "invalid",
          },
        ],
      }),
      "commands[0].argv is required",
    ],
    [
      "unverified phase",
      phaseRecord({ verified: false, reviewer: undefined }),
      "phase must be marked verified",
    ],
    [
      "unapproved reviewer",
      phaseRecord({ reviewer: { name: "release-reviewer", approved: false } }),
      "reviewer approval is required",
    ],
    [
      "missing baseline digest",
      phaseRecord({ phase: "candidate", baselineEvidenceSha256: undefined }),
      "baselineEvidenceSha256 must be SHA-256",
    ],
  ])("reports %s", (_label, record, expectedError) => {
    expect(validatePhaseRecord(record)).toMatchObject({ valid: false });
    expect(validatePhaseRecord(record).errors).toContain(expectedError);
  });

  it("requires candidate and rollback phases to bind the baseline digest", () => {
    const baseline = phaseRecord();
    const candidate = phaseRecord({ phase: "candidate", baselineEvidenceSha256: "b".repeat(64) });
    const rollback = phaseRecord({
      phase: "rollback",
      baselineEvidenceSha256: sha256Json(baseline),
    });

    expect(() => createEvidenceBundle([baseline, candidate, rollback])).toThrow(
      "baseline evidence digest mismatch",
    );
  });

  it("creates a deterministic bundle for matching phases", () => {
    const baseline = phaseRecord();
    const baselineDigest = sha256Json(baseline);
    const candidate = phaseRecord({
      phase: "candidate",
      package: { ...baseline.package, version: "0.1.0-beta.7" },
      baselineEvidenceSha256: baselineDigest,
    });
    const rollback = phaseRecord({
      phase: "rollback",
      baselineEvidenceSha256: baselineDigest,
    });
    const bundle = createEvidenceBundle([baseline, candidate, rollback]);

    expect(bundle.verified).toBe(true);
    expect(bundle.application.name).toBe("independent-console");
    expect(bundle.phases).toEqual(["baseline", "candidate", "rollback"]);
    expect(bundle.bundleSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires a distinct candidate and an exact rollback to baseline", () => {
    const baseline = phaseRecord();
    const baselineDigest = sha256Json(baseline);
    const sameCandidate = phaseRecord({
      phase: "candidate",
      baselineEvidenceSha256: baselineDigest,
    });
    const wrongRollback = phaseRecord({
      phase: "rollback",
      package: { ...baseline.package, version: "0.1.0-beta.5" },
      baselineEvidenceSha256: baselineDigest,
    });

    expect(() => createEvidenceBundle([baseline, sameCandidate, wrongRollback])).toThrow(
      "candidate package version must differ from baseline",
    );
    expect(() =>
      createEvidenceBundle([
        baseline,
        phaseRecord({
          phase: "candidate",
          package: { ...baseline.package, version: "0.1.0-beta.7" },
          baselineEvidenceSha256: baselineDigest,
        }),
        wrongRollback,
      ]),
    ).toThrow("rollback package version must match baseline");
  });

  it("parses explicit record and output paths", () => {
    expect(
      parseAdoptionEvidenceArguments([
        "--record",
        "baseline.json",
        "--record",
        "candidate.json",
        "--record",
        "rollback.json",
        "--output",
        "evidence/bundle.json",
      ]),
    ).toEqual({
      records: ["baseline.json", "candidate.json", "rollback.json"],
      output: "evidence/bundle.json",
    });
  });

  it("hashes canonical JSON bytes", () => {
    const value = { b: 2, a: 1 };
    expect(sha256Json(value)).toBe(
      createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    );
  });

  it.each([
    [
      "absolute output",
      [
        "--record",
        "a.json",
        "--record",
        "b.json",
        "--record",
        "c.json",
        "--output",
        "/tmp/bundle.json",
      ],
    ],
    [
      "traversal output",
      [
        "--record",
        "a.json",
        "--record",
        "b.json",
        "--record",
        "c.json",
        "--output",
        "../bundle.json",
      ],
    ],
    [
      "duplicate record",
      ["--record", "a.json", "--record", "a.json", "--record", "c.json", "--output", "bundle.json"],
    ],
  ])("rejects unsafe CLI arguments: %s", (_label, args) => {
    expect(() => parseAdoptionEvidenceArguments(args)).toThrow("adoption evidence usage failed");
  });

  it("writes a deterministic bundle without changing the input records", async () => {
    const root = await mkdtemp(join(tmpdir(), "solace-adoption-evidence-test-"));
    const baseline = phaseRecord();
    const baselineDigest = sha256Json(baseline);
    const records = [
      baseline,
      phaseRecord({
        phase: "candidate",
        package: { ...baseline.package, version: "0.1.0-beta.7" },
        baselineEvidenceSha256: baselineDigest,
      }),
      phaseRecord({ phase: "rollback", baselineEvidenceSha256: baselineDigest }),
    ];
    const paths = ["baseline.json", "candidate.json", "rollback.json"];
    await Promise.all(
      paths.map((path, index) =>
        writeFile(join(root, path), `${JSON.stringify(records[index], null, 2)}\n`),
      ),
    );

    const result = await runAdoptionEvidence(
      { records: paths, output: "out/bundle.json" },
      { root },
    );
    const output = JSON.parse(await readFile(join(root, "out/bundle.json"), "utf8"));

    expect(result.outputPath).toBe(await realpath(join(root, "out/bundle.json")));
    expect(output.bundleSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(await readFile(join(root, "baseline.json"), "utf8"))).toEqual(baseline);
  });
});
