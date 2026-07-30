# Router Beta Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current beta router with focused edge-case tests, predictable query decoding errors, explicit path/hash normalization coverage, and concise documentation.

**Architecture:** Keep the public router surface unchanged and work only inside the existing `src/router/` module plus router docs. Add tests first for query, history, router-core, and component behavior; only change production code where a test exposes unstable behavior. Keep guards, nested routes, redirects, named routes, memory history, auth, SSR, SSG, and hydration out of scope.

**Tech Stack:** TypeScript, Solace runtime APIs, Vitest with jsdom, Playwright for the existing router e2e smoke when behavior changes, pnpm.

---

## File Structure

- Modify `tests/unit/router/query.test.ts`: add boundary tests for bare keys, literal `+`, malformed percent encoding, encoded keys/values, and nullish array values.
- Modify `src/router/query.ts`: add a small decode wrapper that turns malformed percent encoding into a stable `TypeError`.
- Modify `tests/unit/router/history.test.ts`: add hash-history normalization and listener cleanup tests.
- Modify `tests/unit/router/router.test.ts`: add route-location normalization and repeated-install listener replacement tests.
- Modify `tests/integration/router-component.test.ts`: add `RouterLink` click-boundary and `replace` behavior coverage.
- Modify `docs/api.md`: document supported normalization and malformed query behavior in the Router section.
- Modify `docs/api.zh-CN.md`: mirror the Router section update in Chinese.
- Modify `docs/package-usage.md`: add one concise beta-router normalization sentence.

---

### Task 1: Query Boundary Stabilization

**Files:**

- Modify: `tests/unit/router/query.test.ts`
- Modify: `src/router/query.ts`

- [ ] **Step 1: Write the failing query boundary tests**

In `tests/unit/router/query.test.ts`, append these tests inside `describe("router query helpers", () => { ... })`:

```ts
it("parses bare keys and keeps plus signs literal", () => {
  expect(parseQuery("?flag&plus=a+b")).toEqual({ flag: "", plus: "a+b" });
});

it("throws a stable TypeError for malformed percent encoding", () => {
  expect(() => parseQuery("?broken=%E0%A4%A")).toThrow(TypeError);
  expect(() => parseQuery("?broken=%E0%A4%A")).toThrow(
    /Router query contains malformed percent encoding/,
  );
});

it("stringifies encoded keys and skips nullish array entries", () => {
  expect(
    stringifyQuery({
      "redirect to": "/users/1",
      tag: ["a", null, "b", undefined],
    }),
  ).toBe("?redirect%20to=%2Fusers%2F1&tag=a&tag=b");
});
```

- [ ] **Step 2: Run query tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: the malformed percent encoding test fails because `decodeURIComponent()` currently throws `URIError`, not the documented router `TypeError`.

- [ ] **Step 3: Implement stable query decode errors**

In `src/router/query.ts`, replace the two direct `decodeURIComponent()` calls in `parseQuery()`:

```ts
const key = decodeURIComponent(rawKey);
const value = decodeURIComponent(rawValue);
```

with:

```ts
const key = decodeQueryComponent(rawKey);
const value = decodeQueryComponent(rawValue);
```

Then add this helper at the end of `src/router/query.ts`:

```ts
function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      throw new TypeError("Router query contains malformed percent encoding");
    }

    throw error;
  }
}
```

- [ ] **Step 4: Run query tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: all query tests pass.

- [ ] **Step 5: Commit query stabilization**

Run:

```bash
git add src/router/query.ts tests/unit/router/query.test.ts
git commit -m "fix: stabilize router query boundaries"
```

---

### Task 2: History Adapter Boundary Coverage

**Files:**

- Modify: `tests/unit/router/history.test.ts`

- [ ] **Step 1: Write hash normalization and cleanup tests**

In `tests/unit/router/history.test.ts`, append these tests inside `describe("router history", () => { ... })`:

