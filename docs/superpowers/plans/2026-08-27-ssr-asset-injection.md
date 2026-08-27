# SSR Production Asset Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deferred `manifest`/`clientEntry` TypeErrors on `renderToString`/`renderToStringAsync`/`renderToStream` with real asset-tag injection reusing the SSG `resolveStaticAssets` contract.

**Architecture:** A new `src/server/ssr-assets.ts` module validates the option pair (both-or-neither) and renders the tag string (`modulepreloads → stylesheets → entry script`). All three SSR renderers call it and append the tags to the html tail, ordered `content → asset tags → router snapshot script`; the stream path enqueues at the same tail point (after boundary flush, before close).

**Tech Stack:** TypeScript, Vitest (jsdom), existing package-exports and docs-contract gates.

**Spec:** `docs/superpowers/specs/2026-08-27-ssr-asset-injection-design.md`

---

## File Map

- `src/server/ssr-assets.ts` (new): `SSRAssetOptions` types helper, `assertSSRAssetOptions(options)` (XOR check), `buildSSRAssetTags(manifest, clientEntry): string`.
- `src/server/render-to-string.ts`: `manifest`/`clientEntry` on `RenderToStringOptions` (shared by sync + async), validation update in `assertBaseSSROptions` (drop the deferred throw), tag append in both render bodies (before snapshot script).
- `src/server/render-to-stream.ts`: same options on `RenderToStreamOptions`, validation update in `assertStreamOptions`, tail enqueue before the snapshot script.
- `src/server/index.ts`: no new exports needed (options are inline fields, not new types) — verify against package-exports test.
- `tests/unit/server/ssr-assets.test.ts` (new), `tests/unit/server/render-to-string-assets.test.ts` (new, covers sync + async), `tests/unit/server/render-to-stream-assets.test.ts` (new).
- `tests/integration/package-exports.test.ts` (modify: lines ~369-380 deferred-manifest assertions → new behavior), `tests/integration/ssr-asset-injection.test.ts` (new: router + manifest round-trip).
- Docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`, `docs/package-usage.md`.

Adaptation note for executors: tests import from relative paths (`../../../src`, `../../../src/server`); option-validation failures are asserted synchronously (`expect(() => ...).toThrow`) where the API is synchronous, `rejects.toThrow` for `renderToStringAsync`. Mirror `tests/unit/server/router-ssr.test.ts` and `tests/unit/server/render-to-stream-router.test.ts` conventions (both exist and cover the analogous router option). Real code landmarks: deferred manifest throw at `src/server/render-to-string.ts:264-268` (`assertBaseSSROptions`) and `src/server/render-to-stream.ts:438-441`; async body `src/server/render-to-string.ts:66-86`; stream tail `src/server/render-to-stream.ts:140-155`.

### Task 1: `ssr-assets.ts` — option validation and tag builder

**Files:**

- Create: `src/server/ssr-assets.ts`
- Test: `tests/unit/server/ssr-assets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { assertSSRAssetOptions, buildSSRAssetTags } from "../../../src/server/ssr-assets";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
  "src/shared.ts": { file: "assets/shared.js", imports: undefined },
};
const manifestWithImports = {
  "src/main.ts": { file: "assets/main.js", imports: ["src/shared.ts"] },
  "src/shared.ts": { file: "assets/shared.js" },
};

