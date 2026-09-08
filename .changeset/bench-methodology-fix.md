---
"@italone/solace": patch
---

Fix component-update benchmark methodology: hoist reactive setup and mount out of the timed task, add warmup iterations, and move assertions after measurement so the recorded numbers reflect the batched update flush instead of mount plus JIT warmup.
