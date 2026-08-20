export type CrossCommitComparison = {
  id: string;
  baseMin: number;
  headMin: number;
  baseMedian: number;
  headMedian: number;
  ratio: number;
  limit: number;
  absoluteDeltaFloorMs: number;
};

export function median(values: number[]): number;

export function evaluateCrossCommitPerformance(input: {
  config: unknown;
  base: { sha: string; browserRecords: unknown[]; jsdomRecords: unknown[] };
  head: { sha: string; browserRecords: unknown[]; jsdomRecords: unknown[] };
}): {
  valid: boolean;
  errors: string[];
  comparisons: CrossCommitComparison[];
  revisions: { base: string | undefined; head: string | undefined };
};
