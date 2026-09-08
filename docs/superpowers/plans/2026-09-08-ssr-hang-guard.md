# SSR Hang Guard (timeoutMs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `timeoutMs` option to the three async SSR entry points so a never-settling promise rejects/errors instead of hanging, per `docs/superpowers/specs/2026-09-08-ssr-hang-guard-design.md`.

**Architecture:** A shared `src/server/ssr-timeout.ts` provides `SolaceTimeoutError`, `raceWithTimeout`, and `assertTimeoutMs`. `renderToStringAsync` races its whole body. `renderToStream` applies a source-phase deadline (errors the stream) and, in out-of-order mode, a per-boundary deadline from boundary creation (failure comment + fallback, stream continues). `generateStaticSiteAsync` forwards site/route-level `timeoutMs` into each route's `renderToStringAsync` call.

**Tech Stack:** TypeScript, Vitest, pnpm scripts.

---

### Task 1: Shared timeout utility

**Files:**

- Create: `src/server/ssr-timeout.ts`
- Create: `tests/unit/server/ssr-timeout.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import {
  SolaceTimeoutError,
  assertTimeoutMs,
  raceWithTimeout,
} from "../../../src/server/ssr-timeout";

describe("raceWithTimeout", () => {
  it("resolves with the winner when the promise settles first", async () => {
    await expect(raceWithTimeout(Promise.resolve("ok"), 1000, "test")).resolves.toBe("ok");
  });

  it("rejects with SolaceTimeoutError when the timer wins", async () => {
    const pending = new Promise<string>(() => {});
    await expect(raceWithTimeout(pending, 10, "awaiting boundary")).rejects.toThrow(
      SolaceTimeoutError,
    );
    await expect(raceWithTimeout(pending, 10, "awaiting boundary")).rejects.toThrow(
      /timed out after 10ms \(awaiting boundary\)/,
    );
  });

  it("clears the timer once settled so the process is not held", async () => {
    const pending = new Promise<string>(() => {});
    const start = Date.now();
    await raceWithTimeout(pending, 10, "test").catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

describe("assertTimeoutMs", () => {
  it("accepts a positive number and undefined", () => {
    expect(() => assertTimeoutMs(undefined, "SSR")).not.toThrow();
    expect(() => assertTimeoutMs(100, "SSR")).not.toThrow();
  });

  it("rejects zero, negatives, non-finite, and non-numbers", () => {
    for (const bad of [0, -1, Number.POSITIVE_INFINITY, "100", null]) {
      expect(() => assertTimeoutMs(bad as never, "SSR")).toThrow(
        TypeError("SSR timeoutMs must be a positive number"),
      );
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run tests/unit/server/ssr-timeout.test.ts
```

Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

```ts
// src/server/ssr-timeout.ts
export class SolaceTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolaceTimeoutError";
  }
}

export function assertTimeoutMs(value: unknown, label: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} timeoutMs must be a positive number`);
  }
}

export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SolaceTimeoutError(`SSR timed out after ${timeoutMs}ms (${label})`));
    }, timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
```

- [ ] **Step 4: Run tests, verify PASS, then commit**

```bash
pnpm exec vitest run tests/unit/server/ssr-timeout.test.ts
git add src/server/ssr-timeout.ts tests/unit/server/ssr-timeout.test.ts
git commit -m "feat: add SSR timeout utility"
```

---

### Task 2: renderToStringAsync timeoutMs

**Files:**

- Modify: `src/server/render-to-string.ts` (options interface at :31, `renderToStringAsync` at :84, `assertRouterAwareSSROptions` unknown-key list at :239)
- Modify: `tests/unit/server/render-to-string.test.ts` (append to the `renderToStringAsync` describe)

- [ ] **Step 1: Write the failing tests**

```ts
it("rejects with SolaceTimeoutError when a never-settling render exceeds timeoutMs", async () => {
  const Hung: AsyncComponentType = () => new Promise(() => {}) as never;
  await expect(renderToStringAsync(h(Hung), { timeoutMs: 15 })).rejects.toThrow(SolaceTimeoutError);
});

it("rejects with SolaceTimeoutError when a promised child never settles", async () => {
  const pendingChild = new Promise(() => {});
  await expect(
    renderToStringAsync(h("p", null, pendingChild as never), { timeoutMs: 15 }),
  ).rejects.toThrow(/timed out after 15ms/);
});

