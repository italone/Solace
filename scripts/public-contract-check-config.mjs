const MATURITIES = new Set(["stable", "beta", "experimental"]);

export function evaluatePublicContract({ packageJson, manifest }) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!Array.isArray(manifest?.entries) || manifest.entries.length === 0) {
    errors.push("manifest entries must be a non-empty array");
  }

  const packageExports = isRecord(packageJson?.exports) ? Object.keys(packageJson.exports) : [];
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const manifestKeys = entries.map((entry) => entry?.key);
  const missing = packageExports.filter((key) => !manifestKeys.includes(key));
  const extra = manifestKeys.filter(
    (key) => typeof key === "string" && !packageExports.includes(key),
  );
  if (missing.length > 0) errors.push(`missing manifest entries: ${missing.join(", ")}`);
  if (extra.length > 0) errors.push(`manifest contains unknown entries: ${extra.join(", ")}`);

  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.key !== "string" || typeof entry.path !== "string") {
      errors.push("every manifest entry requires string key and path");
      continue;
    }
    if (!MATURITIES.has(entry.maturity)) {
      errors.push(`${entry.key} has invalid maturity: ${String(entry.maturity)}`);
    }
    if (typeof entry.scope !== "string" || entry.scope.trim() === "") {
      errors.push(`${entry.key} requires a non-empty scope`);
    }
  }

  const stableEntries = entries.filter((entry) => entry?.maturity !== "stable");
  if (manifest?.stableAdmission === true && stableEntries.length > 0) {
    errors.push(
      `stable admission requires every entry to be stable: ${stableEntries.map((entry) => entry.key).join(", ")}`,
    );
  }

  return {
    valid: errors.length === 0,
    stableAdmission: manifest?.stableAdmission === true,
    errors,
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
