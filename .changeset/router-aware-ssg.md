---
"@italone/solace": minor
---

Add router-aware SSG: `generateStaticSiteAsync()` async route entries accept an optional `router` option (`{ routes, identifyRecord, configure? }`, with the route's `path` used as the url). Router-backed routes settle a request-scoped memory router, inject its server context `provides`, and append the serialized route snapshot script to the rendered body for verify-before-hydration pairing with `hydrateAsync(container, { router, routerIdentifyRecord })`. The synchronous `generateStaticSite()` still rejects route-level `router` fields.
