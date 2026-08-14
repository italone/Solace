# Router-Aware SSR And Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add composable router readiness, canonical route snapshots, and a request-scoped server context without changing the existing direct SSR, SSG, or hydration option contracts.

**Architecture:** Extend `Router` with a single-flight `isReady()` promise for initial history settlement. Keep snapshot normalization, escaping, parsing, and comparison in a browser-safe router module. Add a server-only adapter that creates a fresh memory router, settles it, and returns cloned injection values for the existing `renderToStringAsync()` `provides` option. Client consumers verify the snapshot before calling `hydrateAsync()`.

**Tech Stack:** TypeScript, pnpm, Vitest, Playwright, Rollup/Vite package exports, existing Solace router/history/server/renderer APIs.

**Repository constraints:** Preserve the current dirty worktree. Do not publish npm packages, push branches, create tags, or commit changes during this plan unless the user explicitly requests that external Git/release state change. Keep auth, permissions, streaming, Suspense, route crawling, loaders, deployment adapters, and automatic recovery out of scope.

---

## File Map

- Modify `src/router/types.ts`: add `Router.isReady()`, `guard-cancelled` navigation error type, and public snapshot-related types if the project keeps router types centralized.
- Modify `src/router/router.ts`: implement single-flight initial settlement, expose `isReady()`, preserve install error containment, and keep later `push()`/`replace()` behavior unchanged.
- Create `src/router/snapshot.ts`: validate and normalize route snapshots, serialize with HTML-safe escaping, parse exact version 1 payloads, and compare snapshots with `RouterHydrationError`.
- Modify `src/router/index.ts` and `src/index.ts`: export router readiness and all four snapshot functions/types from the root entry.
- Create `src/server/router-context.ts`: create a request-scoped memory router, run synchronous guard configuration, await readiness, build the snapshot, and clone injection values.
- Modify `src/server/index.ts`: export `createRouterServerContext()` and re-export the snapshot surface for server-only consumers.
- Add `tests/unit/router/snapshot.test.ts`: snapshot normalization, identity validation, escaping, parsing, and mismatch behavior.
- Modify `tests/unit/router/router.test.ts` and `tests/unit/router/public-contract-types.test.ts`: readiness runtime and type contracts.
- Add `tests/unit/server/router-context.test.ts` and `tests/unit/server/router-context-public-contract-types.test.ts`: request isolation, guard setup, injection map, failure, and server type contracts.
- Modify `tests/unit/server/public-contract-types.test.ts`, `tests/integration/package-exports.test.ts`, and `tests/unit/docs/public-contract-docs.test.ts`: package export and deferred-option assertions.
- Modify `examples/adoption-consumer/src/server.tsx`, `src/client.tsx`, `src/hydration.tsx`, and `scripts/adoption-consumer-smoke.mjs` to extend the existing package-only fixture. Do not create a second consumer fixture; the existing smoke entry already installs a packed tarball and exercises CSR, SSR, hydration, and Chromium/Firefox/WebKit.
- Modify `docs/api.md`, `docs/api.zh-CN.md`, and `docs/package-usage.md`: document the composable workflow and preserve direct `router` rejection wording.

## Task 1: Add readiness RED tests and public type contract

**Files:**

- Modify: `tests/unit/router/router.test.ts`
- Modify: `tests/unit/router/public-contract-types.test.ts`
- Modify: `src/router/types.ts`

- [ ] **Step 1: Write the failing runtime tests.** Add tests that construct a router with a controllable history and assert:

```ts
it("shares one initial readiness promise and settles redirects and guards", async () => {
  const history = createMemoryHistory("/legacy");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: () => h("p", null, "home") },
      { path: "/legacy", redirect: "/" },
    ],
  });

  const first = router.isReady();
  const second = router.isReady();
  expect(first).toBe(second);
  await expect(first).resolves.toMatchObject({ fullPath: "/" });
  expect(router.currentRoute.value.fullPath).toBe("/");
});
```

Add separate cases for `app.use(router); await router.isReady()`, wait-before-install, an initial guard returning `false` with `RouterNavigationError.type === "guard-cancelled"`, a thrown guard, invalid initial history, and a readiness promise that remains rejected after its first failure. Add a regression proving later `push()` still returns the current route for a duplicate navigation.

