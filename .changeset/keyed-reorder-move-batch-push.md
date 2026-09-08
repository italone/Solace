---
"@italone/solace": patch
---

Collect keyed reorder move batches with array push instead of unshift, removing the quadratic collection cost for full-list reversals. Shipped as a complexity fix only: the jsdom keyed-reorder scenario is DOM-bound (see docs/performance.md), so no same-session speedup is claimed.
