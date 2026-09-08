# Keyed Reorder 性能优化设计（2026-09-08）

## 背景与问题

jsdom 基准 `10000 row keyed reorder`（`tests/performance/list-diff.bench.ts:170`，全量反转 10000 行）耗时 ~890ms，比其他所有 jsdom 场景高一个数量级（第二高为已知 DOM 瓶颈的 `10000 row delete` 212ms）。浏览器端同场景 reorder 仅 ~3ms，说明开销主要在 diff 算法本身的 JS 时间，而非 DOM 规模。

## 嫌疑热点

`src/renderer/children.ts` 的 `patchKeyedChildren` 移动阶段（第 288-338 行）从 `newEnd` 向 `newStart` 反向遍历，把待移动的既有节点用 `movedExistingBatch.unshift(childEl)` 收集（第 337 行）。`unshift` 是 O(k)，反转场景 LIS≈1 → 9999 次移动 → 约 5×10⁷ 次数组元素搬移，即 O(n²)。

## 方案（已选定：证据先行）

1. **Profile 证实**：用 `node --cpu-prof`（或 vitest 单任务隔离运行）对 `10000 row keyed reorder` 采样，确认热点在移动阶段收集逻辑；若指向别处（如匹配阶段的逐项 `patch`），按证据调整目标。
2. **修复**：`movedExistingBatch` 收集改 `push`（数组内为反序），`flushMovedExistingBatch` 在写 fragment 时正向 append，保证 fragment 内最终顺序与现状逐字节一致。注意批量路径 flush 后 `anchorNode` 应取"最靠前"的节点：现状是 `movedExistingBatch[0]`，改为 push 后是数组最后一个元素。O(n²) → O(n)。
3. **行为锁定**：新增/扩展单元测试，覆盖"多个既有节点连续移动时 fragment 内顺序与 anchor 语义"不变（含单元素路径与批量路径）。
4. **验证**：同会话 A-B 基准（±5% 噪声内不视为变化）：reorder 期望显著下降（>30%），其余 19 个 jsdom 场景不回退；`pnpm quality` 通过。

## 约束

- 不改公共 API/契约（frozen-contract-boundary 在案）。
- 不做无证据的重构；instrumentation（devtools 记录）行为不变。
- 基准诚实规则照旧：仅同会话比较有效，不做跨天对比声明。

## 成功标准

同会话 A-B 显示 `10000 row keyed reorder` 下降 >30%（排除 ±5% 噪声），其余场景无回退，全部质量门通过。若 profile 证明 jsdom DOM 占主因导致无法达标，如实记录并停止（与 09-03 delete 场景处理一致）。
