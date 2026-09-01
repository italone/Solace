---
"@italone/solace": minor
---

Make `reactive()` deep: nested plain objects and arrays are lazily wrapped in identity-stable cached reactive proxies, so nested mutations trigger updates. The previous shallow behavior is preserved via the new `shallowReactive()` root export. Non-plain values (Date, RegExp, class instances) are returned as-is.
