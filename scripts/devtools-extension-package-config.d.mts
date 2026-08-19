export interface DevtoolsPackageOptions {
  origins: string[];
  outputPath: string;
}

export interface ExtensionManifest {
  content_scripts: Array<{ matches: string[]; [key: string]: unknown }>;
  host_permissions: string[];
  web_accessible_resources: Array<{ matches: string[]; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface ArchiveEntry {
  name: string;
  data: Uint8Array;
}

export interface DevtoolsArtifactEvidence {
  schemaVersion: 1;
  artifactPath: string;
  sha256: string;
  manifestSha256: string;
  origins: string[];
}

export declare function parseDevtoolsPackageArguments(args: string[]): DevtoolsPackageOptions;
export declare function parseConfiguredOrigins(value: string | undefined): string[] | undefined;
export declare function createExtensionManifest(
  baseManifest: Record<string, unknown>,
  origins: string[],
): ExtensionManifest;
export declare function createZipArchive(entries: ArchiveEntry[]): Buffer;
export declare function packageDevtoolsExtension(options: {
  root?: string;
  origins: string[];
  outputPath?: string;
  runBuild?: (context: {
    root: string;
    origins: string[];
    manifest: ExtensionManifest;
  }) => Promise<void>;
}): Promise<{
  outputPath: string;
  evidencePath: string;
  evidence: DevtoolsArtifactEvidence;
  origins: string[];
  entries: string[];
  sha256: string;
}>;
export declare function devtoolsPackageUsage(): string;
