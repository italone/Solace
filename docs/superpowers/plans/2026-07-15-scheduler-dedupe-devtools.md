# Scheduler Dedupe DevTools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `dedupedJobs` to `scheduler:flush` DevTools summaries so tooling can see duplicate queue attempts without exposing scheduler job references.

**Architecture:** Extend the `scheduler:flush` event union and serializer with a scalar `dedupedJobs` field. Track duplicate queue attempts inside `queueJob()` only when DevTools listeners exist, emit the count from `flushJobs()`, and reset it in the existing `finally` cleanup path. Update scheduler tests, payload stability tests, DevTools docs, project logs, and commit the implementation.

**Tech Stack:** TypeScript, Solace scheduler, internal DevTools event bus, Vitest, Markdown, Prettier, Git.

---

## File Structure

- Modify `tests/unit/scheduler/scheduler.test.ts`: add RED tests for duplicate queue attempts before a flush and self-queue attempts during a flush; update the existing flush summary expectation.
- Modify `tests/integration/devtools-payload-stability.test.ts`: allow the new scalar `dedupedJobs` key for scheduler flush events.
- Modify `src/devtools/events.ts`: add `dedupedJobs` to the `scheduler:flush` event union and serializer branch.
- Modify `src/scheduler/scheduler.ts`: track deduped queue attempts only when DevTools listeners exist and reset after each flush.
- Modify `docs/devtools.md`: document the new scheduler payload shape and roadmap wording.
- Add `solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md`: record this change after validation.
- Modify `solace-project-log/index.md`: add the `2026-07-15` `004` row after validation.
- Add `docs/superpowers/plans/2026-07-15-scheduler-dedupe-devtools.md`: record this implementation plan.

---

### Task 1: Add Failing Scheduler Dedupe Tests

**Files:**

- Modify: `tests/unit/scheduler/scheduler.test.ts`

- [ ] **Step 1: Update the existing scheduler flush summary test**

In `"emits a devtools summary after flushing queued jobs"`, add `dedupedJobs: 0` to the `toMatchObject()` assertion:

```ts
expect(events[0]).toMatchObject({
  type: "scheduler:flush",
  queuedJobs: 2,
  dedupedJobs: 0,
});
```

- [ ] **Step 2: Add a duplicate-before-flush test**

Add this test after `"emits a devtools summary after flushing queued jobs"`:

```ts
it("counts duplicate queued jobs in devtools flush summaries", async () => {
  const events: DevtoolsEvent[] = [];
  const job = vi.fn();

  onDevtoolsEvent((event) => {
    events.push(event);
  });

  queueJob(job);
  queueJob(job);

  await nextTick();

  expect(job).toHaveBeenCalledTimes(1);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "scheduler:flush",
    queuedJobs: 1,
    dedupedJobs: 1,
  });
});
```

- [ ] **Step 3: Add a self-queue-during-flush test**

Add this test after the duplicate-before-flush test:

```ts
it("counts jobs deduped during the current flush in devtools summaries", async () => {
  const events: DevtoolsEvent[] = [];
  const calls: string[] = [];
  const job = () => {
    calls.push("job");
    queueJob(job);
  };

  onDevtoolsEvent((event) => {
    events.push(event);
  });

  queueJob(job);

  await nextTick();

  expect(calls).toEqual(["job"]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "scheduler:flush",
    queuedJobs: 1,
    dedupedJobs: 1,
  });
});
```

- [ ] **Step 4: Verify RED for scheduler tests**

Run:

```bash
pnpm test -- tests/unit/scheduler/scheduler.test.ts
```

Expected: fails because `scheduler:flush` does not include `dedupedJobs` yet.

---

### Task 2: Add Failing Payload Stability Coverage

**Files:**

- Modify: `tests/integration/devtools-payload-stability.test.ts`

- [ ] **Step 1: Add `dedupedJobs` to allowed scheduler keys**

Replace:

```ts
  "scheduler:flush": ["durationMs", "queuedJobs", "type"],
```

with:

```ts
  "scheduler:flush": ["dedupedJobs", "durationMs", "queuedJobs", "type"],
```

- [ ] **Step 2: Verify RED for payload stability**

Run:

```bash
pnpm test -- tests/integration/devtools-payload-stability.test.ts
```

Expected: fails because serialized `scheduler:flush` events do not include `dedupedJobs` yet.

---

### Task 3: Implement The DevTools Event Type And Serializer

**Files:**

- Modify: `src/devtools/events.ts`

- [ ] **Step 1: Add `dedupedJobs` to the event union**

Replace:

```ts
  | { type: "scheduler:flush"; queuedJobs: number; durationMs: number }
```

with:

