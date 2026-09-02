---
"@italone/solace": minor
---

Add synchronous-entry router support: `renderToString()` accepts a `router` option (`{ url, routes, identifyRecord, configure? }`) backed by a new synchronous router settlement fast path (`router.isReadySync()`) that requires synchronous guards (thenable guard results throw a `TypeError` pointing at the async entries), follows redirects synchronously, injects the router server context, and appends the same route snapshot script as the async path. `generateStaticSite()` accepts the same route-level `router` option as `generateStaticSiteAsync()`.
