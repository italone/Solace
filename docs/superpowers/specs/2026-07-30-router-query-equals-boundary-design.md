# Router Query Equals Boundary Design

## Goal

Stabilize the beta router query parser for query values that contain `=`. The fix should preserve
all existing query behavior while making `parseQuery("?q=a=b")` return `{ q: "a=b" }` instead of
dropping everything after the second segment.

## Context

The current router beta slice already supports query parsing and stringifying through
`src/router/query.ts`. The previous stabilization pass documented these query rules:

- Repeated keys become string arrays.
- Bare keys become empty strings.
- `+` remains a literal plus sign.
- Nullish object-location values are skipped by stringification.
- Malformed percent encoding throws a stable `TypeError`.

`parseQuery()` currently uses array destructuring over `part.split("=")`. That treats all `=` signs
as separators and keeps only the first value segment. This is too lossy for common query values such
as search expressions, redirect URLs, tokens, or encoded state strings that may contain `=`.

## Scope

This is a narrow query parser correction:

- Modify `src/router/query.ts`.
- Modify `tests/unit/router/query.test.ts`.
- Do not change `stringifyQuery()`.
- Do not change router matching, history adapters, `RouterLink`, `RouterView`, package exports, or
  public router types.
- Do not introduce guards, nested routes, redirects, named routes, memory history, auth, SSR, SSG, or
  hydration concepts.

## Behavior

`parseQuery()` should split each query part at the first `=` only:

- `?q=a=b` becomes `{ q: "a=b" }`.
- `?q=a=b&q=c=d` becomes `{ q: ["a=b", "c=d"] }`.
- `?=value` becomes `{ "": "value" }`.
- `?flag` remains `{ flag: "" }`.
- Encoded values containing `=` continue to decode normally, such as
  `?redirect=%2Fusers%2F1%3Ftab%3Da` becoming `{ redirect: "/users/1?tab=a" }`.
- `+` remains a literal plus sign.
- Malformed percent encoding still throws `TypeError("Router query contains malformed percent encoding")`.

This behavior is a parser precision fix, not a new query feature.

## Implementation Design

Add a small helper in `src/router/query.ts`:

- Input: one raw query part with no leading `?`.
- Output: `[rawKey, rawValue]`.
- If the part contains no `=`, return `[part, ""]`.
- If the part contains `=`, return the substring before the first `=` as key and the substring after
  the first `=` as value.

`parseQuery()` should call this helper before decoding. Existing repeated-key accumulation and
malformed percent handling should remain unchanged.

## Testing

Add focused unit coverage in `tests/unit/router/query.test.ts`:

- Values containing literal `=` keep the full tail after the first separator.
- Repeated keys preserve values containing `=`.
- Empty keys are parsed intentionally.
- Encoded `=` values decode correctly.
- Existing bare-key, literal `+`, and malformed percent behavior remains covered by existing tests.

Validation:

- `pnpm vitest run tests/unit/router/query.test.ts`
- `pnpm vitest run tests/unit/router`

## Risks

- The main compatibility risk is changing behavior for consumers who accidentally depended on the
  lossy parser. Because preserving the full query value is the standard and less destructive behavior,
  the beta contract should move to the precise split now.
- Empty keys can look odd, but `URLSearchParams` allows them and the current parser already accepts
  decoded empty keys when the raw key is empty. The test should pin this intentionally.

## Acceptance Criteria

- `?q=a=b` preserves `a=b`.
- Repeated keys with `=` values become arrays without truncation.
- Empty-key and bare-key behavior are both explicit.
- Existing malformed percent and literal `+` behavior remains unchanged.
- Only query parser code, query unit tests, and this spec are changed for this slice.
