const MATURITIES = new Set(["stable", "beta", "experimental"]);

export const FROZEN_PUBLIC_CONTRACT = Object.freeze({
  ".": { path: "@italone/solace", maturity: "stable" },
  "./devtools": {
    path: "@italone/solace/devtools",
    maturity: "beta",
    excludedFromStableBoundary: true,
  },
  "./jsx-dev-runtime": { path: "@italone/solace/jsx-dev-runtime", maturity: "stable" },
  "./jsx-runtime": { path: "@italone/solace/jsx-runtime", maturity: "stable" },
  "./package.json": { path: "@italone/solace/package.json", maturity: "stable" },
  "./server": { path: "@italone/solace/server", maturity: "stable" },
  "./sfc": {
    path: "@italone/solace/sfc",
    maturity: "experimental",
    excludedFromStableBoundary: true,
  },
  "./vite": {
    path: "@italone/solace/vite",
    maturity: "experimental",
    excludedFromStableBoundary: true,
  },
});

export function evaluatePublicContract({ packageJson, manifest }) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersion must be 1");
  if (!Array.isArray(manifest?.entries) || manifest.entries.length === 0) {
    errors.push("manifest entries must be a non-empty array");
  }

  const packageExports = isRecord(packageJson?.exports) ? Object.keys(packageJson.exports) : [];
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const manifestKeys = entries.map((entry) => entry?.key);
  const frozenKeys = Object.keys(FROZEN_PUBLIC_CONTRACT);
  const duplicateKeys = manifestKeys.filter(
    (key, index) => typeof key === "string" && manifestKeys.indexOf(key) !== index,
  );
  const missingPackageExports = frozenKeys.filter((key) => !packageExports.includes(key));
  const unexpectedPackageExports = packageExports.filter((key) => !frozenKeys.includes(key));
  const missing = packageExports.filter((key) => !manifestKeys.includes(key));
  const extra = manifestKeys.filter(
    (key) => typeof key === "string" && !packageExports.includes(key),
  );
  if (duplicateKeys.length > 0) {
    errors.push(`duplicate manifest entries: ${[...new Set(duplicateKeys)].join(", ")}`);
  }
  if (missingPackageExports.length > 0) {
    errors.push(`missing frozen package exports: ${missingPackageExports.join(", ")}`);
  }
  if (unexpectedPackageExports.length > 0) {
    errors.push(`package contains unfrozen exports: ${unexpectedPackageExports.join(", ")}`);
  }
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
    const frozenEntry = FROZEN_PUBLIC_CONTRACT[entry.key];
    if (!frozenEntry) {
      errors.push(`${entry.key} is not part of the frozen public contract`);
      continue;
    }
    if (entry.path !== frozenEntry.path) {
      errors.push(`${entry.key} path must remain ${frozenEntry.path}`);
    }
    if (entry.maturity !== frozenEntry.maturity) {
      errors.push(`${entry.key} maturity must remain ${frozenEntry.maturity}`);
    }
    const excluded = entry.excludedFromStableBoundary === true;
    if (excluded !== (frozenEntry.excludedFromStableBoundary === true)) {
      errors.push(
        `${entry.key} excludedFromStableBoundary must remain ${frozenEntry.excludedFromStableBoundary === true}`,
      );
    }
    if (excluded && entry.maturity === "stable") {
      errors.push(`${entry.key} cannot be stable and excluded from the stable boundary`);
    }
  }

  const unstableEntries = entries.filter(
    (entry) => entry?.maturity !== "stable" && entry?.excludedFromStableBoundary !== true,
  );
  if (manifest?.stableAdmission === true && unstableEntries.length > 0) {
    errors.push(
      `stable admission requires every entry to be stable or explicitly excluded from the stable boundary: ${unstableEntries.map((entry) => entry.key).join(", ")}`,
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
