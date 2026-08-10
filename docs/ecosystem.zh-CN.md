# 生态方向

本文档记录 beta 线对 UI components、plugin ecosystem 和 third-party integration 的方向决策。它是产品化边界说明，不是新的公共 API 表面。

## 决策

- beta 线不提供一方 UI component library。Solace 应先稳定 framework core、router、SSR/hydration、DevTools event contracts、examples 和 release gates，再考虑拥有组件套件。
- beta 线不提供稳定 plugin ecosystem。`app.use()` 仍是 app-level installation primitive，但 Solace 还不应宣称 plugin registry、plugin marketplace 或 third-party plugins 的兼容性承诺。
- 大型应用应使用应用自有 adapter components 承接 UI 选型。可以在本地 components 和 design tokens 后面封装 third-party UI libraries，让业务 feature 依赖应用 adapter，而不是直接依赖 vendor package。
- 不要把 third-party UI library types、DOM assumptions、class names、theme tokens 或 component lifecycles 暴露成 Solace public contracts。
- DevTools extension panels 应视为基于公开 event contracts 的 diagnostics；在 event payloads 和 extension boundaries 单独设计前，它们不是 ecosystem plugin API。

## 推荐应用模式

使用本地 UI 边界：

```text
features -> app/components -> third-party UI package
```

业务模块导入应用自有组件，例如 `AppButton`、`AppDialog` 或 `DataTable`。这些 wrappers 负责 accessibility defaults、styling tokens、vendor prop mapping 和迁移成本。这样未来 UI library 决策不会泄漏到 feature layer。

插件也保持小而应用自有：

```ts
import type { App } from "@italone/solace";

export function installFeaturePlugin(app: App): void {
  app.provide("feature-config", { enabled: true });
}
```

避免设计依赖 private renderer、router、scheduler 或 DevTools internals 的 plugin API。

## 重新评估触发条件

只有同时满足以下条件，才重新考虑一方 UI package：

- 至少两个真实应用复用了相同的 accessible component patterns。
- design token、theming、focus、keyboard 和 SSR behavior 可以文档化为 public contract。
- component entry points 已有 bundle size 和 tree-shaking 检查。
- component tests 和 browser interaction tests 可以纳入 release gates。

只有同时满足以下条件，才重新考虑稳定 plugin ecosystem：

- extension points 是 public package exports，而不是 private module imports。
- Router、SSR/hydration、DevTools 和 build-tool hooks 都有明确兼容性策略。
- permissions、redirects、storage、postMessage 和 network behavior 的安全边界已文档化并可测试。
- package smoke tests 可以验证至少一个 external-style plugin consumer。

## 近期范围

生态工作先聚焦在文档、示例和 adapters：

- 基于真实落地经验继续扩展 `docs/large-app.md`。
- third-party UI integration guidance 保持在 app-wrapper 层。
- DevTools panels 继续绑定公开 event contracts。
- release notes 必须诚实说明还没有一方 UI components 和稳定 plugins。
