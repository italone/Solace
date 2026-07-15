# Renderer Keyed Children LIS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce unnecessary DOM moves in keyed children diff by using LIS to preserve stable keyed nodes.

**Architecture:** Keep the current prefix/suffix sync and keyed/unkeyed fallback rules. In the keyed unique-key middle segment,
build an old-index map, compute the LIS of matched nodes, and only move nodes that are not part of that subsequence.

**Tech Stack:** TypeScript, Vitest, jsdom, Node DOM APIs, Markdown, Prettier.

---

## File Structure

- Modify `tests/unit/renderer/diff.test.ts`: add a focused reorder test that measures `insertBefore` calls.
- Modify `src/renderer/diff.ts`: implement LIS-based keyed middle diff.
- Modify `docs/architecture.md`: note that keyed children now use LIS optimization.
- Add `docs/superpowers/specs/2026-07-15-renderer-keyed-children-lis-design.md`: record the design.
- Add `solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md`: record the change.
- Modify `solace-project-log/index.md`: add the `2026-07-15` `006` row.

No package export map, public API, devtools payload, or unkeyed diff semantics should change.

---

### Task 1: Add The Failing Renderer Test

**Files:**

- Modify: `tests/unit/renderer/diff.test.ts`

- [ ] **Step 1: Add a move-counting keyed reorder test**

Add this test near the existing keyed-children cases:

```ts
  it("minimizes DOM moves for keyed reorders with a stable subsequence", () => {
    const container = document.createElement("div");
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore");

    render(
      h("ul", null, [
        h("li", { key: "a" }, "A"),
        h("li", { key: "b" }, "B"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "e" }, "E"),
      ]),
      container,
    );

    insertBefore.mockClear();

    const before = new Map([...container.querySelectorAll("li")].map((li) => [li.textContent, li]));

    render(
      h("ul", null, [
        h("li", { key: "b" }, "B"),
        h("li", { key: "a" }, "A"),
        h("li", { key: "d" }, "D"),
        h("li", { key: "c" }, "C"),
        h("li", { key: "e" }, "E"),
      ]),
      container,
    );

    const after = [...container.querySelectorAll("li")];

    expect(after.map((li) => li.textContent)).toEqual(["B", "A", "D", "C", "E"]);
    expect(after[0]).toBe(before.get("b"));
    expect(after[1]).toBe(before.get("a"));
    expect(after[2]).toBe(before.get("d"));
    expect(after[3]).toBe(before.get("c"));
    expect(after[4]).toBe(before.get("e"));
    expect(insertBefore).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: fails because the current keyed diff moves every keyed child in the middle segment and makes more than two
`insertBefore` calls for this reorder.

---

### Task 2: Implement LIS-Based Keyed Diff

**Files:**

- Modify: `src/renderer/diff.ts`

- [ ] **Step 1: Add keyed index tracking and LIS helper**

Extend `patchKeyedChildren` so the keyed unique-key middle segment records the matched old index for each new child.
Add a small LIS helper that returns the positions of the stable subsequence in the middle segment.

- [ ] **Step 2: Move only non-LIS nodes**

After patching/mounting and unmounting unmatched nodes, walk the middle segment from right to left. Mount new nodes at
their anchor and move existing nodes only when their position is not part of the LIS.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0 and the keyed reorder test reports two `insertBefore` calls.

---

### Task 3: Update Architecture And Logs

**Files:**

- Modify: `docs/architecture.md`
- Add: `solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md`
- Modify: `solace-project-log/index.md`

- [ ] **Step 1: Update architecture docs**

Change the keyed children sentence from:

```md
Children diff currently favors correctness and DOM reuse. Keyed children support insert, delete, move, and patch. The implementation does not yet include LIS optimization.
```

to:

```md
Children diff favors correctness and DOM reuse. Keyed children support insert, delete, move, and patch, and the
keyed-middle path uses LIS optimization to avoid unnecessary DOM moves.
```

- [ ] **Step 2: Add the project log entry**

Create `solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md` with the observed validation
results after final checks.

- [ ] **Step 3: Update the project log index**

Add this row after `005` in the `2026-07-15` section:

```md
| 006  | 优化 keyed children diff 的 DOM move | renderer diff、LIS、单元测试、架构文档、项目日志 | `src/renderer/diff.ts`, `tests/unit/renderer/diff.test.ts`, `docs/architecture.md`, `solace-project-log/**` | [查看](./solace-entries/2026-07-15-006-renderer-keyed-children-lis.md) |
```

---

### Task 4: Final Validation

**Files:**

- All changed files

- [ ] **Step 1: Format changed files**

Run:

```bash
pnpm exec prettier --write src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/architecture.md docs/superpowers/specs/2026-07-15-renderer-keyed-children-lis-design.md docs/superpowers/plans/2026-07-15-renderer-keyed-children-lis.md solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md solace-project-log/index.md
```

Expected: exits with code 0.

- [ ] **Step 2: Run targeted renderer tests**

Run:

```bash
pnpm exec vitest run tests/unit/renderer/diff.test.ts
```

Expected: exits with code 0.

- [ ] **Step 3: Run full tests**

Run:

```bash
pnpm test
```

Expected: exits with code 0.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exits with code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run build**

Run:

```bash
pnpm build
```

Expected: exits with code 0.

- [ ] **Step 7: Run format check**

Run:

```bash
pnpm format:check
```

Expected: exits with code 0.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/renderer/diff.ts tests/unit/renderer/diff.test.ts docs/architecture.md docs/superpowers/specs/2026-07-15-renderer-keyed-children-lis-design.md docs/superpowers/plans/2026-07-15-renderer-keyed-children-lis.md solace-project-log/solace-entries/2026-07-15-006-renderer-keyed-children-lis.md solace-project-log/index.md
git commit -m "perf: minimize keyed child DOM moves"
```

Expected: creates a commit after validation passes.
