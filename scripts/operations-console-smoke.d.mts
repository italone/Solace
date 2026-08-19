export function createPnpmSpawnOptions(
  cwd: string,
  platform?: NodeJS.Platform,
): {
  cwd: string;
  stdio: "inherit";
  shell: boolean;
};
export function discoverBrowserEntry(indexHtml: string, browserDir: string): string;

export declare function createConsumerPackageJson(packageSpec: string): {
  private: true;
  type: "module";
  dependencies: {
    "@italone/solace": string;
  };
};

export declare function createConsumerTsconfig(includeAsync: boolean): {
  compilerOptions: {
    strict: true;
    target: "ES2020";
    module: "ESNext";
    moduleResolution: "Bundler";
    jsx: "react-jsx";
    jsxImportSource: "@italone/solace";
    lib: ["ES2020", "DOM"];
    skipLibCheck: true;
    noEmit: true;
  };
  include: ["src"];
  exclude: string[];
};

export declare function parseSmokeArguments(args: string[]): {
  baselines: ("0.1.0-beta.2" | "0.1.0-beta.4")[];
};

export declare function baselineSupportsAsyncRendering(baseline: string): boolean;
