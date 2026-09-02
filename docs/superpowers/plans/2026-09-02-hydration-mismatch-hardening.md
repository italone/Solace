# Hydration Mismatch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add attribute-mismatch detection, a `textComparison` hydration option, and selective-recover event replay to the hydration mismatch policy.

**Architecture:** All detection stays in `src/renderer/hydration.ts`. The `textComparison` mode rides the existing `HydrationContext` (already threaded through every hydration walk) instead of new function signatures. Attribute checks are one-directional (client props → DOM) and inserted after the existing tag checks. Selective recovery replay changes only `hydrateSelectively` in `src/renderer/renderer.ts`.

**Tech Stack:** TypeScript, vitest + happy-dom, existing Solace test conventions.

---

### Task 1: Attribute mismatch detection

**Files:**
- Modify: `src/renderer/hydration.ts`
- Test: `tests/unit/renderer/hydration-attributes.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { hydrate } from "../../../src/renderer/renderer";
import { SolaceHydrationError } from "../../../src/hydration-wrapper-or-source";

function containerWith(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

const expectMismatch = (container: Element, tree: ReturnType<typeof h>, attr: string) => {
  try {
    hydrate(tree, container);
    expect.unreachable("expected SolaceHydrationError");
  } catch (error) {
    expect(error).toBeInstanceOf(SolaceHydrationError);
    expect((error as SolaceHydrationError).kind).toBe("attribute-mismatch");
    expect((error as SolaceHydrationError).attributeName).toBe(attr);
  }
};

describe("hydration attribute mismatch", () => {
  it("throws on missing attribute", () => {
    const container = containerWith("<a></a>");
    expectMismatch(container, h("a", { href: "/x" }), "href");
  });

  it("throws on differing string value", () => {
    const container = containerWith('<a href="/y"></a>');
    expectMismatch(container, h("a", { href: "/x" }), "href");
  });

  it("throws when boolean prop present on client only", () => {
    const container = containerWith("<input>");
    expectMismatch(container, h("input", { disabled: true }), "disabled");
  });

  it("accepts undefined/false/null as absent", () => {
    const container = containerWith("<input>");
    hydrate(h("input", { disabled: false, title: undefined, alt: null }), container);
  });

  it("accepts true when attribute present with any value", () => {
    const container = containerWith("<input disabled>");
    hydrate(h("input", { disabled: true }), container);
  });

  it("accepts matching string attribute", () => {
    const container = containerWith('<a href="/x"></a>');
    hydrate(h("a", { href: "/x" }), container);
  });

  it("ignores extra DOM attributes", () => {
    const container = containerWith('<button type="submit"></button>');
    hydrate(h("button", null, "ok"), container);
  });

  it("ignores event props and key/ref/style", () => {
    const container = containerWith("<div></div>");
    hydrate(h("div", { onClick: () => {}, key: "k", ref: () => {}, style: "color:red" }), container);
  });

  it("maps className to the class attribute", () => {
    const container = containerWith('<p class="b"></p>');
    expectMismatch(container, h("p", { className: "a" }), "class");
  });

  it("compares form value and checked against DOM properties", () => {
    const checked = containerWith('<input type="checkbox" checked>');
    hydrate(h("input", { type: "checkbox", checked: true }), checked);
    const valued = containerWith('<input value="typed">');
    hydrate(h("input", { value: "typed" }), valued);
  });

  it("includes the element path in the error", () => {
    const container = containerWith("<div><a></a></div>");
    try {
      hydrate(h("div", null, h("a", { href: "/x" })), container);
      expect.unreachable();
    } catch (error) {
      expect((error as SolaceHydrationError).path).toContain("/div/a");
    }
  });
});
```