describe("assertSSRAssetOptions", () => {
  it("accepts both options together", () => {
    expect(() => assertSSRAssetOptions({ manifest, clientEntry: "src/main.ts" })).not.toThrow();
  });

  it("accepts both absent", () => {
    expect(() => assertSSRAssetOptions({})).not.toThrow();
  });

  it("rejects manifest without clientEntry and vice versa", () => {
    expect(() => assertSSRAssetOptions({ manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
    expect(() => assertSSRAssetOptions({ clientEntry: "src/main.ts" } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });
});

describe("buildSSRAssetTags", () => {
  it("renders modulepreloads, stylesheets, then the entry module script", () => {
    const tags = buildSSRAssetTags(manifestWithImports, "src/main.ts");
    expect(tags).toBe(
      '<link rel="modulepreload" href="/assets/shared.js">' +
        '<link rel="stylesheet" href="/assets/main.css">' +
        '<script type="module" src="/assets/main.js"></script>',
    );
  });

  it("propagates resolveStaticAssets validation errors", () => {
    expect(() => buildSSRAssetTags(manifest, "src/missing.ts")).toThrow(
      "Static asset manifest entry not found: src/missing.ts",
    );
  });
});
```

Note: the exact tag order inside `resolveStaticAssets` output is `modulePreloads, stylesheets, scripts` — the builder concatenates in that order with no separators. If the expected string fails, print the actual output and adjust only the test's fixture expectations, never the ordering contract. Default base is `/`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/unit/server/ssr-assets.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/ssr-assets.ts`**

```ts
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
```

Shape validation of `manifest` itself is delegated to `resolveStaticAssets` (existing messages propagate — asserted in Step 1). Do not duplicate it.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/unit/server/ssr-assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/ssr-assets.ts tests/unit/server/ssr-assets.test.ts
git commit -m "feat: add SSR asset option validation and tag builder"
```

---

### Task 2: `manifest`/`clientEntry` on `renderToString` + `renderToStringAsync`

**Files:**

- Modify: `src/server/render-to-string.ts`
- Test: `tests/unit/server/render-to-string-assets.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToString, renderToStringAsync } from "../../../src/server";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
};

describe("renderToString asset options", () => {
  it("appends asset tags after the content", () => {
    const result = renderToString(() => h("p", null, "x"), {
      manifest,
      clientEntry: "src/main.ts",
    });
    expect(result.html).toContain("<p>x</p>");
    expect(result.html).toContain('<link rel="stylesheet" href="/assets/main.css">');
    expect(result.html).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(result.html.indexOf("<p>x</p>")).toBeLessThan(result.html.indexOf("assets/main.js"));
  });

  it("rejects manifest without clientEntry synchronously", () => {
    expect(() => renderToString(() => h("p", null, "x"), { manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });
});

describe("renderToStringAsync asset options", () => {
  it("appends asset tags before the router snapshot script", async () => {
    const routes = [{ path: "/", name: "home", component: () => h("p", null, "home") }];
    const result = await renderToStringAsync(() => h("div", null, "y"), {
      manifest,
      clientEntry: "src/main.ts",
      router: { url: "/", routes, identifyRecord: (r: { name?: string }) => r.name ?? "r" },
    });
    expect(result.html).toContain("y");
    expect(result.html).toContain("assets/main.js");
    expect(result.html).toContain("__solace-router-snapshot");
    expect(result.html.indexOf("assets/main.js")).toBeLessThan(
      result.html.indexOf("__solace-router-snapshot"),
    );
  });

  it("rejects clientEntry without manifest", () => {
    return expect(
      renderToStringAsync(() => h("p", null, "x"), { clientEntry: "src/main.ts" } as never),
    ).rejects.toThrow("SSR manifest and clientEntry must be provided together");
  });
});
```

Adaptation: check `RouteRecord` fixture shape against `tests/unit/server/render-to-stream-router.test.ts` and mirror it if types differ.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/unit/server/render-to-string-assets.test.ts`
Expected: FAIL — "SSR manifest integration is deferred".

- [ ] **Step 3: Implement in `src/server/render-to-string.ts`**

1. Add to `RenderToStringOptions` (inherited by the async interface):

```ts
export interface RenderToStringOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
  manifest?: StaticAssetManifest;
  clientEntry?: string;
}
```

Import `type StaticAssetManifest` from `./static-assets` and `assertSSRAssetOptions`, `buildSSRAssetTags` from `./ssr-assets`.

2. In `assertBaseSSROptions` (render-to-string.ts:264-268): replace the deferred manifest/clientEntry throw with `assertSSRAssetOptions(options);` — this covers both sync and async paths since both call `assertBaseSSROptions`.

3. Allowlist: sync `assertNoDeferredIntegrationOptions` (line 219-224) and async `assertAsyncSSROptions` (line 243-248) unknown-key filters must each add `"manifest"` and `"clientEntry"` to the allowed keys.

4. Sync `renderToString` body (line 55-64): after computing `html`, append tags:

```ts
const html = withStyleSink(sink, () => renderVNodeToString(vnode, null, options.provides ?? null));
const tail =
  options.manifest !== undefined && options.clientEntry !== undefined
    ? buildSSRAssetTags(options.manifest, options.clientEntry)
    : "";

return {
  html: html + tail,
  styles: sink.styles,
};
```

5. Async body (line 66-86): insert the tags BEFORE the snapshot append:

```ts
let html = renderPreparedVNodeToString(prepared.root);
if (options.manifest !== undefined && options.clientEntry !== undefined) {
  html += buildSSRAssetTags(options.manifest, options.clientEntry);
}
if (routerSSR !== null) {
  html += buildSnapshotScript(routerSSR.snapshot);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run --exclude '**/.claude/**' tests/unit/server`
Expected: PASS — note `tests/unit/server/render-to-string.test.ts` may pin the old deferred manifest message; if so update that assertion to the new XOR message (behavior change is the point of this task).

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-string.ts tests/unit/server/render-to-string-assets.test.ts
git commit -m "feat: inject production asset tags into buffered SSR output"
```

---

### Task 3: `manifest`/`clientEntry` on `renderToStream`

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-assets.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";

const manifest = {
  "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] },
};

describe("renderToStream asset options", () => {
  it("enqueues asset tags after content and before close", async () => {
    const streamed = await collectStream(
      renderToStream(() => h("p", null, "x"), { manifest, clientEntry: "src/main.ts" }),
    );
    expect(streamed).toContain("<p>x</p>");
    expect(streamed).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(streamed.indexOf("<p>x</p>")).toBeLessThan(streamed.indexOf("assets/main.js"));
  });

  it("emits asset tags before the router snapshot script", async () => {
    const routes = [{ path: "/", name: "home", component: () => h("p", null, "home") }];
    const streamed = await collectStream(
      renderToStream(() => h("div", null, "y"), {
        manifest,
        clientEntry: "src/main.ts",
        router: {
          url: "/",
          routes,
          identifyRecord: (r: { name?: string }) => r.name ?? "r",
        },
      }),
    );
    expect(streamed.indexOf("assets/main.js")).toBeLessThan(
      streamed.indexOf("__solace-router-snapshot"),
    );
  });

  it("rejects manifest without clientEntry synchronously", () => {
    expect(() => renderToStream(() => h("p", null, "x"), { manifest } as never)).toThrow(
      "SSR manifest and clientEntry must be provided together",
    );
  });

  it("composes with out-of-order mode", async () => {
    const streamed = await collectStream(
      renderToStream(() => h("p", null, "x"), {
        manifest,
        clientEntry: "src/main.ts",
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("assets/main.js");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — "SSR manifest integration is deferred".

- [ ] **Step 3: Implement in `src/server/render-to-stream.ts`**

1. `RenderToStreamOptions` (line 53) gains `manifest?: StaticAssetManifest; clientEntry?: string;` (import from `./static-assets` / `./ssr-assets`).
2. In `assertStreamOptions`: replace the deferred throw (lines 438-441) with `assertSSRAssetOptions(options);` and add `"manifest"`, `"clientEntry"` to the unknown-key allowlist (line 456-458).
3. In `start()`'s tail (lines 140-155), enqueue tags BEFORE the snapshot script:

```ts
if (options.manifest !== undefined && options.clientEntry !== undefined) {
  buffer += buildSSRAssetTags(options.manifest, options.clientEntry);
}
if (routerSSR !== null) {
  buffer += buildSnapshotScript(routerSSR.snapshot);
}
```

(Tag building is synchronous — no await needed; keeping it after the flush loop preserves the tail ordering contract.)

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run --exclude '**/.claude/**' tests/unit/server tests/integration`
Expected: package-exports deferred-manifest assertions (tests/integration/package-exports.test.ts:369-380) now FAIL — that is expected and is fixed in Task 4. All other tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts tests/unit/server/render-to-stream-assets.test.ts
git commit -m "feat: inject production asset tags into streaming SSR output"
```

---

### Task 4: Update boundary assertions + integration round-trip

**Files:**

- Modify: `tests/integration/package-exports.test.ts` (~lines 369-380)
- Test: `tests/integration/ssr-asset-injection.test.ts` (new)

- [ ] **Step 1: Update the boundary test**

The test "enforces SSR and SSG manifest/router boundaries from the server subpath" asserts `/SSR manifest integration is deferred/` for `renderToString(source, { manifest: {} })` and `{ clientEntry: ... }`. Since `{ manifest: {} }` alone now throws the XOR error ("SSR manifest and clientEntry must be provided together") and `{ clientEntry }` alone likewise, update both assertions to `/SSR manifest and clientEntry must be provided together/`. Keep the SSG and router-boundary assertions in that test untouched. If `{ manifest: {} }` passes validation (it is a valid empty manifest shape) with a `clientEntry`, the missing-entry error "Static asset manifest entry not found: ..." applies — assert whichever the option combination in the test actually produces.

- [ ] **Step 2: Write the integration round-trip**

Mirror fixtures from `tests/integration/router-owned-ssr.test.ts` (routes, identifyRecord, collectStream, client hydration setup). Cover: `renderToStream(App, { manifest, clientEntry, router: {...} })` → html contains asset tags in order before the snapshot script → client `hydrateAsync(container, { router, routerIdentifyRecord })` still verifies and removes the script (asset tags are inert sibling nodes the walk must already tolerate — if the walk rejects the extra `<script>`/`<link>` nodes, that is a real finding: report it and fix the hydration walk's extra-node tolerance only if the existing comment/link tolerance precedent (`skipComments`) extends naturally; otherwise keep asset tags outside the hydrated container in the test and document the constraint).

```ts
// tests/integration/ssr-asset-injection.test.ts
import { describe, expect, it } from "vitest";
// mirror imports from router-owned-ssr.test.ts

describe("SSR asset injection round-trip", () => {
  it("injects asset tags and hydrates the router app", async () => {
    const manifest = { "src/main.ts": { file: "assets/main.js", css: ["assets/main.css"] } };
    const streamed = await collectStream(
      renderToStream(App, {
        manifest,
        clientEntry: "src/main.ts",
        router: { url: "/user/7", routes, identifyRecord },
      }),
    );
    expect(streamed).toContain('<link rel="stylesheet" href="/assets/main.css">');
    expect(streamed).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(streamed.indexOf("assets/main.js")).toBeLessThan(
      streamed.indexOf("__solace-router-snapshot"),
    );

    // client: strip nothing — keep script; seed global like a browser; hydrate
    // (mirror router-owned-ssr.test.ts client block exactly)
    // assert: route content hydrated, snapshot script removed.
  });
});
```

- [ ] **Step 3: Run**

Run: `pnpm exec vitest run --exclude '**/.claude/**' tests/integration`
Expected: PASS. Debug the implementation, never weaken assertions.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/package-exports.test.ts tests/integration/ssr-asset-injection.test.ts
git commit -m "test: cover SSR asset injection boundaries and round-trip"
```

---

### Task 5: Documentation and docs-contract gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`

- [ ] **Step 1:** Add an asset-injection section to `docs/api.md`/`.zh-CN.md` next to the renderer-owned router section: `manifest` + `clientEntry` options on all three SSR renderers (both-or-neither TypeError, tag order modulepreload → stylesheet → entry script, buffered append order content → tags → snapshot script, stream tail ordering, composition with `router` and `mode: "out-of-order"`, validation delegated to `resolveStaticAssets`, manifest is StaticAssetManifest from SSG, SSG unchanged, no build tooling — non-goal).
- [ ] **Step 2:** Update project-status (en+zh) — production pipeline automation row no longer fully deferred (runtime asset injection supported; build CLI still out of scope); roadmap removes the satisfied deferral remainder; readme (en+zh) deferral sentences updated; package-usage gains a manifest snippet.
- [ ] **Step 3:** Run `pnpm exec vitest run --exclude '**/.claude/**' tests/unit/docs` — PASS (satisfy exact expected strings on failure).

- [ ] **Step 4: Commit**

```bash
git add docs readme.md readme.zh-CN.md
git commit -m "docs: document SSR production asset injection"
```

---

### Task 6: Full quality gate

- [ ] **Step 1:** Run `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm exec vitest run --exclude '**/.claude/**'` — all PASS.
- [ ] **Step 2:** Fix drift with `pnpm format` and targeted edits; re-run.
- [ ] **Step 3:** Run `pnpm build && pnpm test:package && pnpm package:smoke` — PASS.
- [ ] **Step 4:** Final commit if fixes were needed:

```bash
git add -A && git commit -m "chore: format and lint SSR asset injection slice"
```

---

## Self-Review Notes

- Spec coverage: option XOR validation (Tasks 1-3), tag generation via resolveStaticAssets with existing escaping (Task 1), buffered append ordering incl. router composition (Task 2), stream tail ordering + out-of-order composition (Tasks 3-4), boundary-assertion migration + round-trip (Task 4), docs/gates (Tasks 5-6), SSG unchanged + no build tooling (explicit non-edits).
- Known resolution point for executors: whether the hydration walk tolerates sibling `<link>`/`<script>` asset nodes inside the hydrated container (Task 4) — verify empirically; the tags are inert and the walk already tolerates comments, but extra element nodes may need the test to keep tags outside the container (documented constraint, not a spec change).
- Default-path regression: every existing suite must stay green after each task except the two pinned deferred-manifest assertions explicitly migrated in Task 4.
