export function evaluatePerformanceRegression({ budgets, browserRecords, jsdomRecords }) {
  const errors = [];
  if (budgets?.schemaVersion !== 1) errors.push("budget schemaVersion must be 1");
  const minimumDistinctRuns = budgets?.minimumDistinctRuns;
  const minimumDistinctDates = budgets?.minimumDistinctDates;
  if (!Number.isInteger(minimumDistinctRuns) || minimumDistinctRuns < 1) {
    errors.push("minimumDistinctRuns must be a positive integer");
  }
  if (!Number.isInteger(minimumDistinctDates) || minimumDistinctDates < 1) {
    errors.push("minimumDistinctDates must be a positive integer");
  }

  const browser = evaluateBrowserScenarios(
    budgets?.browser,
    browserRecords,
    minimumDistinctRuns,
    minimumDistinctDates,
    errors,
  );
  const jsdom = evaluateJsdomScenarios(
    budgets?.jsdom,
    jsdomRecords,
    minimumDistinctRuns,
    minimumDistinctDates,
    errors,
  );

  return { valid: errors.length === 0, errors, browser, jsdom };
}

function evaluateBrowserScenarios(budgets, records, minimumRuns, minimumDates, errors) {
  if (!isRecord(budgets) || Object.keys(budgets).length === 0) {
    errors.push("browser budgets must be a non-empty object");
    return {};
  }

  const grouped = new Map();
  for (const record of records ?? []) {
    if (record?.kind !== "browser-benchmark" || record?.status !== "passed") continue;
    const scenario = record.summary?.scenario;
    if (typeof scenario !== "string") continue;
    const key = scenario === "keyed-reorder" ? `${scenario}:${record.summary?.shape}` : scenario;
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  }

  for (const [name, budget] of Object.entries(budgets)) {
    const scenarioRecords = grouped.get(name) ?? [];
    evaluateScenario(name, budget, scenarioRecords, minimumRuns, minimumDates, errors);
    const latest = latestRecord(scenarioRecords);
    for (const [metric, limit] of Object.entries(budget ?? {})) {
      if (
        !Number.isFinite(limit) ||
        metric === "minimumDistinctRuns" ||
        metric === "minimumDistinctDates"
      ) {
        continue;
      }
      const value = latest?.summary?.[metric];
      if (typeof value === "number" && value > limit) {
        errors.push(`browser:${name}.${metric} ${value}ms exceeds ${limit}ms budget`);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(budgets).map(([name]) => [
      name,
      { recordCount: (grouped.get(name) ?? []).length },
    ]),
  );
}

function evaluateJsdomScenarios(budgets, records, minimumRuns, minimumDates, errors) {
  if (!isRecord(budgets) || Object.keys(budgets).length === 0) {
    errors.push("jsdom budgets must be a non-empty object");
    return {};
  }

  const grouped = new Map();
  for (const record of records ?? []) {
    if (record?.kind !== "jsdom-benchmark" || record?.status !== "passed") continue;
    for (const task of record.summary?.tasks ?? []) {
      if (typeof task?.name !== "string") continue;
      const list = grouped.get(task.name) ?? [];
      list.push({ record, task });
      grouped.set(task.name, list);
    }
  }

  for (const [name, budget] of Object.entries(budgets)) {
    const scenarioRecords = grouped.get(name) ?? [];
    evaluateScenario(
      name,
      budget,
      scenarioRecords.map(({ record }) => record),
      minimumRuns,
      minimumDates,
      errors,
      "jsdom",
    );
    const latest = latestTask(scenarioRecords);
    for (const [metric, limit] of Object.entries(budget ?? {})) {
      if (!Number.isFinite(limit)) continue;
      const value = latest?.task?.metrics?.[metric];
      if (typeof value === "number" && value > limit) {
        errors.push(`jsdom:${name}.${metric} ${value}ms exceeds ${limit}ms budget`);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(budgets).map(([name]) => [
      name,
      { recordCount: (grouped.get(name) ?? []).length },
    ]),
  );
}

function evaluateScenario(
  name,
  budget,
  records,
  minimumRuns,
  minimumDates,
  errors,
  kind = "browser",
) {
  if (!isRecord(budget)) {
    errors.push(`${kind}:${name} budget must be an object`);
    return;
  }
  const runs = new Set(records.map(recordRunAt).filter(Boolean));
  const dates = new Set(
    [...runs]
      .map((value) => String(value).slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  );
  if (runs.size < minimumRuns)
    errors.push(`${kind}:${name} has ${runs.size}/${minimumRuns} distinct runs`);
  if (dates.size < minimumDates)
    errors.push(`${kind}:${name} has ${dates.size}/${minimumDates} distinct dates`);
  if (records.length === 0) errors.push(`${kind}:${name} has no successful records`);
}

function latestRecord(records) {
  return [...records].sort((a, b) =>
    String(recordRunAt(b)).localeCompare(String(recordRunAt(a))),
  )[0];
}

function latestTask(records) {
  return [...records].sort((a, b) =>
    String(recordRunAt(b?.record)).localeCompare(String(recordRunAt(a?.record))),
  )[0];
}

function recordRunAt(record) {
  return record?.metadata?.runAt ?? record?.summary?.metadata?.runAt;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