Note: import `SolaceHydrationError` from the actual public path — check `src/index.ts` exports it (it does, added in the deep-reactive batch) and import from `"../../../src"`. Adjust the import in the test above accordingly (`import { h, SolaceHydrationError } from "../../../src";`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/renderer/hydration-attributes.test.ts`
Expected: FAIL — no attribute mismatch thrown (hydrate succeeds where mismatch expected).

- [ ] **Step 3: Implement**

In `src/renderer/hydration.ts`:

1. Extend the kind union: `"attribute-mismatch"`.
2. Extend `HydrationMismatchDetails` and `SolaceHydrationError` with optional `attributeName?: string` (assign in constructor when present).
3. Add helper:

```ts
const FORM_VALUE_PROPS = new Set(["value", "checked"]);

function assertHydrationAttributes(el: Element, props: VNodeProps | null, path: string): void {
  if (props === null) return;
  for (const [key, value] of Object.entries(props)) {
    if (key === "key" || key === "ref" || key === "style" || isEventProp(key)) continue;
    const attribute = key === "className" ? "class" : key;

    if (value === undefined || value === null || value === false) {
      if (el.getAttribute(attribute) !== null) {
        throwAttributeMismatch(path, el, attribute, String(value), el.getAttribute(attribute) ?? "");
      }
      continue;
    }

    if (value === true) {
      if (el.getAttribute(attribute) === null) {
        throwAttributeMismatch(path, el, attribute, "true", "absent");
      }
      continue;
    }

    if (FORM_VALUE_PROPS.has(attribute)) {
      const domValue = (el as unknown as Record<string, unknown>)[attribute];
      if (String(domValue) !== String(value)) {
        throwAttributeMismatch(path, el, attribute, String(value), String(domValue));
      }
      continue;
    }

    const actual = el.getAttribute(attribute);
    if (actual !== String(value)) {
      throwAttributeMismatch(path, el, attribute, String(value), actual ?? "absent");
    }
  }
}

function throwAttributeMismatch(
  path: string,
  el: Element,
  attribute: string,
  expected: string,
  actual: string,
): never {
  throwHydrationMismatch({
    kind: "attribute-mismatch",
    path: `${path}/${el.tagName.toLowerCase()}`,
    attributeName: attribute,
    expected: `attribute "${attribute}" = "${expected}"`,
    actual: `attribute "${attribute}" = "${actual}"`,
    message: `Hydration mismatch at path ${path}/${el.tagName.toLowerCase()}: expected attribute "${attribute}" = "${expected}" but found "${actual}"`,
  });
}
```

4. Call `assertHydrationAttributes(node, vnode.props, path)` immediately after the tag check in both `hydratePreparedElement` (after line 140 throw block) and `hydrateElement` (after line 271 throw block).

- [ ] **Step 4: Run new tests + full hydration suite**

Run: `pnpm vitest run tests/unit/renderer/hydration-attributes.test.ts tests/unit/renderer/hydration.test.ts`
Expected: PASS all. If existing SSR/hydration integration tests now fail on attribute mismatches, inspect each failure: it is a genuine detection (fix the test fixture to match) — do not weaken the comparison rules.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hydration.ts tests/unit/renderer/hydration-attributes.test.ts
git commit -m "feat: detect hydration attribute mismatches"
```

### Task 2: `textComparison` option

**Files:**
- Modify: `src/renderer/hydration.ts` (HydrationContext + two text compare sites)
- Modify: `src/renderer/renderer.ts` (HydrationOptions, validation, context construction)
- Test: `tests/unit/renderer/hydration-text-comparison.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { hydrate } from "../../../src/renderer/renderer";

function containerWith(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe("hydration textComparison option", () => {
  it("defaults to exact and throws on whitespace-only difference", () => {
    const container = containerWith("<p>hello  world</p>");
    expect(() => hydrate(h("p", null, "hello world"), container)).toThrow();
  });

  it("normalized-collapsing accepts foldable whitespace", () => {
    const container = containerWith("<p>hello   world</p>");
    hydrate(h("p", null, "hello world"), container, null, { textComparison: "normalized-collapsing" });
  });

  it("normalized-collapsing trims outer whitespace", () => {
    const container = containerWith("<p>\n  hello world\n</p>");
    hydrate(h("p", null, "hello world"), container, null, { textComparison: "normalized-collapsing" });
  });

  it("normalized-collapsing still throws on real text difference", () => {
    const container = containerWith("<p>hello world</p>");
    expect(() =>
      hydrate(h("p", null, "hello there"), container, null, { textComparison: "normalized-collapsing" }),
    ).toThrow("text-mismatch");
  });

  it("rejects an unknown value", () => {
    const container = containerWith("<p>x</p>");
    expect(() =>
      hydrate(h("p", null, "x"), container, null, { textComparison: "loose" as never }),
    ).toThrow("Hydration textComparison option must be");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/renderer/hydration-text-comparison.test.ts`
Expected: FAIL (option not accepted / no normalization).

- [ ] **Step 3: Implement**

1. `src/renderer/hydration.ts`: add to `HydrationContext`:
   `textComparison?: "exact" | "normalized-collapsing";`
   Add helper:
   ```ts
   function textMatches(expected: string, actual: string | null, context: HydrationContext | null): boolean {
     if (context?.textComparison === "normalized-collapsing") {
       return normalizeText(expected) === normalizeText(actual ?? "");
     }
     return actual === expected;
   }
   function normalizeText(value: string): string {
     return value.replace(/\s+/g, " ").trim();
   }
   ```
   Replace both `node.textContent !== children` / `!== expected` checks with `!textMatches(..., context)` (both sites have `context` in scope).
2. `src/renderer/renderer.ts`:
   - Add `textComparison?: "exact" | "normalized-collapsing";` to `HydrationOptions`.
   - In `assertNoDeferredIntegrationOptions` add:
     ```ts
     if (options.textComparison !== undefined && options.textComparison !== "exact" && options.textComparison !== "normalized-collapsing") {
       throw new TypeError("Hydration textComparison option must be \"exact\" or \"normalized-collapsing\"");
     }
     ```
   - Add `"textComparison"` to the allowed-unknown-keys list (around line 409).
   - Wherever a `HydrationContext` is constructed for a hydration walk (`hydrateInitialTree`, `hydrateAsync` ordered path, `hydrateSelectively`, `recoverPreparedHydration`), pass `textComparison: options.textComparison`. (Find constructions with grep: `hydratedInstances: []`.)

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/renderer/hydration-text-comparison.test.ts tests/unit/renderer tests/unit/server`
Expected: PASS all.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hydration.ts src/renderer/renderer.ts tests/unit/renderer/hydration-text-comparison.test.ts
git commit -m "feat: add hydration textComparison option"
```

### Task 3: Selective recover event replay + message formatting

**Files:**
- Modify: `src/renderer/renderer.ts` (hydrateSelectively recover path)
- Modify: `src/renderer/hydration.ts` (message formatting — none needed if Task 1/2 messages already one-line; verify only)
- Test: `tests/unit/renderer/selective-hydration.test.ts` (extend)

- [ ] **Step 1: Write failing test (append to selective-hydration.test.ts)**

```ts
it("replays buffered interactions after recover-on-mismatch", async () => {
  const container = document.createElement("div");
  container.innerHTML = "<div><p>stale server text</p></div>";
  document.body.appendChild(container);

  const clicks: string[] = [];
  const App = () => h("div", null, h("button", { onClick: () => clicks.push("fired") }, "go"));

  const button = container.querySelector("p")!; // click lands before recovery re-render
  container.addEventListener("click", () => {}, true); // ensure buffer attached path exercised per existing tests

  await hydrateAsync(h(App), container, null, { selective: true, recover: true });

  // dispatch the buffered interaction the same way existing selective tests do
  // (copy the event-dispatch helper usage from the replay tests in this file)
  dispatchClick(container.querySelector("button")!);
  expect(clicks).toEqual(["fired"]);
});
```

Adapt to the file's existing helpers: find the current buffered-interaction replay test, mirror its event dispatch mechanism, but perform a real pre-settlement click on a stale node (e.g. the `<p>` or container before recovery) so it lands in the buffer, then assert the handler attached by the recovered client render fires.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/renderer/selective-hydration.test.ts`
Expected: FAIL — buffered event discarded.

- [ ] **Step 3: Implement**

In `hydrateSelectively` (src/renderer/renderer.ts), the recover branch currently `return`s inside the inner try without replaying. Change to set a `recovered` flag, and in the `finally` block treat a successful recovery like settlement:

```ts
let settled = false;
let recovered = false;
// ... in recover branch:
renderContainer.textContent = "";
renderContainer._solaceVNode = null;
withStyleSink(styleSink, () => renderVNode(vnode, renderContainer, appProvides));
recovered = true;
return;
// ... finally:
if (settled || recovered) {
  eventBuffer.replay();
}
eventBuffer.detach();
```

Also verify `SolaceHydrationError.message` from Tasks 1–2 reads as one line with kind/path/values; no further formatting work expected.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/renderer/selective-hydration.test.ts tests/unit/renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/renderer.ts tests/unit/renderer/selective-hydration.test.ts
git commit -m "feat: replay buffered events after selective hydration recovery"
```

### Task 4: Structure/edge tests + integration coverage

**Files:**
- Test: `tests/unit/renderer/hydration-structure.test.ts` (new)
- Test: `tests/integration/ssr-hydration-mismatch.test.ts` (new — follow conventions of `tests/integration/ssr-hydration.test.ts`: renderToStringAsync + hydrateAsync against the produced html)

- [ ] **Step 1: Write tests**

Structure tests (children list mismatch cases not currently covered):

```ts
import { describe, expect, it } from "vitest";
import { h } from "../../../src";
import { hydrate } from "../../../src/renderer/renderer";

function containerWith(html: string): Element {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe("hydration structure mismatch", () => {
  it("throws on a single extra element in children list", () => {
    const container = containerWith("<ul><li>a</li><li>b</li><li>c</li></ul>");
    expect(() => hydrate(h("ul", null, [h("li", null, "a"), h("li", null, "b")]), container)).toThrow(
      /extra-node/,
    );
  });

  it("throws on a single missing element in children list", () => {
    const container = containerWith("<ul><li>a</li></ul>");
    expect(() =>
      hydrate(h("ul", null, [h("li", null, "a"), h("li", null, "b")]), container),
    ).toThrow(/missing-node/);
  });

  it("throws on text node vs element substitution", () => {
    const container = containerWith("<p><span>x</span></p>");
    expect(() => hydrate(h("p", null, "text"), container)).toThrow(/text-mismatch|element-tag-mismatch/);
  });
});
```

Integration tests: SSR an app with `renderToStringAsync()`, inject the html into a container, then `hydrateAsync()` — cover:
1. attribute mismatch from server (server renders `<a href="/old">`, client expects `/new`) throws; with `recover: true` deopts and client markup wins.
2. mismatch inside a pending out-of-order boundary (use `renderToStream(tree, { mode: "out-of-order" })` html + `defineAsyncComponent` fallback, `hydrateAsync(..., { selective: true })`): mismatch in the resolved subtree either throws or recovers per options — assert no unhandled rejection and final DOM is client-correct.
3. router snapshot verified first, then a DOM mismatch still throws `SolaceHydrationError` (snapshot error does not mask it): follow the router-hydration test setup in `tests/unit/server/` or existing integration file.

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run tests/unit/renderer/hydration-structure.test.ts tests/integration/ssr-hydration-mismatch.test.ts`
Expected: PASS. If case 2 reveals genuine gaps in boundary mismatch handling (e.g. unhandled rejection), fix in `src/server/render-to-stream.ts` / `src/renderer/renderer.ts` and document the fix in the commit message.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/renderer/hydration-structure.test.ts tests/integration/ssr-hydration-mismatch.test.ts
git commit -m "test: hydration mismatch structure and SSR integration coverage"
```

### Task 5: Docs, changeset, full gates

**Files:**
- Modify: `docs/api.md`, `docs/api.zh-CN.md` (hydration sections)
- Create: `.changeset/hydration-mismatch-hardening.md`
- Modify: `docs/roadmap.md` (mismatch hardening note in item 5)

- [ ] **Step 1: Document**

- `docs/api.md` hydration section: attribute mismatch detection semantics (one-directional, skip rules, form value/checked via DOM property, `attributeName` field), the `textComparison` option with both values and default, selective recovery event replay.
- `docs/api.zh-CN.md`: mirror translation.
- `docs/roadmap.md` item 5: update "continue hardening mismatch policy" to reflect the completed hardening while keeping async-boundary/integration-test hardening wording honest.

- [ ] **Step 2: Changeset**

```markdown
---
"@italone/solace": minor
---

Harden the hydration mismatch policy: hydration now detects attribute mismatches between client props and server HTML (one-directional, structured `attribute-mismatch` errors with `attributeName`), supports `hydrate(container, { textComparison: "normalized-collapsing" })` to tolerate foldable whitespace differences (default remains exact), and selective hydration with `recover: true` now replays buffered interactions after the client re-render instead of discarding them.
```

- [ ] **Step 3: Full quality gate**

Run: `pnpm quality`
Expected: format + typecheck + lint + all tests PASS.

- [ ] **Step 4: Release gate**

Run: `pnpm release:check`
Expected: PASS (coverage thresholds, package smoke, adoption smoke, benchmarks, e2e).

- [ ] **Step 5: Commit and push**

```bash
git add docs/api.md docs/api.zh-CN.md docs/roadmap.md .changeset/hydration-mismatch-hardening.md
git commit -m "docs: hydration mismatch hardening docs and changeset"
git push
```
