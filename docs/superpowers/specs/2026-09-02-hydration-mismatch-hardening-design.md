# Hydration Mismatch Policy Hardening Design

Date: 2026-09-02
Status: approved (conversation)

## Purpose

Hydration currently compares only tag names, text, and node structure — attributes are never
diffed against server HTML, whitespace-only text differences throw, and `recover: true`
degrades to a full client re-render that silently discards buffered interactions in selective
mode. The roadmap lists mismatch-policy hardening as remaining work before widening the SSR
contract.

## Changes

### 1. Attribute mismatch detection (new kind `attribute-mismatch`)

In `hydrateElement`/`hydratePreparedElement` (src/renderer/hydration.ts), after the existing
tag check, compare vnode props against the server-rendered DOM node using a one-directional
client → server rule:

- Only props declared on the vnode are checked. Extra DOM attributes are ignored (browsers
  inject `type` on buttons, form defaults, etc.; bidirectional comparison would false-positive).
- Skipped props: event props (`isEventProp`), `key`, `ref`, `style` (owned by the style sink).
- Equality rules:
  - `undefined` / `null` / `false` ⇔ attribute absent.
  - `true` ⇔ attribute present (value-insensitive).
  - String ⇔ `getAttribute(name)` strict equality.
  - Form value props (`value`, `checked`) compare against the DOM property
    (`node.value`/`node.checked`), not the attribute.
- `className` maps to the `class` attribute.
- On mismatch, throw `SolaceHydrationError` with kind `"attribute-mismatch"`, plus
  `attributeName`, `expected`, `actual`, and the existing `path`.

### 2. `textComparison` option (default unchanged)

```ts
interface HydrationOptions {
  textComparison?: "exact" | "normalized-collapsing"; // default "exact"
}
```

`normalized-collapsing` collapses runs of whitespace to a single space and trims both sides
before the existing text equality check (covers SSR template newline/indent differences).
Applies to both the prepared and non-prepared text comparison sites. Unknown values throw the
existing field-specific `TypeError` (extend the hydration options validation in
src/renderer/renderer.ts).

### 3. Diagnostics and recovery hardening

- `SolaceHydrationError.message` is formatted as a stable one-line string containing kind,
  path, and expected/actual summaries. The structured fields (`kind`, `path`, `expected`,
  `actual`, plus `attributeName` where applicable) are unchanged in shape; only readability of
  `message` improves.
- Selective hydration + `recover: true` event replay: DROPPED after implementation
  investigation (2026-09-02). The buffer attach, mismatch walk, recover re-render, and replay
  check all run in one synchronous block inside `hydrateAsync`, so no interaction can enter the
  buffer before the recover branch runs; additionally the recover deopt clears the container,
  disconnecting every possible replay target. There is no reachable behavior change to make —
  recovery intentionally settles without replay.
- The full-deopt recovery strategy itself is unchanged.

## Testing

- Attribute mismatch: missing attribute, differing string value, boolean presence mismatch,
  `undefined`/`false` equivalent to absent, event props ignored, extra DOM attributes ignored,
  `className`↔`class`, form `value`/`checked` via DOM property, mismatch path accuracy.
- `textComparison`: default `exact` still throws on whitespace-only difference;
  `normalized-collapsing` accepts foldable whitespace, still throws on real text difference;
  invalid value rejects with `TypeError`.
- Structure: single extra/missing element inside a children list; text-node vs element
  substitution.
- Integration: mismatch inside a pending out-of-order boundary; mismatch after router snapshot
  verification (snapshot mismatch still wins); SSR shell with attribute mismatch and
  `recover: true`.
- Selective: recover-on-mismatch completes and the recovered DOM is client-correct (the
  previously planned buffered-event replay is unreachable; see Changes).

## Contract impact

Minor bump: new optional `HydrationOptions.textComparison`, new `SolaceHydrationError` kind
value `"attribute-mismatch"`, new optional `attributeName` field. Docs (`docs/api.md`,
`docs/api.zh-CN.md` hydration/SSR sections), roadmap note, and changeset updated together.

## Out of scope

Subtree-level partial patch recovery (keeps full deopt), whitespace-insensitive structural
comparison, attribute mismatch recovery other than existing `recover: true` deopt, and any
server-side rendering changes.