- [ ] **Step 2: Run only the new runtime tests to confirm RED.**

Run: `pnpm exec vitest run tests/unit/router/router.test.ts -t "readiness|initial guard|invalid initial"`

Expected: FAIL because `Router.isReady` is not defined and the new navigation error type is absent.

- [ ] **Step 3: Add the type-level RED contract.** In `tests/unit/router/public-contract-types.test.ts`, require `router.isReady()` to resolve to `RouteLocationNormalized` and keep the existing `Router` methods assignable. Add a compile assertion for `RouterNavigationError`'s `guard-cancelled` discriminant.

- [ ] **Step 4: Run the type contract to confirm RED.**

Run: `pnpm exec vitest run tests/unit/router/public-contract-types.test.ts`

Expected: FAIL with the missing method/type member.

## Task 2: Implement single-flight router readiness

**Files:**

- Modify: `src/router/types.ts`
- Modify: `src/router/router.ts`
- Test: `tests/unit/router/router.test.ts`

- [ ] **Step 1: Add the public signatures and error discriminant.** Extend `RouterNavigationError`'s type union with `"guard-cancelled"` and add `isReady(): Promise<RouteLocationNormalized>` to `Router`.

- [ ] **Step 2: Implement the minimal readiness state.** Add a `readinessPromise` variable and a `startInitialSettlement()` helper inside `createRouter()`. The helper must:

  - resolve the current history location through the existing redirect and guard pipeline;
  - execute the initial pipeline even when the normalized history location equals the initial `currentRoute`;
  - convert an initial `false` guard result to `RouterNavigationError("Router initial navigation was cancelled", "guard-cancelled", from, to)`;
  - preserve existing `RouterNavigationError` failures and let invalid history resolution reject with `TypeError`;
  - update history and `currentRoute` only after the active navigation check;
  - never invoke `scrollBehavior` on the server adapter, which will create a router without that option;
  - return exactly the same promise to concurrent callers and keep the rejected promise after failure.

  `install()` must call the helper and attach a rejection observer. `isReady()` must return the helper's promise without swallowing errors. Do not change the public `push()` or `replace()` return values.

- [ ] **Step 3: Run the focused runtime and type tests.**

Run: `pnpm exec vitest run tests/unit/router/router.test.ts tests/unit/router/public-contract-types.test.ts`

Expected: PASS, including existing router redirect, guard, history recovery, and duplicate-navigation tests.

- [ ] **Step 4: Run the router baseline.**

Run: `pnpm exec vitest run tests/unit/router`

Expected: PASS with no changes to existing navigation semantics outside initial readiness.

## Task 3: Add snapshot RED tests and public contracts

**Files:**

