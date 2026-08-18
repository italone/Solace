export type ComparisonRevisionInput = {
  explicitBaseSha?: string;
  explicitHeadSha?: string;
  eventName?: string;
  event?: Record<string, unknown>;
  githubSha?: string;
};

export type ComparisonArtifactPaths = {
  root: string;
  baseRecords: string;
  headRecords: string;
  report: string;
};

export type ComparisonArguments = {
  help?: boolean;
  baseSha?: string;
  headSha?: string;
  artifactsDir?: string;
};

export function resolveComparisonRevisions(input?: ComparisonRevisionInput): {
  baseSha: string;
  headSha: string;
};

export function normalizeRevisionRecords(records: unknown[], revisionSha: string): unknown[];

export function createComparisonArtifactPaths(
  artifactDirectory: string,
  baseSha: string,
  headSha: string,
): ComparisonArtifactPaths;

export function assertCandidateCheckoutRevision(currentSha: string, headSha: string): void;

export function parseComparisonArguments(args: string[]): ComparisonArguments;
