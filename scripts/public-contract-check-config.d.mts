export type PublicContractResult = {
  valid: boolean;
  stableAdmission: boolean;
  errors: string[];
};

export const FROZEN_PUBLIC_CONTRACT: Readonly<
  Record<string, Readonly<{ path: string; maturity: "stable" | "beta" | "experimental" }>>
>;

export function evaluatePublicContract(input: {
  packageJson: unknown;
  manifest: unknown;
}): PublicContractResult;
