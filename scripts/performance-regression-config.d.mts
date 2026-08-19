export declare function evaluatePerformanceRegression(input: {
  budgets: unknown;
  browserRecords: unknown[];
  jsdomRecords: unknown[];
}): {
  valid: boolean;
  errors: string[];
  browser: Record<string, { recordCount: number }>;
  jsdom: Record<string, { recordCount: number }>;
};
