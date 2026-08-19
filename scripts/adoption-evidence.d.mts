import type {
  AdoptionEvidenceArguments,
  AdoptionEvidenceBundle,
} from "./adoption-evidence-config.mjs";

export declare function runAdoptionEvidence(
  options: AdoptionEvidenceArguments,
  context?: { root?: string },
): Promise<{ outputPath: string; bundle: AdoptionEvidenceBundle }>;
