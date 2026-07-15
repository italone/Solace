# 阶段 4：调度器与状态管理

## 目标

通过调度器减少重复渲染，并提供第一版轻量 store。

## 执行文件

1. [`step-01-scheduler-nexttick.md`](./step-01-scheduler-nexttick.md)
2. [`step-02-store.md`](./step-02-store.md)

## 阶段验收

- 同一 tick 内重复状态变更只触发一次组件更新。
- `nextTick` 可以等待 DOM 更新完成。
- store 支持 state、actions 和派生状态。