```ts
it("normalizes blank and relative hash locations", () => {
  window.history.replaceState(null, "", "/#");
  const blankHistory = createWebHashHistory();
  expect(blankHistory.location()).toBe("/");

  window.history.replaceState(null, "", "/#settings?tab=profile");
  const relativeHistory = createWebHashHistory();
  expect(relativeHistory.location()).toBe("/settings?tab=profile");
});

it("cleans up hash history listeners", () => {
  const history = createWebHashHistory();
  const listener = vi.fn();
  const stop = history.listen(listener);

  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.dispatchEvent(new PopStateEvent("popstate"));
  stop();
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.dispatchEvent(new PopStateEvent("popstate"));

  expect(listener).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run history tests**

Run:

```bash
pnpm vitest run tests/unit/router/history.test.ts
```

Expected: tests pass if existing hash normalization and cleanup behavior is already stable. If a test fails, inspect the first failing assertion and make the minimal change in `src/router/history.ts` only.

- [ ] **Step 3: Commit history coverage**

Run:

```bash
git add tests/unit/router/history.test.ts src/router/history.ts
git commit -m "test: cover router history boundaries"
```

---

### Task 3: Router Core Normalization And Install Coverage

**Files:**

- Modify: `tests/unit/router/router.test.ts`

- [ ] **Step 1: Add listener-count support to the memory-like history helper**

In `tests/unit/router/router.test.ts`, change the helper signature:

```ts
function createMemoryLikeHistory(initial = "/"): RouterHistory & { emit(): void } {
```

to:

```ts
function createMemoryLikeHistory(
  initial = "/",
): RouterHistory & { emit(): void; listenerCount(): number } {
```

Then add `listenerCount()` to the returned object:

```ts
    listenerCount() {
      return listeners.size;
    },
```

- [ ] **Step 2: Write router normalization and repeated-install tests**

In `tests/unit/router/router.test.ts`, append these tests inside `describe("createRouter", () => { ... })`:

```ts
it("normalizes supported string locations to canonical full paths", () => {
  const router = createRouter({
    history: createMemoryLikeHistory(),
    routes: [{ path: "/users/:id", component: User }],
  });

  expect(router.resolve("").fullPath).toBe("/");
  expect(router.resolve("users/42///?tab=profile").fullPath).toBe("/users/42?tab=profile");
  expect(router.resolve("/users/42///?tag=a&tag=b")).toMatchObject({
    path: "/users/42",
    fullPath: "/users/42?tag=a&tag=b",
    params: { id: "42" },
    query: { tag: ["a", "b"] },
  });
});

it("normalizes supported object locations to canonical full paths", () => {
  const router = createRouter({
    history: createMemoryLikeHistory(),
    routes: [{ path: "/users/:id", component: User }],
  });

  expect(router.resolve({ path: "users/7///", query: { tab: "profile" } })).toMatchObject({
    path: "/users/7",
    fullPath: "/users/7?tab=profile",
    params: { id: "7" },
    query: { tab: "profile" },
  });
});

it("replaces the previous history listener on repeated install", () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({ history, routes: [{ path: "/", component: Home }] });
  const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

  router.install(app as never);
  expect(history.listenerCount()).toBe(1);

  router.install(app as never);
  expect(history.listenerCount()).toBe(1);
});
```

- [ ] **Step 3: Run router tests**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: tests pass if existing router normalization and install cleanup are stable. If a test fails, make the minimal change in `src/router/router.ts` or `src/router/matcher.ts` only.

- [ ] **Step 4: Commit router core coverage**

Run:

```bash
git add tests/unit/router/router.test.ts src/router/router.ts src/router/matcher.ts
git commit -m "test: cover router normalization boundaries"
```

---

### Task 4: RouterLink Boundary Coverage

**Files:**

- Modify: `tests/integration/router-component.test.ts`

- [ ] **Step 1: Widen the integration memory-like history helper**

In `tests/integration/router-component.test.ts`, change the helper signature:

```ts
function createMemoryLikeHistory(initial = "/"): RouterHistory {
```

to:

```ts
function createMemoryLikeHistory(initial = "/"): RouterHistory & {
  pushedPaths: string[];
  replacedPaths: string[];
} {
```

Add arrays before the return statement:

```ts
const pushedPaths: string[] = [];
const replacedPaths: string[] = [];
```

Then change `push()` and `replace()` to record paths:

```ts
    push(path) {
      pushedPaths.push(path);
      current = path;
    },
    replace(path) {
      replacedPaths.push(path);
      current = path;
    },
```

Finally expose the arrays at the end of the returned object:

```ts
    pushedPaths,
    replacedPaths,
```

- [ ] **Step 2: Write RouterLink click-boundary tests**

In `tests/integration/router-component.test.ts`, append these tests inside `describe("router components", () => { ... })`:

```ts
it("does not navigate RouterLink clicks that the browser should handle", () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: () => h("p", null, "home") },
      { path: "/users/:id", component: () => h("p", null, "user") },
    ],
  });
  const App = () => () =>
    h("main", null, [
      h(RouterLink, { to: "/users/42", id: "meta-link" }, "Meta"),
      h(
        RouterLink,
        {
          to: "/users/43",
          id: "prevented-link",
          onClick: (event: MouseEvent) => event.preventDefault(),
        },
        "Prevented",
      ),
      h(RouterView),
    ]);
  const container = document.createElement("div");

  createApp(App).use(router).mount(container);
  container
    .querySelector<HTMLAnchorElement>("#meta-link")
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
  container.querySelector<HTMLAnchorElement>("#prevented-link")?.click();

  expect(history.pushedPaths).toEqual([]);
  expect(router.currentRoute.value.fullPath).toBe("/");
});

