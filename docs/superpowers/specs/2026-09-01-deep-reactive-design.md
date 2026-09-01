# Deep reactive() Design

Date: 2026-09-01
Status: approved (conversation, option C)

## Purpose

`reactive()` is currently a shallow proxy: nested plain objects and arrays are returned as-is,
so `state.items.push(...)` and `state.nested.count = 1` never trigger updates. readstack (the
first Solace-primary adoption app) hit this as a silent failure. This change makes `reactive()`
deep by default (Vue semantics) and adds `shallowReactive()` to preserve the current behavior
explicitly.

## Behavior

- `reactive(target)` wraps plain objects and arrays. On property **get**, a nested plain
  object/array value is lazily wrapped in a reactive proxy before being returned. On property
  **set**, an object/array value being assigned is wrapped eagerly.
- Proxy cache: a module-level `WeakMap<object, Proxy>` guarantees `state.nested ===
state.nested` across reads and `reactive(x) === reactive(x)`. This is a correctness
  requirement, not an optimization — duplicate proxies would break identity comparisons in
  effects and diffing.
- `reactive()` on an already-reactive proxy returns the same proxy (idempotent).
- Non-plain values (Date, RegExp, Map, class instances) are returned as-is — deep conversion
  targets plain objects and arrays only.
- `shallowReactive(target)` keeps the exact current behavior and is exported from the package
  root.
- Arrays: `push`/`pop`/`splice` on a deeply-wrapped array trigger length-key effects (track on
  `length` reads inside mutation paths must work through the proxy `set` trap; the existing
  `hasChanged` trigger on the mutated index plus `length` covers it — tests will pin the exact
  semantics).
- `ref(value)` is unchanged: `.value` assignment of an object wraps with deep `reactive()`
  only if it already does so today (it does not today; leave `ref` untouched in this change to
  bound scope).

## Contract impact

- Minor bump (beta line): `reactive()` semantics change from shallow to deep; `shallowReactive`
  is a new root export. Docs (`docs/api.md`, `docs/api.zh-CN.md`), the root API table, the
  package-exports integration test, and the public-contract docs test must be updated together.
- Store internals are verified to still pass unchanged; `createStore` state factories get deep
  proxies, which is a strict improvement for action ergonomics.
- readstack's immutable-replacement pattern remains correct under deep semantics.

## Testing

- Unit: nested object/array mutation triggers effects; proxy identity/cache; idempotence;
  non-plain values untouched; `shallowReactive` keeps shallow behavior; array mutation methods
  trigger; deep tracking through two levels.
- Integration: store with nested state renders on `push` without immutable replacement.
- Existing 940-test suite must stay green (no behavioral regressions in store/renderer paths).

## Out of scope

`ref()` deep conversion, `readonly()`, `shallowRef`, Map/Set collections, and reactive
effect-scope APIs.
