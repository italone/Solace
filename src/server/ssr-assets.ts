import { resolveStaticAssets, type StaticAssetManifest } from "./static-assets";

export interface SSRAssetOptionPair {
  manifest?: StaticAssetManifest;
  clientEntry?: string;
}

export function assertSSRAssetOptions(options: SSRAssetOptionPair): void {
  const hasManifest = options.manifest !== undefined;
  const hasClientEntry = options.clientEntry !== undefined;
  if (hasManifest !== hasClientEntry) {
    throw new TypeError("SSR manifest and clientEntry must be provided together");
  }
}

export function buildSSRAssetTags(manifest: StaticAssetManifest, clientEntry: string): string {
  const tags = resolveStaticAssets({ manifest, entry: clientEntry });
  return [...tags.modulePreloads, ...tags.stylesheets, ...tags.scripts].join("");
}
