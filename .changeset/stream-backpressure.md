---
"@italone/solace": patch
---

Apply consumer backpressure in `renderToStream()`: chunk production parks when the `ReadableStream` queue is full and resumes on pull, instead of eagerly buffering the whole document. Byte order and chunk content are unchanged.
