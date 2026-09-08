---
"@italone/solace": patch
---

Keep the out-of-order SSR stream open when a successfully loaded boundary subtree fails to render: the boundary now keeps its fallback and emits a failure comment (same semantics as loader rejections) instead of erroring the whole stream after partial HTML.
