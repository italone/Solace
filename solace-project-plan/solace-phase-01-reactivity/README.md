# 阶段 1：响应式核心

## 目标

实现框架最基础的数据驱动能力，让状态变化可以触发依赖更新。

## 执行文件

1. [`step-01-reactive-effect.md`](./step-01-reactive-effect.md)
2. [`step-02-computed-watch.md`](./step-02-computed-watch.md)

## 阶段验收

- `reactive` 能代理对象并跟踪属性读取。
- `effect` 能在依赖变更时重新执行。
- `computed` 具备缓存和失效能力。
- `watch` 能监听响应式数据变化并提供新旧值。
