export type PublicContractResult = {
  valid: boolean;
  stableAdmission: boolean;
  errors: string[];
};

export function evaluatePublicContract(input: {
  packageJson: unknown;
  manifest: unknown;
}): PublicContractResult;