it("leaves never-settling renders pending when timeoutMs is omitted", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const Gated: AsyncComponentType = () => gate.then(() => () => h("p", null, "late"));
  const result = renderToStringAsync(h(Gated));
  await Promise.resolve();
  release!();
  await expect(result).resolves.toEqual({ html: "<p>late</p>", styles: [] });
});

it("rejects invalid timeoutMs values", async () => {
  for (const bad of [0, -1, "100"]) {
    await expect(
      renderToStringAsync(h("p", null, "x"), { timeoutMs: bad as never }),
    ).rejects.toThrow(TypeError("SSR timeoutMs must be a positive number"));
  }
});
```

Import `SolaceTimeoutError` from `"../../../src"` — it does not exist there yet; add the root re-export in Task 5 Step 1 BEFORE running these tests, or import from `"../../../src/server/ssr-timeout"` here and keep the root-export test in Task 5. Prefer the latter to keep tasks independent.

- [ ] **Step 2: Run to verify failure**

```bash
pnpm exec vitest run tests/unit/server/render-to-string.test.ts
```

Expected: new tests FAIL (unknown option `timeoutMs` TypeError fires first — that is the observable failure).

- [ ] **Step 3: Implement**

In `render-to-string.ts`:

1. Add `timeoutMs?: number;` to `RenderToStringOptions`.
2. Add `"timeoutMs"` to the allowed-keys list in the unknown-option check (line ~239) — for BOTH the sync and async option surface (sync entry just never uses it, matching how `router` is handled).
3. Import `assertTimeoutMs, raceWithTimeout` from `./ssr-timeout`.
4. In `assertRouterAwareSSROptions` (or wherever option validation runs), add `assertTimeoutMs(options.timeoutMs, "SSR")` so it throws synchronously — but note `renderToStringAsync` is `async`, so a sync throw still becomes a rejected promise; the existing tests expect `rejects.toThrow`.
5. Wrap the body:

```ts
export function renderToStringAsync(
  source: RenderToStringAsyncSource,
  options: RenderToStringAsyncOptions = {},
): Promise<RenderToStringResult> {
  assertRouterAwareSSROptions(options);
  if (options.timeoutMs === undefined) {
    return renderToStringAsyncInner(source, options);
  }
  return raceWithTimeout(renderToStringAsyncInner(source, options), options.timeoutMs, "render");
}

async function renderToStringAsyncInner(
  source: RenderToStringAsyncSource,
  options: RenderToStringAsyncOptions,
): Promise<RenderToStringResult> {
  // existing body unchanged (router resolve, prepareAsyncSource, html assembly)
}
```

- [ ] **Step 4: Run tests (whole file must pass, including pre-existing), then commit**

```bash
pnpm exec vitest run tests/unit/server/render-to-string.test.ts
git add src/server/render-to-string.ts tests/unit/server/render-to-string.test.ts
git commit -m "feat: add timeoutMs to renderToStringAsync"
```

---

### Task 3: renderToStream timeoutMs

**Files:**

- Modify: `src/server/render-to-stream.ts` (`RenderToStreamOptions` :54, `assertStreamOptions` :466, `produce` :124, `racePending` :431)
- Modify: `src/server/stream-boundary.ts` (`PendingBoundary`, `createPendingBoundary`)
- Modify: `tests/unit/server/render-to-stream-out-of-order.test.ts` and `tests/unit/server/render-to-stream.test.ts`

- [ ] **Step 1: Write the failing tests (out-of-order file)**

```ts
it("keeps fallback and closes the stream when a boundary never settles past timeoutMs", async () => {
  const Hung = defineAsyncComponent({
    loader: () => new Promise(() => {}) as never,
    fallback: h("p", null, "loading…"),
  });
  const streamed = await collectStream(
    renderToStream(h(Fragment, null, [h("b", null, "ok"), h(Hung)]), {
      mode: "out-of-order",
      timeoutMs: 15,
    }),
  );
  expect(streamed).toContain("<b>ok</b>");
  expect(streamed).toContain("<p>loading…</p>");
  expect(streamed).toMatch(/so:b:1 failed:[^]*timed out after 15ms/);
  expect(streamed).not.toContain("so:r:1");
});

