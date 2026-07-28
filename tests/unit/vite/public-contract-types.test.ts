import { describe, expect, it } from "vitest";

import { solacePlugin } from "../../../src/vite";

solacePlugin();

function expectViteTypeErrors(): void {
  // @ts-expect-error Vite plugin options are not part of the public SFC contract
  solacePlugin({ customBlocks: true });
}

void expectViteTypeErrors;

describe("Vite public contract types", () => {
  it("keeps plugin options out of the SFC alpha contract", () => {
    expect(true).toBe(true);
  });
});
