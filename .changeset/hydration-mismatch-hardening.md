---
"@italone/solace": minor
---

Harden the hydration mismatch policy: hydration now detects attribute mismatches between client props and server HTML (one-directional comparison with structured `attribute-mismatch` errors carrying `attributeName`), and supports `hydrate(container, { textComparison: "normalized-collapsing" })` to tolerate foldable whitespace differences in text nodes (default remains exact comparison).
