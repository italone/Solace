---
"@italone/solace": patch
---

Add an opt-in `timeoutMs` option to `renderToStringAsync()`, `renderToStream()`, and `generateStaticSiteAsync()` (site-level with route-level override) so never-settling async renders reject with the new root-exported `SolaceTimeoutError` instead of hanging. Out-of-order stream boundaries time out individually: the fallback is kept and a failure comment is emitted while the stream stays open.