it("rejects invalid timeoutMs", () => {
  expect(() => renderToStream(h("p", null, "x"), { timeoutMs: 0 as never })).toThrow(
    TypeError("SSR streaming timeoutMs must be a positive number"),
  );
});
```

- [ ] **Step 2: Write the failing test (ordered, render-to-stream.test.ts — follow that file's existing collectStream import/use)**

```ts
it("errors the stream when the ordered source never settles past timeoutMs", async () => {
  const Hung = defineAsyncComponent(() => new Promise(() => {}) as never);
  const stream = renderToStream(h(Hung), { timeoutMs: 15 });
  await expect(
    (async () => {
      const reader = stream.getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) return;
      }
    })(),
  ).rejects.toThrow(/timed out after 15ms/);
});
```

- [ ] **Step 3: Run to verify failures**

```bash
pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server/render-to-stream.test.ts
```

Expected: the three new tests FAIL (unknown option TypeError).

- [ ] **Step 4: Implement**

1. `RenderToStreamOptions`: add `timeoutMs?: number;`; in `assertStreamOptions` add `assertTimeoutMs(options.timeoutMs, "SSR streaming")` and add `"timeoutMs"` to the unknown-key allowlist.
2. `stream-boundary.ts`: extend `createPendingBoundary(id, load, props, children, timeoutMs?: number)` — set `deadlineAt: timeoutMs === undefined ? null : Date.now() + timeoutMs` and add `deadlineAt: number | null` to `PendingBoundary`.
3. `render-to-stream.ts`:
   - `streamOutOfOrderBoundary` and `streamSuspenseBoundary` pass `options`-derived `timeoutMs` into `createPendingBoundary`. Thread `timeoutMs: number | undefined` through `StreamContext` (add field set in `createStreamContext`).
   - Source-phase guard (both modes): in `produce`, if `options.timeoutMs !== undefined`, compute `deadline = Date.now() + options.timeoutMs` and wrap `await nextPromise` (line ~168) with `raceWithTimeout(nextPromise, Math.max(deadline - Date.now(), 1), "streaming source")`; also wrap the router resolve await. On rejection the existing `catch` calls `controller.error` — ordered semantics satisfied.
   - Boundary-phase (out-of-order only): change `racePending(remaining)` to race each boundary's `ready` against its own `deadlineAt`:

```ts
function racePending(remaining: Set<PendingBoundary>): Promise<PendingBoundary> {
  return new Promise((resolve) => {
    for (const boundary of remaining) {
      const settle = () => resolve(boundary);
      void boundary.ready.then(settle, settle);
      if (boundary.deadlineAt !== null) {
        const wait = boundary.deadlineAt - Date.now();
        setTimeout(
          () => {
            if (boundary.error === null) {
              boundary.error = new SolaceTimeoutError(
                `SSR timed out after streaming boundary wait (boundary ${boundary.id})`,
              );
            }
            settle();
          },
          Math.max(wait, 0),
        );
      }
    }
  });
}
```

The existing `winner.error !== null` branch then emits the failure comment (message already `escapeHtml`ed) and the stream continues — exactly the loader-failure path.

- Note: once the source phase is past, the overall `options.timeoutMs` no longer applies in out-of-order mode; per-boundary deadlines govern (matches spec).

- [ ] **Step 5: Run both stream test files; all pass (old + new), then commit**

```bash
pnpm exec vitest run tests/unit/server/render-to-stream-out-of-order.test.ts tests/unit/server/render-to-stream.test.ts
git add src/server/render-to-stream.ts src/server/stream-boundary.ts tests/unit/server/
git commit -m "feat: add timeoutMs to renderToStream"
```

---

### Task 4: generateStaticSiteAsync timeoutMs

**Files:**

- Modify: `src/server/generate-static-site.ts` (`GenerateStaticSiteOptions` :39, async route loop :112, route validation :160)
- Modify: `tests/unit/server/generate-static-site-runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("rejects the build when a never-settling route exceeds site timeoutMs", async () => {
  const Hung: AsyncComponentType = () => new Promise(() => {}) as never;
  await expect(
    generateStaticSiteAsync({
      timeoutMs: 15,
      routes: [
        { path: "/ok", source: () => h("p", null, "ok") },
        { path: "/bad", source: Hung },
      ],
    }),
  ).rejects.toThrow(/timed out after 15ms/);
});

