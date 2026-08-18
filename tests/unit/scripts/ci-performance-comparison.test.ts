import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertCandidateCheckoutRevision,
  createComparisonArtifactPaths,
  createRevisionCollectionOrder,
  normalizeRevisionRecords,
  parseComparisonArguments,
  resolveComparisonRevisions,
} from "../../../scripts/ci-performance-comparison.mjs";

const baseSha = "1111111111111111111111111111111111111111";
const headSha = "2222222222222222222222222222222222222222";

describe("CI performance comparison orchestration", () => {
  it("resolves pull request base and head revisions", () => {
    expect(
      resolveComparisonRevisions({
        eventName: "pull_request",
        event: {
          pull_request: {
            base: { sha: baseSha },
            head: { sha: headSha },
          },
        },
      }),
    ).toEqual({ baseSha, headSha });
  });

  it("resolves push before and candidate revisions", () => {
    expect(
      resolveComparisonRevisions({
        eventName: "push",
        event: { before: baseSha, after: headSha },
        githubSha: headSha,
      }),
    ).toEqual({ baseSha, headSha });
  });

  it("prefers explicit revisions and rejects missing or zero base revisions", () => {
    expect(
      resolveComparisonRevisions({
        explicitBaseSha: baseSha,
        explicitHeadSha: headSha,
        eventName: "push",
        event: {},
      }),
    ).toEqual({ baseSha, headSha });

    expect(() =>
      resolveComparisonRevisions({ eventName: "push", event: {}, githubSha: headSha }),
    ).toThrow("base revision is missing");
    expect(() =>
      resolveComparisonRevisions({
        eventName: "push",
        event: { before: "0000000000000000000000000000000000000000" },
        githubSha: headSha,
      }),
    ).toThrow("base revision must not be the all-zero SHA");
  });

  it("binds legacy records to a revision without overwriting conflicting SHAs", () => {
    const records = [
      {
        kind: "browser-benchmark",
        summary: { metadata: { browserName: "chromium" } },
      },
      {
        kind: "jsdom-benchmark",
        metadata: { benchmarkRunner: "vitest", commitSha: baseSha },
      },
    ];

    expect(normalizeRevisionRecords(records, baseSha)).toEqual([
      {
        kind: "browser-benchmark",
        summary: { metadata: { browserName: "chromium", commitSha: baseSha } },
      },
      {
        kind: "jsdom-benchmark",
        metadata: { benchmarkRunner: "vitest", commitSha: baseSha },
      },
    ]);
    expect(records[0]).toEqual({
      kind: "browser-benchmark",
      summary: { metadata: { browserName: "chromium" } },
    });

    expect(() =>
      normalizeRevisionRecords(
        [
          {
            kind: "browser-benchmark",
            summary: { metadata: { commitSha: headSha } },
          },
        ],
        baseSha,
      ),
    ).toThrow(`browser record commitSha ${headSha} conflicts with ${baseSha}`);
  });

  it("creates revision-specific raw records and a stable report path", () => {
    const paths = createComparisonArtifactPaths(".performance-artifacts", baseSha, headSha);

    expect(paths).toEqual({
      root: resolve(".performance-artifacts"),
      baseRecords: resolve(".performance-artifacts", `base-${baseSha}.jsonl`),
      headRecords: resolve(".performance-artifacts", `head-${headSha}.jsonl`),
      report: resolve(".performance-artifacts", "performance-cross-commit-report.json"),
    });
  });

  it("accepts the package-manager argument separator before CLI flags", () => {
    expect(parseComparisonArguments(["--", "--help"])).toEqual({ help: true });
  });

  it("rejects a checkout that does not match the candidate revision", () => {
    expect(() => assertCandidateCheckoutRevision(headSha, headSha)).not.toThrow();
    expect(() => assertCandidateCheckoutRevision(baseSha, headSha)).toThrow(
      `candidate checkout ${baseSha} does not match head revision ${headSha}`,
    );
  });

  it("alternates base and head collection across three samples", () => {
    expect(createRevisionCollectionOrder(3)).toEqual([
      "base",
      "head",
      "head",
      "base",
      "base",
      "head",
    ]);
  });

  it("rejects invalid collection counts and malformed benchmark inputs", () => {
    expect(() => createRevisionCollectionOrder(0)).toThrow(
      "comparison sample count must be a positive integer",
    );
    expect(() => normalizeRevisionRecords([null], baseSha)).toThrow(
      "benchmark record must be an object",
    );
    expect(() => normalizeRevisionRecords([{ kind: "unknown" }], baseSha)).toThrow(
      "unsupported benchmark record kind: unknown",
    );
    expect(() => parseComparisonArguments(["--unknown"])).toThrow("Usage:");
  });
});
