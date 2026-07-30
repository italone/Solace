import type { TransformResult } from "vite";

export function createSolaceTransformResult(code: string): TransformResult {
  return { code, map: null };
}
