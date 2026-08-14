export declare function parseAdoptionSmokeArguments(args: string[]): {
  browsers: boolean;
  packageSpec: string | undefined;
};

export declare function createAdoptionConsumerPackageJson(packageSpec: string): {
  private: true;
  type: "module";
  dependencies: { "@italone/solace": string };
};

export declare function withAdoptionFailureStage(stage: string, error: unknown): Error;
