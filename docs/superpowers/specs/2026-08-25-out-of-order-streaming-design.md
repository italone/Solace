# Out-of-Order Streaming SSR Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-08-25
**Depends on:** `renderToStream()` sequential streaming (merged 2026-08-24)
**Sub-project:** 1 of 4 SSR capability gaps (out-of-order streaming → Suspense/selective hydration → renderer-owned router → production SSR pipeline)

## Goal

Let async components flush out of order during streaming SSR: the completed document prefix streams immediately, async boundaries render their fallback inline, and each boundary's real content replaces the fallback in the browser as soon as it resolves — without waiting for the rest of the tree and without rejecting the whole stream on boundary failure.

## API Surface

- `defineAsyncComponent(loader, { fallback? })` — optional `fallback: VNode | (() => VNode)`. The fallback participates only in out-of-order streaming; buffered rendering (`renderToStringAsync`) keeps awaiting the full tree and ignores `fallback`.
- `renderToStream(source, { mode?: "ordered" | "out-of-order" })` — default `"ordered"` preserves the current byte-for-byte contract. `"out-of-order"` enables placeholder replacement. Option validation follows the existing `assertStreamOptions` style: unknown or invalid `mode` values throw `TypeError` (surfaced as stream rejection, consistent with current behavior).

## Wire Protocol

Each out-of-order boundary emits:

```
<!--so:b:<id>>fallback content<!--/so:b:<id>>
```

immediately, followed by the rest of the document without blocking. When the component resolves, a replacement is emitted as an inline script:

```
<script>(boundary replacement code with embedded content)</script>
```

- IDs are monotonically increasing within one stream (`so-b-1`, `so-b-2`, …).
- Embedded content is JSON-escaped with `</script>` sequences neutralized.
- Boundaries without `fallback` emit an empty placeholder (two adjacent comments).
- A failed boundary load keeps the fallback (if provided), emits a closing marker carrying the error message, and does **not** reject the stream. This differs deliberately from ordered mode, where a failed async component rejects the whole stream; the difference is documented in `docs/api.md`.
- Replacement scripts locate their boundary comments via the id, replace the enclosed range with the parsed real content, and remove the markers.

## Traversal Scheduling

- In `out-of-order` mode, `streamVNode`/`streamComponent` do not await async component metadata: they synchronously yield the placeholder segment and register the loader in a pending set.
- After the main traversal completes, pending loaders run concurrently and each replacement script is emitted as soon as its boundary resolves (**resolution order**, via a race loop over the pending set); the stream closes after the last one settles (resolved or failed).
- Styles registered inside a boundary's subtree are emitted inline with the replacement content, preserving `ServerStyleSink` dedupe semantics (a style already flushed with the prefix is not re-emitted in the replacement).

## Hydration Compatibility

- Replacement scripts execute during streaming, so by the time client code runs, the DOM is already in its final shape; the existing `hydrateAsync` (prepare-then-match) works unchanged.
- Boundary comment markers must be skipped by the renderer's hydration/diff path (current diff already ignores non-VNode nodes; tests lock this).
- Integration test: out-of-order stream → load into jsdom, execute scripts → `hydrateAsync` succeeds and post-hydration interaction works.

## Testing And Gates

- Unit: option validation; placeholder protocol byte shape; resolution-order flushing; failure boundary (fallback retained, stream not rejected); empty fallback; style inlining and dedupe across prefix and replacement; non-boundary bytes identical to ordered mode when all boundaries resolve before first flush.
- Integration: out-of-order stream + hydration round-trip; package-exports contract updated for the new option and `fallback`.
- Docs: `docs/api.md` + `docs/api.zh-CN.md` (mode option, fallback, failure semantics, hydration notes), `docs/project-status.md`(.zh-CN) Known Gaps update, `docs/roadmap.md`, README boundary sentences (en/zh); docs-contract tests updated to match.

## Non-Goals

- Suspense and selective (event-driven) hydration — sub-project 2.
- Consumer backpressure — keeps the already-documented `renderToStream` deviation.
- Out-of-order behavior in SSG — SSG stays buffered.
- Out-of-order mode in `renderToString`/`renderToStringAsync` — buffered APIs unchanged.