- Add: `tests/unit/router/snapshot.test.ts`
- Add: `tests/unit/router/snapshot-public-contract-types.test.ts`
- Modify: `src/router/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write normalization and identity tests.** Cover a route with nested matched records, params, repeated query values, omitted nullish query inputs, and a redirect. Assert sorted tuple output, parent-to-child matched IDs, canonical `fullPath`, and `redirectedFrom`. Assert that an empty identity, duplicate identity, or identity callback that returns a non-string throws `TypeError`.

```ts
const snapshot = createRouterSnapshot(route, (record) => record.name ?? record.path);
expect(snapshot.params).toEqual([["id", "7"]]);
expect(snapshot.query).toEqual([["filter", ["open", "closed"]]]);
expect(snapshot.matched).toEqual(["root", "detail"]);
```

- [ ] **Step 2: Write serialization/parser tests.** Assert that serialized output contains escaped `\\u003C`, `\\u003E`, `\\u0026`, `\\u2028`, and `\\u2029` sequences for hostile string values. Add malformed JSON, unsupported version, unknown key, missing key, duplicate tuple key, invalid array element, non-normalized path, and prototype pollution payload cases.

- [ ] **Step 3: Write verification tests.** Assert exact equality passes and each field (`version`, `fullPath`, `path`, `params`, `query`, `matched`, `redirectedFrom`) produces `RouterHydrationError` with the matching field and snapshots attached. Assert the error message does not include route records, components, `meta`, or arbitrary context.

- [ ] **Step 4: Add type-level imports.** Require the root package to expose `RouterSnapshot`, `RouteRecordIdentity`, `RouterHydrationError`, `createRouterSnapshot`, `serializeRouterSnapshot`, `parseRouterSnapshot`, and `verifyRouterSnapshot` with the signatures in the design.

- [ ] **Step 5: Run the new tests to confirm RED.**

Run: `pnpm exec vitest run tests/unit/router/snapshot.test.ts tests/unit/router/snapshot-public-contract-types.test.ts`

Expected: FAIL because `src/router/snapshot.ts` and its exports do not exist.

## Task 4: Implement canonical snapshot, safe transport, and comparison

**Files:**

- Add: `src/router/snapshot.ts`
- Modify: `src/router/index.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/router/snapshot.test.ts`

- [ ] **Step 1: Implement exact snapshot types and validation helpers.** Define version `1`, tuple-array transport types, and `RouteRecordIdentity`. Clone all values; do not retain route, matched record, component, guard, `meta`, or history references.

- [ ] **Step 2: Implement canonicalization.** Sort params and query keys lexicographically, preserve query array item order, rebuild the canonical query string with the existing router query serializer, and canonicalize `redirectedFrom` using the same path/query rules. Call the identity callback once per matched record in parent-to-child order and reject empty, non-string, or duplicate IDs.

- [ ] **Step 3: Implement safe serialization and strict parsing.** Validate the exact object shape, use `JSON.stringify`, and replace `<`, `>`, `&`, U+2028, and U+2029 with JSON escape sequences. Parse only version 1, reject unknown keys and duplicate tuple keys, then copy into fresh arrays and plain objects.

- [ ] **Step 4: Implement `RouterHydrationError` and comparison.** Compare version, full path, path, params, query, ordered matched IDs, and redirect provenance in that order. Throw a stable field-coded error carrying only validated snapshots.

- [ ] **Step 5: Run the snapshot tests to verify GREEN.**

Run: `pnpm exec vitest run tests/unit/router/snapshot.test.ts tests/unit/router/snapshot-public-contract-types.test.ts`

Expected: PASS, including hostile escaping and malformed payload cases.

## Task 5: Add server-context RED tests and adapter

**Files:**

- Add: `tests/unit/server/router-context.test.ts`
- Add: `tests/unit/server/router-context-public-contract-types.test.ts`
- Add: `src/server/router-context.ts`
- Modify: `src/server/index.ts`

- [ ] **Step 1: Write server-context RED tests.** Cover:

```ts
const context = await createRouterServerContext({
  url: "/legacy?b=2&a=1",
  routes,
  identifyRecord: (record) => record.name ?? record.path,
  configure(router) {
    router.beforeEach(() => true);
  },
});

