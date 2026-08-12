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
