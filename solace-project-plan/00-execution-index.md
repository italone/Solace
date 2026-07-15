# 执行顺序索引

## 总体依赖

```text
solace-phase-00-foundation
  -> solace-phase-01-reactivity
  -> solace-phase-04-scheduler-store/step-01-scheduler-nexttick
  -> solace-phase-02-renderer
  -> solace-phase-03-components-events
  -> solace-phase-04-scheduler-store/step-02-store
  -> solace-phase-05-compiler-tooling
  -> solace-phase-06-quality-release
```

## 阶段 0：项目基础设施

1. [`solace-phase-00-foundation/step-01-create-workspace.md`](./solace-phase-00-foundation/step-01-create-workspace.md)
2. [`solace-phase-00-foundation/step-02-configure-tooling.md`](./solace-phase-00-foundation/step-02-configure-tooling.md)
3. [`solace-phase-00-foundation/step-03-quality-and-ci.md`](./solace-phase-00-foundation/step-03-quality-and-ci.md)

## 阶段 1：响应式核心

1. [`solace-phase-01-reactivity/step-01-reactive-effect.md`](./solace-phase-01-reactivity/step-01-reactive-effect.md)
2. [`solace-phase-01-reactivity/step-02-computed-watch.md`](./solace-phase-01-reactivity/step-02-computed-watch.md)

## 阶段 2：VNode 与渲染器

1. [`solace-phase-02-renderer/step-01-vnode-h-render.md`](./solace-phase-02-renderer/step-01-vnode-h-render.md)
2. [`solace-phase-02-renderer/step-02-dom-renderer-diff.md`](./solace-phase-02-renderer/step-02-dom-renderer-diff.md)

## 阶段 3：组件与事件

1. [`solace-phase-03-components-events/step-01-component-model.md`](./solace-phase-03-components-events/step-01-component-model.md)
2. [`solace-phase-03-components-events/step-02-events-lifecycle.md`](./solace-phase-03-components-events/step-02-events-lifecycle.md)

## 阶段 4：调度器与状态管理

1. [`solace-phase-04-scheduler-store/step-01-scheduler-nexttick.md`](./solace-phase-04-scheduler-store/step-01-scheduler-nexttick.md)
2. [`solace-phase-04-scheduler-store/step-02-store.md`](./solace-phase-04-scheduler-store/step-02-store.md)

## 阶段 5：编译与构建工具

1. [`solace-phase-05-compiler-tooling/step-01-jsx-vite.md`](./solace-phase-05-compiler-tooling/step-01-jsx-vite.md)
2. [`solace-phase-05-compiler-tooling/step-02-package-build.md`](./solace-phase-05-compiler-tooling/step-02-package-build.md)

## 阶段 6：质量、示例与发布

1. [`solace-phase-06-quality-release/step-01-examples-docs.md`](./solace-phase-06-quality-release/step-01-examples-docs.md)
2. [`solace-phase-06-quality-release/step-02-benchmark-release.md`](./solace-phase-06-quality-release/step-02-benchmark-release.md)

## 每个步骤的通用完成条件

- 相关源码和测试文件已创建或修改。
- `pnpm format:check` 通过。
- `pnpm typecheck` 通过。
- 相关测试命令通过。
- 文档中涉及的命令可以复制执行。
- 如果当前目录已初始化 Git，则提交一次聚焦变更。
