---
"@italone/solace": patch
---

Export `SolaceHydrationError` from the package root so client hydration recovery can match it with `instanceof` instead of `error.name`, and document that `reactive()` is a shallow proxy whose nested and array mutations require immutable replacement.