```ts
  | { type: "scheduler:flush"; queuedJobs: number; dedupedJobs: number; durationMs: number }
```

- [ ] **Step 2: Add `dedupedJobs` to serialization**

In the `case "scheduler:flush"` branch, replace:

```ts
return {
  type: event.type,
  queuedJobs: event.queuedJobs,
  durationMs: event.durationMs,
};
```

with:

```ts
return {
  type: event.type,
  queuedJobs: event.queuedJobs,
  dedupedJobs: event.dedupedJobs,
  durationMs: event.durationMs,
};
```

- [ ] **Step 3: Verify TypeScript exposes runtime callsites**

Run:

```bash
pnpm typecheck
```

Expected: fails in scheduler code because `emitDevtoolsEvent({ type: "scheduler:flush", ... })` does not provide `dedupedJobs` yet.

---

### Task 4: Track And Emit Guarded Dedupe Counts

**Files:**

- Modify: `src/scheduler/scheduler.ts`

- [ ] **Step 1: Add scheduler dedupe state**

After:

```ts
let currentFlushPromise: Promise<void> | null = null;
```

add:

```ts
let dedupedJobs = 0;
```

- [ ] **Step 2: Count duplicate queue attempts only when listeners exist**

Replace:

```ts
if (queuedJobs.has(job)) {
  return;
}
```

with:

```ts
if (queuedJobs.has(job)) {
  if (hasDevtoolsListeners()) {
    dedupedJobs += 1;
  }
  return;
}
```

- [ ] **Step 3: Include `dedupedJobs` in the flush event**

In `flushJobs()`, replace:

```ts
emitDevtoolsEvent({
  type: "scheduler:flush",
  queuedJobs: flushedJobs,
  durationMs: Math.max(0, now() - startedAt),
});
```

with:

```ts
emitDevtoolsEvent({
  type: "scheduler:flush",
  queuedJobs: flushedJobs,
  dedupedJobs,
  durationMs: Math.max(0, now() - startedAt),
});
```

- [ ] **Step 4: Reset the counter after every flush**

In the `finally` block, after:

```ts
queuedJobs.clear();
```

add:

```ts
dedupedJobs = 0;
```

The cleanup block should end as:

```ts
queue.length = 0;
queuedJobs.clear();
dedupedJobs = 0;
currentFlushPromise = null;
```

- [ ] **Step 5: Verify scheduler tests are GREEN**

Run:

```bash
pnpm test -- tests/unit/scheduler/scheduler.test.ts
```

Expected: exits with code 0 and the scheduler tests pass.

- [ ] **Step 6: Verify payload stability is GREEN**

Run:

```bash
pnpm test -- tests/integration/devtools-payload-stability.test.ts
```

Expected: exits with code 0 and the payload stability test passes.

---

### Task 5: Update DevTools Documentation

**Files:**

- Modify: `docs/devtools.md`

- [ ] **Step 1: Update the documented event union**

In the documented `DevtoolsEvent` union, replace:

```ts
  | { type: "scheduler:flush"; queuedJobs: number; durationMs: number }
```

with:

```ts
  | { type: "scheduler:flush"; queuedJobs: number; dedupedJobs: number; durationMs: number }
```

- [ ] **Step 2: Add scheduler privacy wording**

After the `component:emit` summary paragraph, add:

```md
`scheduler:flush` summaries include executed job count, deduped queue attempt count, and flush duration only. They do
not include scheduler job functions, function names, stack traces, component instances, reactive effects, VNodes, DOM
nodes, or user data.
```

- [ ] **Step 3: Update the roadmap scheduler wording**

Replace:

```md
3. **Scheduler flush summary**: `scheduler:flush` is emitted after queued scheduler jobs flush.
```

with:

```md
3. **Scheduler flush and dedupe summary**: `scheduler:flush` reports executed jobs, deduped queue attempts, and duration.
```

- [ ] **Step 4: Format DevTools docs**

Run:

```bash
pnpm exec prettier --write docs/devtools.md
```

Expected: exits with code 0.

---

### Task 6: Add Project Log

**Files:**

- Add: `solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Add project log entry after validation commands have run**

Create `solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md` with this structure, replacing validation rows with observed command results from Task 7:

```md
# 2026-07-15-004：补充 scheduler dedupe DevTools summary

## 基本信息

- 日期：2026-07-15
- 类型：DevTools runtime hook / scheduler / payload stability / 文档
- 状态：已完成
- 关联提交：待补充

## 变动摘要

扩展 `scheduler:flush` DevTools summary，新增 `dedupedJobs` 标量字段，用于记录同一 flush 周期内被 scheduler 去重跳过的 queue attempts。payload 不包含 scheduler job 函数、函数名、调用栈、component instance、reactive effect、VNode、DOM 或用户数据。

