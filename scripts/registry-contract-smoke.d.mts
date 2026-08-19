export interface RegistrySmokeResult {
  checkedEntries: number;
  version: string;
}

export interface RegistrySmokeRunOptions {
  exactVersion?: string;
  temporaryRoot?: string;
  install?: (workspace: string, packageJsonPath: string) => Promise<void>;
  executeProbe?: (probePath: string) => Promise<RegistrySmokeResult>;
  log?: (message: string) => void;
}

export declare function runRegistryContractSmoke(
  target: string,
  options?: RegistrySmokeRunOptions,
): Promise<RegistrySmokeResult>;

export type RegistrySmokeOptions =
  { help: true } | { target: string; exactVersion: string | undefined };

export declare function parseRegistrySmokeArguments(args: string[]): RegistrySmokeOptions;

export declare function createRegistryConsumerPackageJson(target: string): {
  private: true;
  type: "module";
  dependencies: {
    "@italone/solace": string;
  };
};

export declare function createRegistryInstallArguments(): ["install", "--ignore-scripts"];

export declare function createRegistryProbeSource(exactVersion: string | undefined): string;
