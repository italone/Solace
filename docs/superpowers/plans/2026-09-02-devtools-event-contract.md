# DevTools Event Contract Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the DevTools event contract with router navigation events, a scheduler stale-job signal, a versioned handshake, and a narrow reactivity→update correlation id.

**Architecture:** All contract changes live in `src/devtools/events.ts` (types + serialization). Emission is added at existing `hasDevtoolsListeners()`-guarded sites in `src/router/router.ts`, `src/scheduler/scheduler.ts`, and `src/reactivity/effect.ts`. Correlation uses a module-level counter in events.ts plus a `WeakMap<job, id>` cause registry in the scheduler; `SchedulerJob` gains an optional `false` return meaning "skipped as stale". The example panel gains the `router` family, correlation display, and a `contractVersion` handshake field.

**Tech Stack:** TypeScript, vitest + happy-dom, Playwright e2e, existing Solace conventions.

---

### Task 1: Contract types, serialization, correlation counter, version constant

**Files:**

- Modify: `src/devtools/events.ts`
- Test: `tests/unit/devtools/devtools-events.test.ts` (extend)

- [ ] **Step 1: Write failing tests** — extend the existing suite: `router:navigation` serializes to exactly `{ type, to, from, status }`; `reactivity:trigger` serialization includes `correlationId`; `component:update` serialization passes through optional `correlationId` when present and omits-clean when absent (serialized object has no `correlationId` key when input lacks one — assert with `"correlationId" in result === false`); `scheduler:flush` serialization includes `skippedStaleJobs` and `distinctCauses`; new export `nextDevtoolsCorrelationId()` returns increasing integers and does NOT advance when called zero times (pure counter); new export `DEVTOOLS_CONTRACT_VERSION` equals 1.

- [ ] **Step 2: Verify failure** — `pnpm vitest run tests/unit/devtools/devtools-events.test.ts` FAIL.

- [ ] **Step 3: Implement** in `src/devtools/events.ts`:
  - Add to the union:
    ```ts
    | {
        type: "router:navigation";
        to: string;
        from: string;
        status: "start" | "success" | "redirect" | "error" | "cancelled";
      }
    ```
  - `reactivity:trigger` gains `correlationId: number`.
  - `component:update` gains `correlationId?: number` (optional on the input type; serialization copies it only when present).
  - `scheduler:flush` gains `skippedStaleJobs: number; distinctCauses: number`.
  - Export `const DEVTOOLS_CONTRACT_VERSION = 1 as const;`
  - Export a counter:
    ```ts
    let correlationCounter = 0;
    export function nextDevtoolsCorrelationId(): number {
      correlationCounter += 1;
      return correlationCounter;
    }
    ```
  - Extend every branch of `serializeDevtoolsEvent` for the new fields; `component:update` branch conditionally spreads correlationId (`...(event.type === "component:update" && event.correlationId !== undefined ? { correlationId: event.correlationId } : {})` or an explicit conditional construction — keep it simple and type-safe).

- [ ] **Step 4: Run** — `pnpm vitest run tests/unit/devtools` PASS.

- [ ] **Step 5: Commit** — `git add src/devtools/events.ts tests/unit/devtools/devtools-events.test.ts && git commit -m "feat: extend DevTools event contract types and serialization"`

### Task 2: Router navigation emission

**Files:**

- Modify: `src/router/router.ts`
- Test: `tests/unit/router/router-devtools.test.ts`

- [ ] **Step 1: Write failing tests** — subscribe via `onDevtoolsEvent` (from `src/devtools/events`), run navigations with `createRouter({ history: createMemoryHistory("/"), routes })` + `router.push(...)`/`await router.isReady()`, collect events, assert sequences:
  - successful push `/`→`/about`: events include `start` (to "/about") then `success` (to "/about", from "/")
  - record redirect `/b`→`/c`: a single `redirect` event with to "/c", from "/b" (plus the initial settlement events for "/" if listening from construction — subscribe BEFORE creating the router and account for the initial `success`)
  - guard returning false: `cancelled`
  - unknown route / guard throwing: `error`
  - no listener → zero overhead path can't be asserted directly; assert emission only happens via emitDevtoolsEvent guard by checking no events leak after unsubscribing
  - payload is fullPath strings only (no params object in any emitted event)

- [ ] **Step 2: Verify failure** — FAIL (no events).

- [ ] **Step 3: Implement** in `src/router/router.ts`:
  - Import `emitDevtoolsEvent, hasDevtoolsListeners` from `../devtools/events`.
  - In `navigate()` and `startInitialSettlement()`: at start (after `resolveLocation(to)`), if guarded, emit `{ type: "router:navigation", to: initial.fullPath, from: from.fullPath, status: "start" }`. On success emit `status: "success"` with `to: finalRoute.fullPath`. When the landing route differs from the initial target due to redirects (`finalRoute.fullPath !== initial.fullPath` and state.redirectedFrom !== undefined or resolveRedirects followed), emit `status: "redirect"` instead of `success`. `finalRoute === false` → `status: "cancelled"`. Caught navigation error → `status: "error"`. Keep it to at most one terminal event per navigation (start + exactly one terminal).
  - Factor a tiny local helper `emitNavigationEvent(to, from, status)` gated on `hasDevtoolsListeners()` to avoid duplication.

