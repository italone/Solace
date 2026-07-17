# 项目文件职责映射

## 第一阶段采用的目标结构

```text
.
├── src/
│   ├── app.ts
│   ├── component/
│   │   ├── async-component.ts
│   │   ├── component.ts
│   │   ├── define-component.ts
│   │   ├── lifecycle.ts
│   │   ├── props.ts
│   │   └── provide.ts
│   ├── devtools/
│   │   ├── events.ts
│   │   └── index.ts
│   ├── event/
│   │   ├── event.ts
│   │   └── modifiers.ts
│   ├── reactivity/
│   │   ├── computed.ts
│   │   ├── effect.ts
│   │   ├── reactive.ts
│   │   ├── ref.ts
│   │   └── watch.ts
│   ├── renderer/
│   │   ├── diff.ts
│   │   ├── dom.ts
│   │   └── renderer.ts
│   ├── scheduler/
│   │   └── scheduler.ts
│   ├── shared/
│   │   ├── flags.ts
│   │   └── utils.ts
│   ├── store/
│   │   └── store.ts
│   ├── vnode/
│   │   ├── h.ts
│   │   └── vnode.ts
│   ├── index.ts
│   ├── jsx-dev-runtime.ts
│   └── jsx-runtime.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── examples/
│   ├── basic-counter/
│   ├── large-list/
│   ├── performance-benchmark/
│   └── todo-app/
├── scripts/
│   ├── benchmark-metadata.mjs
│   ├── package-consumer-smoke.mjs
│   ├── release-readiness-check.mjs
│   ├── run-benchmark.mjs
│   └── summarize-benchmark-history.mjs
└── docs/
    ├── api.md
    ├── architecture.md
    ├── devtools.md
    ├── examples.md
    ├── package-usage.md
    ├── performance.md
    └── release.md
```

## 文件职责

- `src/index.ts`：统一导出 package root 公共 API，避免用户直接依赖内部路径。
- `src/app.ts`：提供 `createApp(root).mount(container)` 应用挂载入口。
- `src/jsx-runtime.ts` 与 `src/jsx-dev-runtime.ts`：提供 TypeScript automatic JSX runtime 子路径。
- `src/shared/*`：放置跨模块共享类型、标记位和纯工具函数。
- `src/reactivity/*`：只处理响应式依赖收集、触发和派生状态，不操作 DOM。
- `src/scheduler/scheduler.ts`：统一管理批处理任务、去重、执行顺序和 `nextTick`。
- `src/vnode/*`：定义 VNode 数据结构、节点类型标记和 `h` 创建函数。
- `src/renderer/*`：完成平台无关 renderer 和默认 DOM renderer。
- `src/component/*`：维护函数式组件实例、props、emit、slots、异步组件、provide/inject、生命周期和组件 effect 清理。
- `src/devtools/*`：维护内部 DevTools event bus 和 `solace/devtools` public subpath，保留 runtime internals 私有边界。
- `src/event/*`：统一处理 DOM 事件、组件 emit 映射和事件修饰能力。
- `src/store/store.ts`：提供轻量集中式状态管理。
- `tests/unit/*`：验证单模块行为。
- `tests/integration/*`：验证模块协作和真实 DOM 更新。
- `tests/e2e/*`：验证示例应用的浏览器交互和 Chromium production browser benchmark。
- `tests/performance/*`：保存可复现性能基准。
- `examples/performance-benchmark/*`：保存 browser benchmark 的 production Vite fixture。
- `scripts/*`：保存 package smoke、release readiness、benchmark metadata、benchmark runner 和 history summary CLI。
- `docs/*`：保存 API、架构、DevTools、示例、包使用、性能和发布流程文档。
