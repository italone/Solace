const SUPPORTED_BASELINES = new Set(["0.1.0-beta.2", "0.1.0-beta.4"]);

export function createConsumerPackageJson(packageSpec) {
  return {
    private: true,
    type: "module",
    dependencies: {
      "@italone/solace": packageSpec,
    },
  };
}

export function createConsumerTsconfig(includeAsync) {
  return {
    compilerOptions: {
      strict: true,
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      jsxImportSource: "@italone/solace",
      lib: ["ES2020", "DOM"],
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["src"],
    exclude: includeAsync ? [] : ["src/entries/server-async.tsx"],
  };
}

export function parseSmokeArguments(args) {
  if (args.length === 0) {
    return { baselines: [] };
  }

  if (args.length % 2 !== 0) {
    throw usageError();
  }

  const baselines = [];
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== "--baseline" || args[index + 1] === undefined) {
      throw usageError();
    }

    const baseline = args[index + 1];
    if (!SUPPORTED_BASELINES.has(baseline)) {
      throw new Error("Baseline must be one of: 0.1.0-beta.2, 0.1.0-beta.4");
    }
    if (baselines.includes(baseline)) {
      throw new Error(`Baseline must not be repeated: ${baseline}`);
    }
    baselines.push(baseline);
  }

  return { baselines };
}

export function baselineSupportsAsyncRendering(baseline) {
  return baseline === "0.1.0-beta.4";
}

function usageError() {
  return new Error(
    "Usage: node scripts/operations-console-smoke.mjs [--baseline 0.1.0-beta.2] [--baseline 0.1.0-beta.4]",
  );
}