- [ ] **Step 4: Run** — `pnpm vitest run tests/unit/router tests/unit/server` PASS (SSR router paths must not emit when no listeners — they never create listeners, so fine).

- [ ] **Step 5: Commit** — `git commit -m "feat: emit router navigation DevTools events"` with the router + test files.

### Task 3: Scheduler stale-skip signal, cause registry, distinctCauses

**Files:**

- Modify: `src/scheduler/scheduler.ts`
- Modify: every `SchedulerJob` producer that can early-return as stale (grep `queueJob` call sites — primarily the component update jobs in `src/renderer/renderer.ts`/`hydration.ts`/`src/component/*`)
- Test: `tests/unit/scheduler/scheduler-devtools.test.ts`

- [ ] **Step 1: Write failing tests**:
  - flush with a job returning `false` reports `skippedStaleJobs: 1` and still counts it in queuedJobs
  - flush with normal void jobs reports `skippedStaleJobs: 0`, `distinctCauses: 0`
  - cause registry: `setJobCause(job, 7)` then flush reports `distinctCauses: 1` and `takeJobCause(job)` returns 7 before the job runs (or after — define the API: `associateJobCause(job, id)` / cause consumed at flush; assert `distinctCauses` counts unique ids across the flush, two jobs with same id → 1, different ids → 2)
  - registry is cleaned after flush (WeakMap entry removed — assert via takeJobCause returning undefined after flush... WeakMap observability: expose `peekJobCause(job)` for tests)
  - flush event still emitted when queue empty is NOT changed (current behavior unchanged)
  - stale-skip via component path: hydrate a component whose update job goes stale (renderer job early-returns) — assert via unit-level: call the exported behavior the renderer uses (if the skip signal is internal, test at scheduler level only and one integration assertion in Task 5's suite)

- [ ] **Step 2: Verify failure** — FAIL.

- [ ] **Step 3: Implement** in `src/scheduler/scheduler.ts`:

  ```ts
  export type SchedulerJob = () => void | false;
  const jobCauses = new WeakMap<SchedulerJob, number>();

  export function associateJobCause(job: SchedulerJob, correlationId: number): void {
    jobCauses.set(job, correlationId);
  }
  export function peekJobCause(job: SchedulerJob): number | undefined {
    return jobCauses.get(job);
  }
  ```

  In `flushJobs`: track `skippedStaleJobs` (job() returned `=== false`), collect causes (`const causes = new Set<number>(); const cause = jobCauses.get(job); if (cause !== undefined) causes.add(cause); jobCauses.delete(job)` per job), emit `skippedStaleJobs` and `distinctCauses: causes.size`. Both counters reset per flush like dedupedJobs.
  Update stale early-return sites in component update jobs to `return false;` — find them by grepping queueJob producers for early `return;` inside update functions guarded by `isUnmounted`/stale checks (e.g. renderer.ts `job()`, hydration componentUpdate first-run return is NOT stale — only genuinely-skipped paths return false; when in doubt leave void and note it).

- [ ] **Step 4: Run** — `pnpm vitest run tests/unit/scheduler tests/unit/renderer tests/integration` PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: scheduler stale-job and cause signals for DevTools"`.

### Task 4: Reactivity correlation + component:update correlationId

**Files:**

- Modify: `src/reactivity/effect.ts` (trigger emit + cause association)
- Modify: `src/component/component.ts` or wherever the component update job is queued for instances (grep `queueJob(instance.update` / `queueJob(job)` in renderer/hydration/component)
- Test: `tests/unit/reactivity/devtools-correlation.test.ts`

- [ ] **Step 1: Write failing tests**:
  - with a listener attached: a reactive write that schedules a component update produces `reactivity:trigger` with correlationId N, then a `component:update` with the SAME correlationId N (use a real component render via `render()` + reactive state, mirror existing reactivity devtools tests — grep `reactivity:trigger` in tests)
  - without scheduled component (bare effect run): trigger has correlationId, no component:update follows
  - no listener → no ids allocated (unsubscribable: after unsubscribe, subsequent events don't reach recorder — existing behavior; assert recorder snapshot lacks new events)
  - correlationId strictly increases across triggers

- [ ] **Step 2: Verify failure** — FAIL.

- [ ] **Step 3: Implement**:
  - `src/reactivity/effect.ts` trigger emit site (~line 125): when `hasDevtoolsListeners()`, allocate `const correlationId = nextDevtoolsCorrelationId();` BEFORE emitting, include it in the `reactivity:trigger` payload, and after computing the jobs/effects to schedule, associate the cause: for each scheduler job queued from this trigger call `associateJobCause(job, correlationId)`. READ the surrounding code first — the trigger path may schedule effects, not jobs directly; if the job queuing happens inside effect scheduler callbacks (component update functions), associate the cause at the point where `queueJob` receives the job by wrapping: e.g. in the ReactiveEffect scheduler callback path in component setup, before `queueJob(instance.update)`, do `if (peekJobCause(instance.update) === undefined && lastTriggerCorrelationId !== undefined) associateJobCause(instance.update, lastTriggerCorrelationId)` — use a module-level `lastTriggerCorrelationId` exported from events.ts (set only when listeners exist; cleared/undefined otherwise). Keep the hot path listener-free: all cause work gated on `hasDevtoolsListeners()`.
  - `component:update` emission site (src/component/component.ts:233): include `correlationId: peekJobCause(currentUpdateJob)` when the currently-running update job has a cause. The emission happens during the update job run — capture the cause at the start of the update run. Read the code and thread minimally; the update function knows itself.

- [ ] **Step 4: Run** — `pnpm vitest run tests/unit` PASS (full unit — correlation touches core paths).

- [ ] **Step 5: Commit** — `git commit -m "feat: correlate reactivity triggers with component updates in DevTools"`.

### Task 5: Extension panel — router family, correlation display, versioned handshake

**Files:**

- Modify: `examples/devtools-extension/src/panel/state.ts` (families, summaries, detail derivation)
- Modify: `examples/devtools-extension/src/panel/transport.ts` (connect message `contractVersion: DEVTOOLS_CONTRACT_VERSION`, bridge ack)
- Modify: `examples/devtools-extension/src/panel/components.tsx` / `app.ts` (router family UI label, correlation display "related trigger #n")
- Modify: `examples/devtools-extension/src/bridge.ts` (ack contractVersion)
- Test: `tests/unit/devtools-extension/state.test.ts`, `transport.test.ts` (extend); possibly `tests/integration/devtools-extension-bridge.test.ts`

- [ ] **Step 1: Write failing tests** — panel state: router family filter exists and router:navigation events land in the timeline with to/from/status rendered; summaries count router navigations; transport: connect message includes `contractVersion: 1` and bridge ack echoes it; detail: component:update with correlationId renders "related trigger #N".

- [ ] **Step 2: Verify failure** — FAIL.

- [ ] **Step 3: Implement** — follow the existing family/filter/summary patterns in state.ts (families list at line 3, TimelineFilter at 7-9, summaries at 276). Import DEVTOOLS_CONTRACT_VERSION from the package source path used by other extension imports (check how the extension imports runtime code — likely relative into ../../../src or via the built package; mirror existing imports).

- [ ] **Step 4: Run** — `pnpm vitest run tests/unit/devtools-extension tests/integration/devtools-extension-bridge.test.ts` PASS. Then e2e: `pnpm test:e2e:devtools-extension` PASS (5 passed baseline; may gain assertions — extend the spec to cover router events in timeline if the existing spec pattern makes it cheap).

- [ ] **Step 5: Commit** — `git commit -m "feat: router family, correlation display, and versioned handshake in DevTools extension"`.

### Task 6: Docs, changeset, payload stability, full gates

**Files:**

- Modify: `docs/devtools.md` (event table + versioning section), `docs/api.md` + `docs/api.zh-CN.md` DevTools sections, `docs/roadmap.md` item 8
- Modify: `tests/integration/devtools-payload-stability.test.ts` (lock new fields), `tests/unit/devtools/devtools-docs.test.ts` (doc/code sync — it will drive docs wording)
- Create: `.changeset/devtools-event-contract.md`

- [ ] **Step 1: Update payload-stability test** to lock the new field sets (router:navigation {type,to,from,status}; scheduler:flush +skippedStaleJobs,distinctCauses; reactivity:trigger +correlationId; component:update optional correlationId).

- [ ] **Step 2: Docs** — docs/devtools.md: add router:navigation to the event table with payload semantics (fullPath summaries only, single terminal event per navigation, redirect = final landing), document skippedStaleJobs/distinctCauses, correlationId semantics (absent = no known cause, never fabricated), and a "Contract versioning" section: current version 1, additive-field evolution rule, handshake field. api.md/api.zh-CN.md DevTools sections mirror concisely. roadmap item 8 updated honestly.

- [ ] **Step 3: Changeset**:

```markdown
---
"@italone/solace": minor
---

Extend the DevTools event contract (version 1, additive): new `router:navigation` events (start/success/redirect/error/cancelled with fullPath summaries), `scheduler:flush` gains `skippedStaleJobs` and `distinctCauses`, `reactivity:trigger` gains `correlationId` and `component:update` optionally carries the matching id so triggers can be linked to the updates they caused. The example DevTools panel gains the router family, correlation display, and a versioned panel handshake (`contractVersion`).
```

- [ ] **Step 4: Gates** — `pnpm quality` PASS; `pnpm release:check` PASS (includes devtools e2e + docs sync tests).

- [ ] **Step 5: Commit and push** — `git commit -m "docs: DevTools event contract extension docs and changeset"` then `git push`.
