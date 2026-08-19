export type AdoptionEvidencePhase = "baseline" | "candidate" | "rollback";
export type AdoptionEvidenceArguments = { records: string[]; output: string };
export type ValidationResult = { valid: boolean; errors: string[] };
export type AdoptionEvidenceApplication = {
  name: string;
  independent: true;
  primaryRenderer: "solace";
  repository: string;
  productionOrigin: string;
};
export type AdoptionEvidenceBundle = {
  schemaVersion: 1;
  application: AdoptionEvidenceApplication;
  repository: Record<string, unknown>;
  productionOrigin: string;
  phases: AdoptionEvidencePhase[];
  records: Array<Record<string, unknown>>;
  verified: boolean;
  bundleSha256: string;
};

export declare function parseAdoptionEvidenceArguments(
  rawArgs: string[],
): AdoptionEvidenceArguments;
export declare function validatePhaseRecord(record: unknown): ValidationResult;
export declare function createEvidenceBundle(records: unknown[]): AdoptionEvidenceBundle;
export declare function serializeEvidenceBundle(bundle: AdoptionEvidenceBundle): string;
export declare function sha256Json(value: unknown): string;
