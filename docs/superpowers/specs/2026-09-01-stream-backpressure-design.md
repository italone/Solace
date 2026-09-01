# renderToStream Backpressure Design

Date: 2026-09-01
Status: approved (conversation)

## Problem

`renderToStream()` returns a `ReadableStream<Uint8Array>` but produces all chunks eagerly inside
`start()`: it never awaits `pull()`, so a slow consumer (or a paused stream) gets the entire
document buffered into the stream queue. Docs explicitly disclaim "eager start, no consumer
backpressure".

## Design

Honor the stream's built-in backpressure signal:

- Production moves to a loop that, before enqueuing when `controller.desiredSize <= 0`, awaits a
  one-shot "pulled" promise resolved from the stream's `pull()` callback.
- `start()` kicks off production without blocking stream construction; `cancel()` stops it via
  a cancelled flag (the existing error/cancel path is preserved).
- Semantics: with the default high water mark (1 chunk), a consumer that stops reading pauses
  production within one queued chunk; a consumer reading normally sees identical chunk order and
  content (byte-identical output is pinned by existing tests).
- No API change: same function signature, same return type. This is a behavioral fix, patch
  bump. Docs (`docs/api.md`, `docs/api.zh-CN.md`) drop the "no consumer backpressure" disclaimer
  and state that production pauses when the stream queue is full.

## Testing

- Unit (jsdom/node): create a stream, read exactly one chunk, then assert production has paused
  (a progress counter advanced by the source generator stops growing); after resuming reads,
  the stream completes with the full expected content.
- Existing byte-order and mode tests must stay green (backpressure must not reorder or merge
  chunks incorrectly).

## Out of scope

A `pull()`-driven (fully lazy, on-demand chunk) rewrite, `highWaterMark` options, and
per-chunk consumer callbacks.