expect(context.route.fullPath).toBe("/target?a=1&b=2");
expect(context.snapshot.fullPath).toBe("/target?a=1&b=2");
expect(context.provides).not.toBe(inputProvides);
```

Add concurrent calls with different URLs to prove request isolation, redirect and guard failure cases, a configure callback returning a thenable, caller-map cloning and private-key overwrite, and a route with no scroll behavior. Assert that the adapter does not expose a direct SSR `router` option.

- [ ] **Step 2: Add the server type contract.** Require `createRouterServerContext()` from `@italone/solace/server`, with `ReadonlyMap<string | symbol, unknown>` input and `Map<string | symbol, unknown>` output. Require the snapshot types/functions to be importable from the server entry.

- [ ] **Step 3: Run the server tests to confirm RED.**

Run: `pnpm exec vitest run tests/unit/server/router-context.test.ts tests/unit/server/router-context-public-contract-types.test.ts`

Expected: FAIL because the adapter and server exports do not exist.

- [ ] **Step 4: Implement the adapter.** Create `createMemoryHistory(url)`, create a router without `scrollBehavior`, invoke `configure` synchronously, reject a returned thenable, await `router.isReady()`, call `createRouterSnapshot()`, clone the caller map, and set the private router/route injection keys. Return `{ router, route, snapshot, provides }`. Keep all state local to the call.

- [ ] **Step 5: Export the adapter and snapshot re-exports.** Add the server entry exports without adding `router` to `RenderToStringOptions`, `GenerateStaticSiteOptions`, or hydration options.

- [ ] **Step 6: Run server and existing SSR tests.**

Run: `pnpm exec vitest run tests/unit/server tests/unit/renderer/hydration.test.ts tests/unit/router`

Expected: PASS, including all existing direct-option rejection assertions.

## Task 6: Integrate package-only SSR/hydration consumer coverage

**Files:**

- Modify: `examples/adoption-consumer/src/server.tsx`
- Modify: `examples/adoption-consumer/src/client.tsx`
- Modify: `examples/adoption-consumer/src/hydration.tsx`
- Modify: `scripts/adoption-consumer-smoke.mjs`
- Modify: `tests/unit/scripts/adoption-consumer-smoke.test.ts`

- [ ] **Step 1: Add a package-only server route scenario.** In the packed fixture, create a route table with stable record identities, call `createRouterServerContext()` against a redirect URL, render the settled app through `renderToStringAsync()` using returned `provides`, and return escaped serialized snapshot text. Do not import from `src` or use a Vite alias.

- [ ] **Step 2: Add browser verification before hydration.** Parse the server payload, create the browser router with the same route identities, install it, await `router.isReady()`, verify the snapshot, then call `hydrateAsync()`. Add a mismatch case that asserts component setup is not entered before `RouterHydrationError`, and keep the existing DOM-only `{ recover: true }` case separate.

- [ ] **Step 3: Extend the smoke assertions.** Assert server canonical path, escaped payload, matching DOM node reuse, mismatch fail-closed behavior, explicit fresh-mount recovery, and router navigation after hydration. Keep Chromium, Firefox, and WebKit coverage in the existing `--browsers` path.

- [ ] **Step 4: Run the focused adoption smoke.**

Run: `pnpm adoption:smoke:browsers`

Expected: PASS with package install/typecheck, CSR build, SSR build, server execution, and all three browsers.

## Task 7: Synchronize public docs and contract tests

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `tests/unit/docs/public-contract-docs.test.ts`
- Modify: `tests/unit/server/public-contract-types.test.ts`
- Modify: `tests/integration/package-exports.test.ts`

- [ ] **Step 1: Document root and server exports.** Add the exact `isReady()`, snapshot, error, and server-context signatures, the server/client sequence, escaping rules, record identity requirement, and fail-closed mismatch behavior in English and Chinese docs.

- [ ] **Step 2: Preserve deferred boundaries.** Keep direct `router` option rejection examples and the existing messages for router-aware SSR, SSG, and hydration. Explicitly state that auth, permissions, streaming, Suspense, route crawling, and filesystem output remain deferred.

- [ ] **Step 3: Update contract assertions.** Test the new exported names and type signatures while retaining all existing rejection and documentation-date assertions.

- [ ] **Step 4: Run documentation and package-export tests.**

Run: `pnpm exec vitest run tests/unit/docs/public-contract-docs.test.ts tests/unit/server/public-contract-types.test.ts tests/integration/package-exports.test.ts`

Expected: PASS with both package entries exposing the documented surface.

## Task 8: Run full quality and release gates

**Files:**

- Validate all changed source, tests, fixture, and documentation files.

- [ ] **Step 1: Run focused validation from the changed-file router.**

Run: `node /Users/alone/.codex/skills/frontend-engineering/scripts/recommend-validation.mjs --root /Users/alone/Desktop/TEST/Solace <changed-files>`

Expected: lint, typecheck, build, unit tests, and E2E recommendations cover routing, security-sensitive serialization, package exports, and browser behavior.

- [ ] **Step 2: Run project checks.**

Run: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm test:e2e`

Expected: all commands exit 0; report any repository-wide baseline issue separately from changed-file failures.

- [ ] **Step 3: Run the release gate without external state changes.**

Run: `pnpm release:check`

Expected: package, packed-consumer, adoption, router, SSR/hydration, docs, and benchmark gates pass. Do not run `pnpm release:publish:beta`, `git push`, tag creation, or npm registry mutation as part of this plan.

- [ ] **Step 4: Inspect the final diff.**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only the intended P3 source, tests, docs, and package-consumer fixture changes are present. Leave unrelated existing dirty changes untouched.

## Handoff

After this plan is accepted, execute it inline with `superpowers:executing-plans` (no subagent dispatch unless the user explicitly asks for it). Stop at the first failing focused gate, record the exact output, and fix only the affected task before proceeding. At completion, report changed files, validation results, and the remaining decision about any external release state separately.