it("lets a route-level timeoutMs override the site default", async () => {
  const Hung: AsyncComponentType = () => new Promise(() => {}) as never;
  await expect(
    generateStaticSiteAsync({
      timeoutMs: 5000,
      routes: [{ path: "/bad", source: Hung, timeoutMs: 15 }],
    }),
  ).rejects.toThrow(/timed out after 15ms/);
});

it("rejects invalid timeoutMs at site and route level", async () => {
  await expect(
    generateStaticSiteAsync({
      timeoutMs: 0 as never,
      routes: [{ path: "/", source: () => h("p") }],
    }),
  ).rejects.toThrow(TypeError("SSR static site timeoutMs must be a positive number"));
  await expect(
    generateStaticSiteAsync({
      routes: [{ path: "/", source: () => h("p"), timeoutMs: -1 as never }],
    }),
  ).rejects.toThrow(TypeError("SSR static route timeoutMs must be a positive number"));
});
```

- [ ] **Step 2: Verify failure, then implement**

1. `GenerateStaticSiteOptions`: add `timeoutMs?: number;` (shared by sync type; sync entry ignores it like the sync renderer does). Async route record type: add `timeoutMs?: number`.
2. Validate site-level with `assertTimeoutMs(options.timeoutMs, "SSR static site")` and route-level with `assertTimeoutMs(route.timeoutMs, "SSR static route")` (inside `assertStaticRouteRecord` or the async loop's per-route asserts, following existing patterns; add `"timeoutMs"` to any route unknown-field rejection).
3. In the async loop, compute `const timeoutMs = route.timeoutMs ?? options.timeoutMs;` and pass it into both `renderToStringAsync` calls (`{ ..., timeoutMs }`, omit when undefined so option validation stays clean — build the options object conditionally).

- [ ] **Step 3: Run, pass, commit**

```bash
pnpm exec vitest run tests/unit/server/generate-static-site-runtime.test.ts
git add src/server/generate-static-site.ts tests/unit/server/generate-static-site-runtime.test.ts
git commit -m "feat: add timeoutMs to generateStaticSiteAsync"
```

---

### Task 5: Root export, package-exports test, docs, changeset

**Files:**

- Modify: `src/index.ts`, `tests/integration/package-exports.test.ts` (:86, :104)
- Modify: `readme.md`, `readme.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md` (API lists / capability sentences)
- Create: `.changeset/ssr-hang-guard.md`

- [ ] **Step 1: Export and lock**

`src/index.ts`: `export { SolaceTimeoutError } from "./server/ssr-timeout";` (check the existing re-export grouping convention first). `tests/integration/package-exports.test.ts`: add `SolaceTimeoutError: expect.any(Function)` to the root-entry shape and `"SolaceTimeoutError"` to the sorted export-name list. Also update Task 2's tests to import from `"../../../src"` if they used the server path.

- [ ] **Step 2: Docs**

- `readme.md` / `readme.zh-CN.md`: in the SSR/server API bullet lists, add one line each for `timeoutMs` (opt-in hang guard on the async SSR entries) and `SolaceTimeoutError` — match existing bullet style; keep both languages in sync.
- `docs/project-status.md` / `.zh-CN.md`: extend the SSR capability sentence with the opt-in timeout guard mention (one clause, both languages).

- [ ] **Step 3: Changeset**

```markdown
---
"@italone/solace": patch
---

Add an opt-in `timeoutMs` option to `renderToStringAsync()`, `renderToStream()`, and `generateStaticSiteAsync()` (site-level with route-level override) so never-settling async renders reject with the new root-exported `SolaceTimeoutError` instead of hanging. Out-of-order stream boundaries time out individually: the fallback is kept and a failure comment is emitted while the stream stays open.
```

- [ ] **Step 4: Full gates**

```bash
pnpm quality
```

Expected: exit 0 (includes contract check, package tests, formatting). Fix formatting with `pnpm exec prettier --write` if needed, then:

```bash
git add -A
git commit -m "feat: export SolaceTimeoutError and document SSR timeoutMs"
```

---

### Task 6 (verification only): honest behavior spot-check

- [ ] Run the full server suite plus integration: `pnpm exec vitest run tests/unit/server/ tests/integration/` — all green.
- [ ] Confirm no timer leak: the Task 1 leak test plus vitest's unhandled-rejection reporting cover this; if `pnpm quality` is green, done.