it("uses replace navigation when RouterLink replace is true", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: () => h("p", { id: "home" }, "home") },
      { path: "/users/:id", component: () => h("p", { id: "user" }, "user") },
    ],
  });
  const App = () => () =>
    h("main", null, [
      h(RouterLink, { to: "/users/99", id: "replace-link", replace: true }, "Replace"),
      h(RouterView),
    ]);
  const container = document.createElement("div");

  createApp(App).use(router).mount(container);
  container.querySelector<HTMLAnchorElement>("#replace-link")?.click();
  await nextTick();

  expect(history.pushedPaths).toEqual([]);
  expect(history.replacedPaths).toEqual(["/users/99"]);
  expect(container.querySelector("#user")?.textContent).toBe("user");
});
```

- [ ] **Step 3: Run router component integration tests**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: tests pass if existing `RouterLink` click boundaries and `replace` behavior are stable. If a test fails, make the minimal change in `src/router/components.ts` only.

- [ ] **Step 4: Commit RouterLink coverage**

Run:

```bash
git add tests/integration/router-component.test.ts src/router/components.ts
git commit -m "test: cover router link boundaries"
```

---

### Task 5: Router Documentation Alignment

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`

- [ ] **Step 1: Update English API router documentation**

In `docs/api.md`, in the Router section after the paragraph under `### createRouter({ history, routes })`, add:

```md
Supported path locations normalize to a leading slash and trim trailing slashes except for `/`.
Empty string locations resolve to `/`. Query strings use repeated keys for arrays, skip nullish
object values, keep `+` as a literal plus sign, and throw a `TypeError` for malformed percent
encoding.
```

- [ ] **Step 2: Update Chinese API router documentation**

In `docs/api.zh-CN.md`, in the Router section after the paragraph under `### createRouter({ history, routes })`, add:

```md
受支持的 path location 会规范化为前导 `/`，并移除除 `/` 之外的尾随斜杠。空字符串
location 会解析为 `/`。query string 对数组使用重复 key，跳过 object location 中的 nullish
值，将 `+` 保持为字面加号；percent encoding 非法时会抛出 `TypeError`。
```

- [ ] **Step 3: Update package usage router note**

In `docs/package-usage.md`, after the paragraph that begins `The current router supports path matching`, add:

```md
Supported path locations normalize to a leading slash and trim trailing slashes except for `/`;
malformed query percent encoding throws a `TypeError`.
```

- [ ] **Step 4: Format changed docs**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md
```

Expected: Prettier exits with code 0 and only these docs are formatted.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md
git commit -m "docs: clarify router beta normalization"
```

---

### Task 6: Targeted Verification

**Files:**

- Validate: `src/router/**`
- Validate: `tests/unit/router/**`
- Validate: `tests/integration/router-component.test.ts`
- Validate: `docs/api.md`
- Validate: `docs/api.zh-CN.md`
- Validate: `docs/package-usage.md`

- [ ] **Step 1: Run all router unit tests**

Run:

```bash
pnpm vitest run tests/unit/router
```

Expected: all router unit tests pass.

- [ ] **Step 2: Run router component integration test**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: router component integration tests pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 4: Run router e2e smoke**

Run:

```bash
pnpm test:e2e -- router-basic
```

Expected: Playwright router-basic e2e test passes.

- [ ] **Step 5: Inspect final diff and status**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: no unexpected files are modified. If there are remaining intended changes, commit them before claiming completion.
