import { escapeAttribute } from "../shared/html";

export type StaticAssetManifest = Record<string, StaticAssetManifestChunk>;

export interface StaticAssetManifestChunk {
  file: string;
  css?: readonly string[];
  imports?: readonly string[];
}

export interface StaticAssetTags {
  modulePreloads: string[];
  stylesheets: string[];
  scripts: string[];
}

export interface ResolveStaticAssetOptions {
  manifest: StaticAssetManifest;
  entry: string;
  base?: string;
}

export function resolveStaticAssets(options: ResolveStaticAssetOptions): StaticAssetTags {
  assertStaticAssetOptions(options);
  const base = normalizeAssetBase(options.base ?? "/");
  const orderedChunkIds: string[] = [];
  const visited = new Set<string>();

  visitManifestChunk(options.manifest, options.entry, visited, orderedChunkIds);

  const cssFiles: string[] = [];
  const seenCss = new Set<string>();

  for (const chunkId of orderedChunkIds) {
    const chunk = options.manifest[chunkId];
    for (const cssFile of chunk.css ?? []) {
      if (seenCss.has(cssFile)) {
        continue;
      }

      seenCss.add(cssFile);
      cssFiles.push(cssFile);
    }
  }

  const importedChunkIds = orderedChunkIds.filter((chunkId) => chunkId !== options.entry);
  const entryChunk = options.manifest[options.entry];

  return {
    modulePreloads: importedChunkIds.map((chunkId) =>
      renderModulePreloadTag(joinAssetBase(base, options.manifest[chunkId].file)),
    ),
    stylesheets: cssFiles.map((file) => renderStylesheetTag(joinAssetBase(base, file))),
    scripts: [renderModuleScriptTag(joinAssetBase(base, entryChunk.file))],
  };
}

function assertStaticAssetOptions(options: ResolveStaticAssetOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Static asset options must be an object");
  }

  if (options.base !== undefined && typeof options.base !== "string") {
    throw new TypeError("Static asset base must be a string");
  }

  if (
    options.manifest === null ||
    typeof options.manifest !== "object" ||
    Array.isArray(options.manifest)
  ) {
    throw new TypeError("Static asset manifest must be an object");
  }

  if (typeof options.entry !== "string") {
    throw new TypeError("Static asset entry must be a string");
  }
}

function visitManifestChunk(
  manifest: StaticAssetManifest,
  chunkId: string,
  visited: Set<string>,
  orderedChunkIds: string[],
): void {
  if (visited.has(chunkId)) {
    return;
  }

  const chunk = manifest[chunkId];
  if (chunk === undefined) {
    throw new TypeError(`Static asset manifest entry not found: ${chunkId}`);
  }
  assertStaticAssetManifestChunk(chunk);

  visited.add(chunkId);

  for (const importedChunkId of chunk.imports ?? []) {
    visitManifestChunk(manifest, importedChunkId, visited, orderedChunkIds);
  }

  orderedChunkIds.push(chunkId);
}

function assertStaticAssetManifestChunk(
  chunk: StaticAssetManifestChunk,
): asserts chunk is StaticAssetManifestChunk {
  if (chunk === null || typeof chunk !== "object" || Array.isArray(chunk)) {
    throw new TypeError("Static asset manifest chunk must be an object");
  }

  if (typeof chunk.file !== "string") {
    throw new TypeError("Static asset manifest chunk file must be a string");
  }

  if (chunk.css !== undefined && !Array.isArray(chunk.css)) {
    throw new TypeError("Static asset manifest chunk css must be an array");
  }

  for (const cssFile of chunk.css ?? []) {
    if (typeof cssFile !== "string") {
      throw new TypeError("Static asset manifest chunk css items must be strings");
    }
  }

  if (chunk.imports !== undefined && !Array.isArray(chunk.imports)) {
    throw new TypeError("Static asset manifest chunk imports must be an array");
  }
}

function normalizeAssetBase(base: string): string {
  const withoutTrailingSlashes = base.replace(/\/+$/, "");
  return withoutTrailingSlashes === "" ? "/" : `${withoutTrailingSlashes}/`;
}

function joinAssetBase(base: string, file: string): string {
  return `${base}${file.replace(/^\/+/, "")}`;
}

function renderModulePreloadTag(href: string): string {
  return `<link rel="modulepreload" href="${escapeAttribute(href)}">`;
}

function renderStylesheetTag(href: string): string {
  return `<link rel="stylesheet" href="${escapeAttribute(href)}">`;
}

function renderModuleScriptTag(src: string): string {
  return `<script type="module" src="${escapeAttribute(src)}"></script>`;
}
