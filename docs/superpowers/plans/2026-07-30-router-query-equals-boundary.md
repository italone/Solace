# Router Query Equals Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `parseQuery()` preserve query values that contain `=` by splitting each query part at the first separator only.

**Architecture:** Keep the change inside the existing query helper module. Add focused unit tests first, then replace the lossy `part.split("=")` destructuring with a tiny raw-part splitter that preserves the full value tail. Do not change stringification, router core, history, components, exports, or deferred router features.

**Tech Stack:** TypeScript, Vitest, pnpm.

---

## File Structure

- Modify `tests/unit/router/query.test.ts`: add query parse boundary coverage for values containing `=`, repeated keys with `=`, empty keys, and encoded `=`.
- Modify `src/router/query.ts`: add `splitQueryPart()` and use it from `parseQuery()`.

---

### Task 1: Preserve Equals In Query Values

**Files:**

- Modify: `tests/unit/router/query.test.ts`
- Modify: `src/router/query.ts`

- [x] **Step 1: Write the failing query tests**

In `tests/unit/router/query.test.ts`, append these tests inside `describe("router query helpers", () => { ... })`:

```ts
it("preserves equals signs after the first query separator", () => {
  expect(parseQuery("?q=a=b")).toEqual({ q: "a=b" });
});

it("preserves equals signs for repeated query keys", () => {
  expect(parseQuery("?q=a=b&q=c=d")).toEqual({ q: ["a=b", "c=d"] });
});

it("parses empty query keys explicitly", () => {
  expect(parseQuery("?=value")).toEqual({ "": "value" });
});

it("decodes encoded equals signs inside values", () => {
  expect(parseQuery("?redirect=%2Fusers%2F1%3Ftab%3Da")).toEqual({
    redirect: "/users/1?tab=a",
  });
});
```

- [x] **Step 2: Run query tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: the first two new tests fail because `parseQuery()` currently truncates values after the second `=`. The encoded `=` test may already pass because encoded `=` is decoded after splitting.

- [x] **Step 3: Implement first-separator splitting**

In `src/router/query.ts`, replace this line in `parseQuery()`:

```ts
const [rawKey, rawValue = ""] = part.split("=");
```

with:

```ts
const [rawKey, rawValue] = splitQueryPart(part);
```

Then add this helper before `decodeQueryComponent()`:

```ts
function splitQueryPart(part: string): [string, string] {
  const separatorIndex = part.indexOf("=");

  if (separatorIndex === -1) {
    return [part, ""];
  }

  return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
}
```

- [x] **Step 4: Run query tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: all query tests pass.

- [x] **Step 5: Run all router unit tests**

Run:

```bash
pnpm vitest run tests/unit/router
```

Expected: all router unit tests pass.

- [x] **Step 6: Commit the query parser fix**

Run:

```bash
git add src/router/query.ts tests/unit/router/query.test.ts
git commit -m "fix: preserve equals in router query values"
```

---

### Task 2: Final Status Check

**Files:**

- Validate: `src/router/query.ts`
- Validate: `tests/unit/router/query.test.ts`

- [x] **Step 1: Inspect status and latest commit**

Run:

```bash
git status --short
git log --oneline -3
```

Expected: worktree is clean and the latest commit is `fix: preserve equals in router query values`.

- [x] **Step 2: Record verification**

Record these command results in the final response:

```bash
pnpm vitest run tests/unit/router/query.test.ts
pnpm vitest run tests/unit/router
```

Expected: both commands exit with code 0.
