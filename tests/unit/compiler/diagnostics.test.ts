import { describe, expect, it } from "vitest";

import { SolaceCompileError } from "../../../src/compiler";
import { formatSolaceCompileError } from "../../../src/compiler/diagnostics";

describe("compiler diagnostics", () => {
  it("formats compiler errors with filename and location", () => {
    const error = new SolaceCompileError({
      code: "SFC_PARSE_ERROR",
      message: "Unclosed interpolation expression",
      filename: "/app/src/Broken.solace",
      loc: { offset: 23, line: 1, column: 4 },
      cause: new SyntaxError("bad interpolation"),
    });

    expect(formatSolaceCompileError(error)).toBe(
      "[SFC_PARSE_ERROR] /app/src/Broken.solace:1:4 Unclosed interpolation expression",
    );
  });

  it("formats compiler errors without a filename", () => {
    const error = new SolaceCompileError({
      code: "SFC_MISSING_TEMPLATE",
      message: "Missing <template> block",
      cause: new Error("missing template"),
    });

    expect(formatSolaceCompileError(error)).toBe(
      "[SFC_MISSING_TEMPLATE] unknown Missing <template> block",
    );
  });
});
