export type OneZeroReadinessCriterion = {
  id: string;
  passed: boolean;
  message: string;
};

export type OneZeroReadinessResult = {
  ready: boolean;
  criteria: OneZeroReadinessCriterion[];
};

export function parseOneZeroReadinessArguments(rawArgs: string[]): "check" | "report" | "help";

export function oneZeroReadinessUsage(): string;

export function isSafeEvidencePath(value: unknown): value is string;

export function evaluateOneZeroReadiness(
  evidence: unknown,
  options?: { now?: number },
): {
  ready: boolean;
  criteria: OneZeroReadinessCriterion[];
};
