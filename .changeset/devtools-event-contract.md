---
"@italone/solace": minor
---

Extend the DevTools event contract (version 1, additive): new `router:navigation` events (start/success/redirect/error/cancelled with fullPath summaries), `scheduler:flush` gains `skippedStaleJobs` and `distinctCauses`, `reactivity:trigger` gains `correlationId`, and `component:update` optionally carries the matching id so triggers can be linked to the updates they caused. `DEVTOOLS_CONTRACT_VERSION` is exported from `@italone/solace/devtools`, and the example DevTools panel gains the router family, correlation display, and a versioned panel handshake (`contractVersion`).
