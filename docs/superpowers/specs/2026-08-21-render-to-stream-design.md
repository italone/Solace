# renderToStream Design

Date: 2026-08-21
Status: Approved design, pending implementation plan

## Goal

Add streaming SSR to `@italone/solace/server` through a new `renderToStream()` API.
This closes the "streaming SSR" gap recorded in `docs/roadmap.md` and
`docs/project-status.md` without widening the contract toward Suspense, selective
hydration, out-of-order streaming, or renderer-owned router options.

## Non-Goals

- Suspense boundaries, placeholders, or selective hydration.
- Out-of-order streaming or tail-injection scripts.
- Async update scheduling after initial hydration.
- Direct renderer-owned router options.
- Changes to `renderToString`, `renderToStringAsync`, `generateStaticSite*`,
  `hydrate`, or `hydrateAsync` behavior or signatures.

## Public API

```ts
// @italone/solace/server
export function renderToStream(
  source: RenderToStringAsyncSource,
  options?: RenderToStreamOptions,
): ReadableStream<Uint8Array>;
```

- `RenderToStreamOptions` mirrors `RenderToStringOptions` (`context`, `provides`).
  Unknown own fields are rejected with a field-specific `TypeError`, matching the
  existing SSR/SSG option validation convention.
- The source is the existing `RenderToStringAsyncSource` union: VNode, component
  transport, factory function, async component, or promise-like of those.
- Return type is the Web-standard `ReadableStream<Uint8Array>` (UTF-8 encoded
  chunks). This keeps the runtime environment-agnostic: Node 18+, Deno, Bun, and
  browsers consume it natively; no `node:stream` dependency is introduced.

## Streaming Semantics

- **Ordered streaming.** The stream emits HTML in the same byte order as
  `renderToStringAsync().html`. When traversal reaches an async source, the
  already-rendered prefix is flushed (enqueued), the async source is awaited
  (via the existing `prepareAsyncSource` path), and traversal continues.
- **Style strategy: inline-at-first-encounter.** Instead of collecting styles
  into a result object for the consumer to place in `<head>`, streaming mode
  emits each collected `<style>` inline at the position where it is first
  encountered, with the existing hydration-safe dedupe protocol preserved.
  This is the single intentional difference from buffered output bytes.
- **Errors.** If source preparation or rendering throws (including async
  rejection), the stream calls `controller.error(cause)` after flushing nothing
  further; consumers see a rejected stream read.
- **No timing guarantees.** Chunk boundaries are implementation-defined;
  consumers must not parse partial chunks semantically.

## Implementation Approach

Refactor the string accumulation inside `src/server/render-to-string.ts` into a
writer-callback traversal:

- A `ServerHtmlWriter` interface (`write(chunk: string): void`) backed by either
  a string buffer (sync/buffered paths, unchanged behavior) or a stream enqueue
  target (new streaming path).
- The existing traversal function renders into the writer; `renderToString` and
  `renderToStringAsync` keep identical output.
- New module `src/server/render-to-stream.ts`:
  - validates options,
  - creates the stream lazily (`start` async pull),
  - on async boundaries enqueues the pending prefix, awaits
    `prepareAsyncSource`, and resumes,
  - collects styles through the existing sink, but redirects sink emission to an
    inline `<style>` write (deduped) in streaming mode.
- `src/server/index.ts` exports `renderToStream` and its option type. No root
  package export is added.

## Compatibility and Contract Gates

- `@italone/solace/server` subpath gains one function and one option interface;
  this is a beta-contract extension under `docs/compatibility.md`.
- Required gate updates before completion:
  - package exports test for the new symbol,
  - packed-consumer smoke exercising `renderToStream`,
  - public-contract docs test alignment (`docs/api.md`, `docs/package-usage.md`,
    `docs/project-status.md`, roadmap gap status),
  - release readiness evidence note.

## Testing

- **Unit** (`tests/unit/server/render-to-stream.test.ts`):
  - concatenated stream bytes equal `renderToStringAsync().html` after replacing
    the inline-style placement difference (compare with styles stripped from
    both, then compare style presence/ dedupe separately),
  - async source boundary: prefix chunk is emitted before the async component
    resolves (observable via chunk timing),
  - option validation rejects unknown fields with field-specific `TypeError`,
  - error propagation: rejected async source rejects the stream,
  - stream is not started until read (lazy `start`).
- **Integration**: streaming used inside the router-aware SSR composition
  (`router.isReady()` + `createRouterServerContext()`), asserting the final
  document still hydrates through `hydrateAsync()`.
- **Existing suites must stay green**; no behavior change to buffered APIs.

## Documentation Updates

- `docs/api.md` / `docs/api.zh-CN.md`: new section for `renderToStream`.
- `docs/package-usage.md`: server subpath usage snippet.
- `docs/project-status.md` / zh-CN: move streaming SSR from deferred to
  implemented (beta), keep the remaining SSR gaps listed.
- `docs/roadmap.md`: update the SSR next-phase item.
- README project-status paragraphs (en/zh) mention streaming availability.

## Risks

- Refactoring shared traversal could regress buffered output; mitigated by
  byte-equality tests between old and new buffered paths.
- Inline styles differ from buffered mode's head-collection contract; this is
  documented as intentional and covered by hydration integration tests.
- `ReadableStream` availability requires a modern runtime; package `engines`
  and docs will state Node >= 18 for the server subpath (already implied by
  ESM output).
