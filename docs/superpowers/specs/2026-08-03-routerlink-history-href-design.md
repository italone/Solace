# RouterLink History Href Design

## Goal

Make `RouterLink` render browser-owned links that match the selected history adapter, so hash history
links expose `#/path` hrefs while web history links keep normal path hrefs.

## Scope

This design covers only `RouterLink` href formatting for the existing `createWebHistory()` and
`createWebHashHistory()` adapters. It does not add route names, aliases, external URL handling, hash
fragments, route props, scroll behavior, memory history, SSR integration, or new user-facing Router
methods.

## Public Contract

`RouterLink` continues to accept the same props and navigate the same way. The rendered anchor href
is derived from the canonical `router.resolve(to).fullPath`, then formatted by the installed history
adapter when that adapter provides a history-specific href formatter.

Expected behavior:

- With `createWebHistory()`, `to="/users/42?tab=profile"` renders `href="/users/42?tab=profile"`.
- With `createWebHashHistory()`, `to="/users/42?tab=profile"` renders
  `href="#/users/42?tab=profile"`.
- Custom history adapters without the internal formatter keep the existing fallback:
  `href=router.resolve(to).fullPath`.

Programmatic navigation remains unchanged. `RouterLink` still calls `router.push(to)` or
`router.replace(to)` for primary unmodified clicks, and leaves modified clicks, non-`_self` targets,
downloads, and already-prevented clicks to the browser.

## Internal Boundary

Do not add `href()` to the exported `RouterHistory` or `Router` types. Instead:

- Add an internal symbol-keyed history formatter interface used only inside `src/router`.
- `createWebHistory()` returns an adapter with an internal symbol-keyed formatter that normalizes to
  a path href.
- `createWebHashHistory()` returns an adapter with an internal symbol-keyed formatter that prefixes
  the normalized target with `#`.
- `createRouter()` exposes an internal symbol-keyed `href(to)` formatter that resolves `to` once and
  applies the history formatter if present.
- `RouterLink` uses the internal router href formatter when available and falls back to
  `router.resolve(to).fullPath`.

The symbol-keyed method keeps the public runtime object compatible while giving first-party
components access to adapter-specific href formatting.

## Testing

Add integration tests in `tests/integration/router-component.test.ts`:

1. A hash history `RouterLink` renders `#/users/42?tab=profile` for a string location.
2. A hash history `RouterLink` renders `#/users/7?tag=a&tag=b` for an object location with query
   array serialization.
3. Existing custom memory-like history links keep path hrefs through fallback behavior.

Use `getAttribute("href")` for literal anchor attributes.

## Documentation

Update English and Simplified Chinese API docs to state that `RouterLink` hrefs are based on
`router.resolve(to).fullPath` and formatted by the installed first-party history adapter, including
`#/` hrefs for `createWebHashHistory()`.

Update project status docs to record hash-history-aware `RouterLink` href coverage without changing
the deferred Router feature list.
