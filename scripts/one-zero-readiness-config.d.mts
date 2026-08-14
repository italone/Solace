export type OneZeroReadinessCriterion = {
  id: string;
  passed: boolean;
  message: string;
};

export function parseOneZeroReadinessArguments(rawArgs: string[]): "check" | "report" | "help";

export function oneZeroReadinessUsage(): string;

export function isSafeEvidencePath(value: unknown): value is string;

export function evaluateOneZeroReadiness(evidence: unknown): {
  ready: boolean;
  criteria: OneZeroReadinessCriterion[];
};
