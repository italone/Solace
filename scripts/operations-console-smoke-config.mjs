const PINNED_BASELINE = "0.1.0-beta.2";

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
    return {};
  }

  if (args.length !== 2 || args[0] !== "--baseline") {
    throw new Error("Usage: node scripts/operations-console-smoke.mjs [--baseline 0.1.0-beta.2]");
  }

  if (args[1] !== PINNED_BASELINE) {
    throw new Error("Baseline must be 0.1.0-beta.2");
  }

  return { baseline: PINNED_BASELINE };
}