## 变动原因

DevTools 文档已将 scheduler 的 queued jobs、flush duration 和 skipped stale jobs 列为有用信号。现有 `scheduler:flush` 仅记录实际执行 job 数和耗时，本次补充 dedupe count，帮助调试重复调度，同时保持 payload summary-only。

## 影响范围

- 影响模块：scheduler runtime、DevTools event union、DevTools serializer、scheduler 单元测试、payload stability 集成测试、DevTools 文档、项目日志。
- 行为变化：存在 DevTools listener 时，重复 queue attempts 会计入 `dedupedJobs` 并随 `scheduler:flush` 派发；无 listener 时保持轻量路径。
- 风险等级：中；涉及 scheduler 热路径，但只在 duplicate branch 中做 listener guard 和计数。

## 涉及文件

| 文件                                                                            | 动作 | 说明                                  |
| ------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| `src/scheduler/scheduler.ts`                                                    | 修改 | 统计并派发 guarded dedupe summary     |
| `src/devtools/events.ts`                                                        | 修改 | 扩展 `scheduler:flush` 类型和序列化   |
| `tests/unit/scheduler/scheduler.test.ts`                                        | 修改 | 覆盖 deduped jobs summary             |
| `tests/integration/devtools-payload-stability.test.ts`                          | 修改 | 验证 scheduler payload allowed fields |
| `docs/devtools.md`                                                              | 修改 | 记录 scheduler dedupe summary 边界    |
| `docs/superpowers/specs/2026-07-15-scheduler-dedupe-devtools-design.md`         | 新增 | 记录设计                              |
| `docs/superpowers/plans/2026-07-15-scheduler-dedupe-devtools.md`                | 新增 | 记录实施计划                          |
| `solace-project-log/index.md`                                                   | 修改 | 追加 2026-07-15 日志索引              |
| `solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md` | 新增 | 记录本次变更                          |

## 验证记录

| 验证项            | 命令或方式                                                                                                 | 结果 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| Targeted tests    | `pnpm test -- tests/unit/scheduler/scheduler.test.ts tests/integration/devtools-payload-stability.test.ts` | 通过 |
| Tests             | `pnpm test`                                                                                                | 通过 |
| Typecheck         | `pnpm typecheck`                                                                                           | 通过 |
| JSX dev typecheck | `pnpm typecheck:jsxdev`                                                                                    | 通过 |
| Lint              | `pnpm lint`                                                                                                | 通过 |
| Build             | `pnpm build`                                                                                               | 通过 |
| 格式检查          | `pnpm format:check`                                                                                        | 通过 |

## 后续动作

- 后续 scheduler DevTools 扩展应继续只暴露 summary scalar，不暴露 job 函数或 runtime references。
- 可继续评估 renderer diff count 或 scheduler error summary。
```

- [ ] **Step 2: Add log index row**

Under `## 2026-07-15` in `solace-project-log/index.md`, add this row after `003`:

```md
| 004 | 补充 scheduler dedupe DevTools summary | scheduler、DevTools payload、文档、项目日志 | `src/scheduler/scheduler.ts`, `src/devtools/events.ts`, `tests/unit/scheduler/scheduler.test.ts`, `tests/integration/devtools-payload-stability.test.ts`, `docs/devtools.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md) |
```

- [ ] **Step 3: Format log files**

Run:

```bash
pnpm exec prettier --write solace-project-log/index.md solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md docs/superpowers/plans/2026-07-15-scheduler-dedupe-devtools.md
```

Expected: exits with code 0.

---

### Task 7: Final Validation

**Files:**

- All touched files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test -- tests/unit/scheduler/scheduler.test.ts tests/integration/devtools-payload-stability.test.ts
```

Expected: exits with code 0.

- [ ] **Step 2: Run default tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 3: Run TypeScript checks**

Run:

```bash
pnpm typecheck
pnpm typecheck:jsxdev
```

Expected: both commands exit with code 0.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 5: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 6: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

---

### Task 8: Commit Implementation

**Files:**

- All touched files.

- [ ] **Step 1: Check status**

Run:

```bash
git status --short
```

Expected: only files touched by this plan are modified or added.

- [ ] **Step 2: Stage and commit**

Run:

```bash
git add src/scheduler/scheduler.ts src/devtools/events.ts tests/unit/scheduler/scheduler.test.ts tests/integration/devtools-payload-stability.test.ts docs/devtools.md docs/superpowers/plans/2026-07-15-scheduler-dedupe-devtools.md solace-project-log/index.md solace-project-log/solace-entries/2026-07-15-004-scheduler-dedupe-devtools.md
git commit -m "feat: add scheduler dedupe devtools summary"
```

Expected: commit succeeds.
