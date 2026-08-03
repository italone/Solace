# RouterLink Href Contract Design

## Goal

Stabilize the existing `RouterLink` href contract so rendered anchors expose the same canonical
`fullPath` that `router.resolve(to)` returns.

## Scope

This design covers only the current `RouterLink` public component and the existing path-based beta
route location contract. It does not add route names, aliases, route props, external URL handling,
hash fragments, scroll behavior, memory history, or hash-history-specific `href` generation.

## Public Contract

`RouterLink` keeps its existing props:

```ts
interface RouterLinkProps extends VNodeProps {
  to: RouteLocationRaw;
  replace?: boolean;
}
```

For every supported `to` value, the rendered anchor's `href` attribute is the canonical
`router.resolve(to).fullPath`.

Supported examples:

- `to="/users/42///?tab=profile"` renders `href="/users/42?tab=profile"`.
- `to={{ path: "users/7///", query: { tab: "profile" } }}` renders
  `href="/users/7?tab=profile"`.
- Query arrays render as repeated keys, matching the router query stringifier.

Unsupported or deferred location forms stay rejected through the existing router location contract.
`RouterLink` does not silently ignore invalid `to` values.

## Rationale

The clickable navigation behavior is already covered by integration tests, but visible anchor
targets are also part of the user-facing contract. Users can copy links, inspect URLs, use browser
menus, or let the browser own modified clicks. The anchor must therefore display the same canonical
URL that programmatic navigation would use.

## Design

Keep the implementation simple: `RouterLink` computes `href` from `router.resolve(to).fullPath`.
This design primarily adds regression coverage and documentation for that contract. If tests reveal
a mismatch, the implementation should be corrected with the smallest local change in
`src/router/components.ts`.

Click handling remains unchanged:

- Primary unmodified clicks for the current browsing context use `router.push()` or
  `router.replace()`.
- Modified clicks, already-prevented clicks, non-`_self` targets, and `download` links remain
  browser-owned.

## Testing

Add integration tests in `tests/integration/router-component.test.ts` that mount `RouterLink` and
assert the rendered anchor `href` attribute for:

1. Canonical string locations with trailing slash normalization and query strings.
2. Object locations with relative paths and object query serialization.
3. Object locations with query arrays rendered as repeated keys.

The tests should use `getAttribute("href")` to assert the literal rendered attribute rather than the
absolute browser-resolved `HTMLAnchorElement.href` property.

## Documentation

Update English and Simplified Chinese API docs to state that `RouterLink` renders `href` from
`router.resolve(to).fullPath`. Update project status docs to record the href contract coverage
without changing the deferred Router feature list.
