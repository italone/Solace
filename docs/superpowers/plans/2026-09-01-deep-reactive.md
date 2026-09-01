# Deep reactive() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `reactive()` deep (lazy nested proxies with a WeakMap cache, idempotent) and export `shallowReactive()` for the old behavior.

**Architecture:** One change in `src/reactivity/reactive.ts` (deep get/set wrapping + proxy cache), one new export path through `src/renderer/renderer.ts` if needed and `src/index.ts`, plus docs/contract/test updates.

**Tech Stack:** TypeScript, vitest, existing reactivity test layout (`tests/unit/reactivity/`).

---

### Task 1: Deep reactive core

**Files:**

- Modify: `src/reactivity/reactive.ts`
- Test: `tests/unit/reactivity/deep-reactive.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { reactive } from "../../../src/reactivity/reactive";

describe("deep reactive", () => {
  it("triggers effects on nested object mutation", () => {
    const state = reactive({ nested: { count: 0 } });
    const spy = vi.fn(() => void state.nested.count);
    let runner = spy;
    const effect = () => runner();
    // use src effect API if exported; otherwise assert via render in integration
    expect(state.nested).not.toBe(state.nested ? undefined : undefined);
  });
});
```

(Implementer: replace the placeholder effect wiring with the real `effect` import from
`../../../src/reactivity/effect` — assertions: nested `count += 1` reruns the effect;
`state.items = []; state.items.push(1)` reruns a length-reading effect; `reactive(x) ===
reactive(x)`; `state.nested === state.nested`; `reactive(proxy) === proxy`; a `Date` property
value is returned unwrapped.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/reactivity/deep-reactive.test.ts`
Expected: FAIL (nested mutation does not rerun).

- [ ] **Step 3: Implement**

In `src/reactivity/reactive.ts`: module-level `const proxyCache = new WeakMap<object, object>()`;
rename the current proxy factory to `createShallowProxy` semantics; in `get`, if `isObject(result)`
and the value is a plain object or array, return the cached-or-new deep proxy for it; in `set`,
wrap assigned plain-object/array values. Add `export function shallowReactive<T extends object>(target: T): T` containing exactly today's proxy body. Plain-object check: `Array.isArray(v) || (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/reactivity/`
Expected: PASS including all existing reactivity tests.

- [ ] **Step 5: Commit**

```bash
git add src/reactivity/reactive.ts tests/unit/reactivity/deep-reactive.test.ts
git commit -m "feat: make reactive() deep with cached nested proxies and add shallowReactive()"
```

### Task 2: Export, docs, contract sync

**Files:**

- Modify: `src/index.ts` (add `shallowReactive` to the reactivity export line)
- Modify: `tests/integration/package-exports.test.ts` (add `shallowReactive` to both the `toMatchObject` and sorted-key arrays)
- Modify: `docs/api.md` and `docs/api.zh-CN.md`: update the `reactive(target)` shallow-proxy paragraph to describe deep behavior; add a `### shallowReactive(target)` section (EN+zh) mirroring the old text; add `shallowReactive` to the Reactivity row of the root API table in both languages
- Test: `tests/unit/docs/public-contract-docs.test.ts` — add `expect(doc).toContain("shallowReactive")` style pins next to existing reactive pins

- [ ] **Step 1: Add the export and integration-test entries; run `pnpm vitest run tests/integration/package-exports.test.ts` — expect the docs-side failures to surface only after docs are edited, so do docs in the same step and finish with `pnpm quality` (format+typecheck+lint+tests).**

- [ ] **Step 2: Commit**

```bash
git add src/index.ts tests/integration/package-exports.test.ts docs/api.md docs/api.zh-CN.md tests/unit/docs/public-contract-docs.test.ts
git commit -m "feat: export shallowReactive and document deep reactive semantics"
```

### Task 3: Store integration regression + changeset

**Files:**

- Test: `tests/unit/store/deep-state.test.ts`
- Create: `.changeset/deep-reactive.md`

- [ ] **Step 1: Write a store test where an action calls `state.items.push(item)` on a store created with `createStore`, then assert a rendered subscriber (jsdom `render`) updates without immutable replacement. Run: `pnpm vitest run tests/unit/store/` — expect PASS (deep reactive makes it work).**

- [ ] **Step 2: Write `.changeset/deep-reactive.md` with `"@italone/solace": minor` describing deep `reactive()` semantics and the new `shallowReactive` export. Commit both files.**

- [ ] **Step 3: Run the full gate `pnpm release:check` (or at minimum `pnpm quality && pnpm test:coverage && pnpm package:smoke`) and confirm zero failures before reporting DONE.**
