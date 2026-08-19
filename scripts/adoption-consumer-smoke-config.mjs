const EXACT_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parseAdoptionSmokeArguments(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  let browsers = false;
  let packageSpec;

  while (args.length > 0) {
    const option = args.shift();
    if (option === "--browsers" && !browsers) {
      browsers = true;
      continue;
    }
    if (option === "--package" && packageSpec === undefined) {
      const value = args.shift();
      if (value !== undefined && EXACT_VERSION.test(value)) {
        packageSpec = value;
        continue;
      }
    }
    throw usageError();
  }

  return { browsers, packageSpec };
}

export function createAdoptionConsumerPackageJson(packageSpec) {
  return {
    private: true,
    type: "module",
    dependencies: { "@italone/solace": packageSpec },
  };
}

export function withAdoptionFailureStage(stage, error) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`adoption ${stage} failed: ${message}`, { cause: error });
}

function usageError() {
  return new Error(
    "adoption smoke usage failed\nUsage: node scripts/adoption-consumer-smoke.mjs [--package <exact-version>] [--browsers]",
  );
}
