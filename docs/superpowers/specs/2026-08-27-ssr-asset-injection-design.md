# SSR Production Asset Injection Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-08-27
**Depends on:** out-of-order streaming SSR (merged 2026-08-25), Suspense/selective hydration (merged 2026-08-26), renderer-owned router SSR (merged 2026-08-26), SSG static-asset contract (`src/server/static-assets.ts`, merged)
**Sub-project:** 4 of 4 SSR capability gaps (out-of-order streaming ✅ → Suspense/selective hydration ✅ → renderer-owned router ✅ → **production asset injection**)

## Goal

Replace the deferred `manifest`/`clientEntry` `TypeError`s on the SSR renderers with real runtime asset-tag injection: server-rendered HTML automatically carries the `<link rel="modulepreload">`, `<link rel="stylesheet">`, and entry `<script type="module">` tags derived from a `StaticAssetManifest`, so a production SSR app no longer needs app-local shell/adapter code to compose assets. Build tooling (CLI, bundler orchestration) is out of scope — the manifest is produced by the app's existing build (e.g. Vite) and handed to the renderer.

## API Surface

- **`renderToString(source, { manifest, clientEntry })`** (sync), **`renderToStringAsync(source, { manifest, clientEntry })`**, and **`renderToStream(source, { manifest, clientEntry })`** each accept:
  - `manifest: StaticAssetManifest` — the existing SSG manifest type (`Record<string, { file, css?, imports? }>`, `src/server/static-assets.ts`).
  - `clientEntry: string` — the manifest chunk id of the hydration entry script.
  - `manifest` and `clientEntry` must be provided together; providing exactly one throws `TypeError("SSR manifest and clientEntry must be provided together")`. Validation stays synchronous (before stream construction on the stream path), matching repo convention.
- Orthogonality: composes with the `router` option and with `mode: "out-of-order"`. No conflict with `provides` (manifest injection does not use provides). `manifest` + `router` together is valid and is the full production flow.
- Unchanged: `generateStaticSite` already supports its own manifest/clientEntry contract and keeps its current semantics; SSG router-awareness stays deferred.

## Tag Generation And Injection

- Tags come from the existing `resolveStaticAssets({ manifest, entry: clientEntry })` — no new tag builders, no new escaping rules (`escapeAttribute` already applied). Its existing validation errors (manifest shape, missing chunk id, base type) propagate unchanged.
- Output order inside the resolved tags: modulepreloads, then stylesheets, then the entry script (`StaticAssetTags` field order).
- Injection point, buffered paths (`renderToString`, `renderToStringAsync`): appended after the rendered content, ordered `content → asset tags → router snapshot script` (when the `router` option is also present). The snapshot script stays last so the entry script tag and the snapshot assignment appear in a stable, documented order.
- Injection point, stream path (`renderToStream`): enqueued after the boundary flush loop and before `controller.close()`, same ordering relative to the router snapshot script (`asset tags → snapshot script`). Composes with `mode: "out-of-order"` because it shares the tail-emission point with the snapshot script.

## Error Handling

- XOR violation (`manifest` without `clientEntry` or vice versa): sync `TypeError("SSR manifest and clientEntry must be provided together")`.
- Manifest/entry shape errors: thrown by `resolveStaticAssets` validation as today (sync on all paths, since tag resolution needs no awaits).
- Existing `tests/integration/package-exports.test.ts` assertions pinning the deferred messages ("SSR manifest integration is deferred...") are updated to assert the new behavior.

## Non-Goals

- No build CLI, bundler orchestration, or manifest generation — the app's build tool produces the manifest.
- No `<html>/<head>/<body>` document assembly (`renderDocument` stays out of scope; renderers emit fragments plus tail tags, as today).
- No changes to the SSG pipeline, DevTools, or package export map beyond updating pinned-assertion tests.
- No dynamic import-dependency discovery beyond what `StaticAssetManifest.imports` already encodes.

## Testing And Gates

- Unit: option XOR validation (sync throws on all three APIs); tag byte shape in buffered output (modulepreload/stylesheet/script present, correct order after content); stream output (tags after boundary flush, before close, correct order vs snapshot script); composition with `router` + out-of-order mode; `resolveStaticAssets` error propagation.
- Integration: manifest injection + router snapshot full round-trip (server html carries asset tags and snapshot; client hydrates).
- Docs: `docs/api.md` + `.zh-CN.md` (manifest/clientEntry options on all three SSR renderers, ordering, error semantics), `docs/project-status.md`(.zh-CN), `docs/roadmap.md` (remove "full pipeline automation" deferral remainder where satisfied), `readme.md`/`readme.zh-CN.md`, `docs/package-usage.md`; docs-contract tests updated to match.
- Full gate: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`, then `pnpm build && pnpm test:package && pnpm package:smoke`.
