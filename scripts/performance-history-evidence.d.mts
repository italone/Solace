export type PerformanceScenarioEvidence = {
  recordCount: number;
  distinctRunCount: number;
  distinctDateCount: number;
  firstRunAt: string;
  lastRunAt: string;
};

export type PerformanceHistorySourceEvidence = {
  path: string;
  sha256: string;
  recordCount: number;
};

export type PerformanceHistoryEvidence = {
  schemaVersion: 1;
  sources: {
    browser: PerformanceHistorySourceEvidence;
    jsdom: PerformanceHistorySourceEvidence;
  };
  browserScenarios: Record<string, PerformanceScenarioEvidence>;
  jsdomScenarios: Record<string, PerformanceScenarioEvidence>;
};

export function createPerformanceHistoryEvidence(options: {
  root?: string;
  browserPath: string;
  jsdomPath: string;
}): Promise<PerformanceHistoryEvidence>;

export function isSafeRepositoryRelativePath(value: unknown): value is string;
