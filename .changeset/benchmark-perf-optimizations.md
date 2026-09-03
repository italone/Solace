---
"@italone/solace": patch
---

Performance: reduce hot-path allocations — `flattenChildren` returns the original array when children are already flat, `trigger()` snapshots dependencies as a plain array instead of copying into a new `Set` per trigger, keyed-diff key maps are built only when new children carry keys, and the scheduler allocates its devtools cause set lazily. The unmount delete path was profiled and confirmed DOM-bound; the existing batched `DocumentFragment` removal is already optimal and no change was needed. No public API changes.
