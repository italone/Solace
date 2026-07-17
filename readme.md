# Solace

Solace is a TypeScript-first frontend framework created by alone.

当前仓库已经包含可运行的框架核心、Rollup 包构建、Vite 示例、Vitest 单元/集成测试和 Playwright e2e 测试。框架支持响应式状态、VNode 渲染、DOM diff、函数式组件、默认 slots、异步组件、事件、生命周期、轻量 store、插件安装与 app-level provide API、JSX runtime 和 package exports。

## 快速开始

```bash
pnpm install
pnpm quality
pnpm test:e2e
```

发布前完整检查：

```bash
pnpm release:check
```

运行示例：

```bash
pnpm dev
pnpm exec vite examples/todo-app --host 127.0.0.1 --port 5175
pnpm exec vite examples/large-list --host 127.0.0.1 --port 5176
```

最小用法：

```ts
import { createApp, h, reactive } from "solace";

const state = reactive({ count: 0 });

const App = () =>
  h(
    "button",
    {
      onClick: () => {
        state.count += 1;
      },
    },
    `count: ${state.count}`,
  );

createApp(App).mount(document.querySelector("#app") as Element);
```

## 当前能力

- 响应式：`reactive`、`effect`、`computed`、`ref`、`watch`、`watchEffect`。
- 渲染：`h`、`render`、VNode、props patch、children diff、Fragment。
- 组件：函数式组件、props、emit、默认 slots、named slots、slot props、异步组件（loading/error、delay/timeout、retry）、生命周期、provide/inject、组件 effect 调度与卸载清理。
- 事件：`onXxx` 事件绑定、handler 更新、invoker 缓存和卸载清理。
- 状态管理：`createStore`，支持 state、computed getters、显式 context actions。
- 插件：`app.use(plugin, ...options)` 和 `app.provide(key, value)`，支持函数插件、对象插件和 app-level 注入值。
- JSX：`solace/jsx-runtime`、`solace/jsx-dev-runtime`。
- 包构建：ESM、CJS、类型声明和 package exports。
- 示例：basic counter、todo app、large list。
- 发布门禁：`pnpm release:check`、format check、coverage thresholds、package consumer smoke、jsdom benchmark smoke、Chromium production browser benchmark、browser e2e、Changesets versioning。

更多示例说明见 [`docs/examples.md`](./docs/examples.md)。DevTools public subpath 和安全边界见
[`docs/devtools.md`](./docs/devtools.md)。

## 设计背景

下面保留项目初始方案和长期规划，作为后续演进参考。

## 2. 项目目标

本项目计划创建一个全新的前端自研开发框架，正式命名为 `Solace`。该框架面向现代 Web 应用开发，目标是提供轻量、高性能、类型友好、可扩展的组件化开发体验。

### 2.1 框架命名

框架名称：`Solace`

正式描述：

> Solace is a TypeScript-first frontend framework created by alone.

命名来源：

- `Solace` 的发音和语义与 `Solo`、`Alone` 有关联，保留了开发者 `alone` 的个人创作属性，但避免直接使用 `AloneTS` 这类偏练习项目或工具包风格的名称。
- `Solace` 作为正式框架名更稳重、简洁，适合用于前端框架、渲染引擎和长期维护的开源项目。
- TypeScript 是本框架的核心语言，因此用 `TypeScript-first` 作为副标题表达技术定位，而不是把 `TS` 直接放进名称中。
- 前端定位通过 `frontend framework` 明确表达，后续可自然扩展为 `Solace Core`、`Solace Renderer`、`Solace DevTools`、`Solace Vite Plugin` 等子模块命名。

核心目标：

- 使用 TypeScript 4.5+ 作为主要开发语言，推荐在项目初始化时使用 TypeScript 5.x。
- 支持 ES6+ 现代 JavaScript 能力，包括 `async/await`、`Proxy`、`Reflect`、`WeakMap`、`Map`、`Set` 等。
- 提供原创实现的响应式系统、组件系统、虚拟 DOM 渲染器、事件系统和调度器。
- 默认使用 Vite 作为开发和示例构建工具，框架包构建兼容 Rollup，必要时提供 Webpack 接入示例。
- 支持 Tree Shaking、代码分割、类型声明文件输出和 ESM/CJS 双格式产物。
- 提供单元测试、集成测试、性能基准测试和性能回归测试。

重要说明：性能指标在项目早期应作为目标和验收标准，不应在没有真实基准数据前宣称已经超过 React、Vue 或 Svelte。

## 3. 技术选型

### 3.1 语言与运行环境

- TypeScript：核心源码、类型定义和测试全部使用 TypeScript。
- ECMAScript target：建议产物目标为 `ES2018` 或更高，源码可使用 ES2020+ 语法。
- Node.js：当前包声明支持 `^20.19.0 || >=22.12.0`，建议本地开发和 CI 使用 Node 22。
- 包管理器：推荐使用 `pnpm`，便于后续扩展 monorepo、examples 和 packages。

### 3.2 构建工具

- Vite：用于开发服务器、示例应用、热更新和文档站预览。
- Rollup：用于框架核心包构建，输出 ESM、CJS 和类型声明。
- Webpack：不作为默认构建器，但提供兼容示例和集成说明。
- esbuild：作为 Vite 内部转译工具，也可用于开发阶段快速构建。

### 3.3 测试工具

- Vitest：单元测试和集成测试。
- Playwright：浏览器级渲染、事件、交互和回归测试。
- Benchmark.js 或 tinybench：微基准测试。
- jsdom：用于部分 DOM 行为的快速测试。
- c8 或 Vitest coverage：覆盖率统计。

### 3.4 代码质量工具

- ESLint：TypeScript 代码质量检查。
- Prettier：统一代码格式。
- Husky + lint-staged：提交前检查。
- Changesets：版本发布和变更记录。
- GitHub Actions：CI 中执行 format check、typecheck、lint、测试、package exports、coverage、package smoke、benchmark smoke 和 e2e。

## 4. 项目结构规划

建议初始化后的目录结构如下：

```text
.
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── performance.md
│   └── examples.md
├── examples/
│   ├── basic-counter/
│   ├── todo-app/
│   └── large-list/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── component/
│   │   │   ├── event/
│   │   │   ├── reactivity/
│   │   │   ├── renderer/
│   │   │   ├── scheduler/
│   │   │   ├── shared/
│   │   │   └── vnode/
│   │   └── package.json
│   ├── compiler/
│   │   └── src/
│   ├── devtools/
│   │   └── src/
│   └── vite-plugin-solace/
│       └── src/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── config/
│   ├── eslint/
│   ├── rollup/
│   └── tsconfig/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
└── README.md
```

如果第一阶段只实现核心框架，也可以先采用单包结构：

```text
.
├── src/
│   ├── component/
│   ├── event/
│   ├── reactivity/
│   ├── renderer/
│   ├── scheduler/
│   ├── shared/
│   └── vnode/
├── tests/
├── examples/
├── docs/
├── package.json
└── README.md
```

## 5. 核心架构设计

### 5.1 总体分层

框架核心建议拆分为以下层次：

1. Shared 层：基础工具、类型工具、错误码、开发环境警告、不可变常量。
2. Reactivity 层：响应式对象、依赖收集、变更触发、计算属性和副作用管理。
3. Scheduler 层：任务队列、批处理、微任务调度、`requestAnimationFrame` 协调。
4. VNode 层：虚拟节点结构、节点标记、子节点归一化和 patch flags。
5. Renderer 层：挂载、更新、卸载、diff、DOM 操作抽象。
6. Component 层：组件实例、props、slots、生命周期、上下文和通信。
7. Event 层：事件绑定、事件委托、自定义事件和冒泡处理。
8. Compiler 层：模板解析、AST 转换、代码生成或 JSX 转换接入。
9. Plugin 层：插件注册、全局能力扩展、开发工具扩展点。

### 5.2 数据流

典型更新流程：

```text
state mutation
  -> dependency trigger
  -> effect scheduling
  -> component update job
  -> render function returns vnode tree
  -> diff old vnode and new vnode
  -> patch real DOM
  -> lifecycle hooks and post effects
```

关键原则：

- 响应式系统只负责依赖追踪和通知，不直接操作 DOM。
- 调度器统一处理批量更新，避免同一组件在同一 tick 中重复渲染。
- 渲染器只消费 VNode 和 DOM 宿主操作，方便未来扩展到非 DOM 平台。
- 组件系统维护实例状态、生命周期和组件边界。

## 6. 核心模块设计

### 6.1 响应式系统

目标能力：

- 基于 `Proxy` 实现对象、数组、Map、Set 的响应式代理。
- 基于 `WeakMap -> Map -> Set` 建立依赖索引。
- 支持 `effect`、`computed`、`watch` 和 `watchEffect`。
- 支持嵌套对象懒代理，避免初始化阶段深度遍历带来的额外开销。
- 支持批处理更新和 effect 清理，避免重复依赖和内存泄漏。

核心 API 草案：

```ts
const state = reactive({ count: 0 });

effect(() => {
  console.log(state.count);
});

const doubled = computed(() => state.count * 2);
```

### 6.2 虚拟 DOM 与 Diff

目标能力：

- 支持元素节点、文本节点、Fragment、组件节点和 Portal 扩展点。
- 支持 keyed 和 non-keyed children diff。
- 对常见路径做快速比较：相同前缀、相同后缀、纯新增、纯删除。
- keyed diff 中使用最长递增子序列减少 DOM 移动次数。
- 支持静态节点跳过、patch flags 和 block tree 优化。

VNode 草案：

```ts
interface VNode {
  type: string | ComponentType | symbol;
  props: Record<string, unknown> | null;
  key: string | number | null;
  children: VNode[] | string | null;
  shapeFlag: number;
  patchFlag?: number;
  el?: Node | null;
}
```

### 6.3 组件系统

目标能力：

- 支持函数式组件和类组件。
- 支持 `mount`、`update`、`unmount` 生命周期。
- 支持 props、slots、emit、provide/inject。
- 支持错误边界和开发环境调试提示。
- 支持组件间通信，同时避免隐式全局状态滥用。

函数式组件示例：

```ts
import { h, reactive } from "solace";

export function Counter() {
  const state = reactive({ count: 0 });

  return () => h("button", { onClick: () => state.count++ }, `count: ${state.count}`);
}
```

### 6.4 渲染器

目标能力：

- 提供平台无关的 renderer factory。
- 默认实现 DOM renderer。
- 支持异步渲染队列和 `requestAnimationFrame` 优化。
- 支持卸载阶段资源清理，包括事件、effect、ref 和组件实例。

宿主操作接口草案：

```ts
interface HostOps {
  createElement(type: string): Element;
  createText(text: string): Text;
  insert(child: Node, parent: Node, anchor?: Node | null): void;
  remove(child: Node): void;
  setText(node: Node, text: string): void;
  patchProp(el: Element, key: string, prev: unknown, next: unknown): void;
}
```

### 6.5 事件系统

目标能力：

- 统一处理原生事件和自定义事件。
- 对高频事件提供委托机制。
- 支持事件修饰能力，例如 once、capture、passive、stop、prevent。
- 支持组件 emit 和父组件监听。
- 在卸载时自动移除事件引用，降低泄漏风险。

### 6.6 状态管理

第一阶段可以内置轻量 store，避免过早设计复杂生态。

目标能力：

- 支持集中式状态、派生状态和 action。
- 支持模块化 store。
- 与响应式系统共享依赖追踪能力。
- 提供开发环境快照和变更日志扩展点。

### 6.7 编译与 JSX

建议分两阶段实现：

- 第一阶段：优先支持手写 render function 和 JSX。
- 第二阶段：实现模板编译器，支持条件渲染、列表渲染、事件绑定、slot 和静态提升。

这样可以先验证运行时架构和性能，再投入编译器复杂度。

## 7. API 设计原则

API 应保持直观、稳定、可组合：

- 命名语义清晰，避免为了“原创”而使用难懂概念。
- 核心 API 数量克制，复杂能力通过插件扩展。
- 类型推导优先，减少用户显式声明泛型的频率。
- 开发环境错误信息要包含原因、位置和修复建议。
- 生产环境错误码可压缩，文档中提供错误码映射。

当前 package root 公共 API：

```ts
import {
  Fragment,
  computed,
  createApp,
  createStore,
  defineAsyncComponent,
  defineComponent,
  effect,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  onUpdated,
  provide,
  inject,
  reactive,
  ref,
  render,
  watch,
  watchEffect,
} from "solace";
```

当前 README 中列出的候选 API 已完成首轮 root export 收口；DevTools 通过 `solace/devtools`
子路径提供低层集成入口。

## 8. 项目初始化步骤

### 8.1 创建基础项目

```bash
pnpm init
pnpm add -D typescript vite vitest jsdom @vitest/coverage-v8
pnpm add -D eslint prettier husky lint-staged
pnpm add -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs rollup-plugin-dts
pnpm add -D playwright tinybench
```

### 8.2 初始化 TypeScript

```bash
pnpm tsc --init
```

建议配置：

- `strict: true`
- `declaration: true`
- `declarationMap: true`
- `moduleResolution: "Bundler"` 或根据构建目标选择 `NodeNext`
- `target: "ES2018"` 或更高
- `module: "ESNext"`

### 8.3 推荐脚本

```json
{
  "scripts": {
    "dev": "vite examples/basic-counter",
    "build": "rollup -c",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:package": "pnpm build && vitest run --config vitest.package.config.ts",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "benchmark": "node scripts/run-benchmark.mjs",
    "benchmark:browser": "playwright test --config playwright.benchmark.config.ts",
    "package:smoke": "node scripts/package-consumer-smoke.mjs",
    "quality": "pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test && pnpm test:package",
    "release:check": "pnpm quality && pnpm test:coverage && pnpm package:smoke && pnpm benchmark && pnpm benchmark:browser && pnpm test:e2e"
  }
}
```

## 9. 性能目标与验证方案

### 9.1 性能目标

以下指标作为项目目标，不代表当前已经达成：

- 1000+ 组件首次渲染目标：不超过 100ms。
- 高频状态更新场景：避免重复渲染，同一 tick 内相同组件只更新一次。
- keyed list 更新：减少不必要 DOM 移动。
- 长时间运行：组件反复挂载、卸载后无持续增长的 effect、事件监听器和 DOM 引用。
- 包体积：核心运行时保持轻量，非核心能力通过独立包或插件引入。

### 9.2 对比对象

建议选择以下对比对象：

- React 18
- Vue 3
- Svelte 3 或当前稳定版本
- 原生 DOM 操作基准

### 9.3 基准测试场景

必须覆盖：

- 创建 1,000 个简单组件。
- 创建 10,000 行列表。
- keyed list 插入、删除、移动。
- 单点状态更新。
- 批量状态更新。
- 深层响应式对象更新。
- 组件挂载和卸载循环。
- 内存快照和泄漏检测。

### 9.4 报告模板

```text
测试环境：
- CPU:
- Memory:
- OS:
- Browser:
- Node.js:
- Commit:

测试场景：
- 1000 components initial render
- 10000 rows create/update/delete
- keyed diff reorder
- repeated mount/unmount

结果：
- Solace:
- React:
- Vue:
- Svelte:
- Native DOM:

结论：
- 已达成：
- 未达成：
- 需要优化：
```

## 10. 测试策略

### 10.1 单元测试

覆盖：

- 响应式依赖收集和清理。
- `computed` 缓存与失效。
- scheduler 去重、顺序和异常处理。
- VNode 创建和 children 归一化。
- diff 算法边界情况。
- 事件绑定和卸载清理。

### 10.2 集成测试

覆盖：

- 组件渲染和更新。
- 父子组件 props 和 emit。
- provide/inject。
- store 与组件联动。
- 异步更新和 `nextTick`。

### 10.3 E2E 测试

覆盖：

- 示例应用可正常启动。
- 点击、输入、列表更新等真实浏览器交互。
- 控制台无未处理错误。

### 10.4 覆盖率目标

- 核心模块语句覆盖率目标：90%+。
- diff、scheduler、reactivity 等高风险模块应补充分支覆盖。
- 性能测试不追求覆盖率，但必须纳入回归检查。

## 11. 实现路线图

### 阶段 0：项目初始化

- 创建 `package.json`、`tsconfig`、`eslint`、`prettier`、`vitest`、`rollup` 配置。
- 建立源码、测试、文档和示例目录。
- 配置 CI 基础流程。

### 阶段 1：响应式核心

- 实现 `reactive`、`effect`、`computed`、`watch`。
- 实现依赖清理、嵌套代理和批处理更新。
- 完成响应式系统单元测试。

### 阶段 2：VNode 与渲染器

- 实现 `h`、VNode 标记和 DOM renderer。
- 实现 mount、patch、unmount。
- 实现 keyed 和 non-keyed diff。
- 完成列表和组件更新测试。

### 阶段 3：组件系统

- 实现函数式组件和类组件。
- 实现 props、slots、emit、生命周期。
- 实现错误处理和开发环境警告。
- 提供基础组件示例。

### 阶段 4：调度器与性能优化

- 实现 job queue、去重、优先级和 `nextTick`。
- 对 diff 和响应式更新做性能剖析。
- 建立性能基准测试项目。

### 阶段 5：工具链与生态

- 完成 Rollup 产物构建。
- 输出 `.d.ts` 类型文件。
- 增加 Vite 插件或 JSX 支持。
- 编写 API 文档和示例应用。

### 阶段 6：稳定化与发布

- 完成性能对比报告。
- 补齐边界测试和内存泄漏测试。
- 引入 Changesets 管理版本。
- 发布首个 alpha 版本。

## 12. 风险与约束

- “性能超过成熟框架”是高难度目标，需要真实基准和持续优化，不能只通过架构设计保证。
- 自研框架必须避免直接复制 React、Vue、Angular、Svelte 等项目的具体实现代码。
- 编译器、响应式系统和 diff 算法都是复杂模块，应分阶段实现，避免一次性铺开。
- 如果目标是学习和验证架构，可以优先做单包项目；如果目标是长期维护生态，建议从 monorepo 开始。
- 文档中的 API 草案在实现过程中可以调整，但需要保持语义稳定和迁移说明。

## 13. 验收标准

第一阶段最小可验收版本应满足：

- 能通过 `createApp` 挂载一个组件。
- 支持响应式状态驱动 DOM 更新。
- 支持基础事件绑定。
- 支持组件卸载和资源清理。
- 单元测试覆盖核心响应式和渲染流程。
- 可以运行一个 counter 示例。

完整版本验收标准：

- 完成组件、响应式、渲染器、事件、调度器、状态管理和插件扩展。
- 测试覆盖率达到 90%+。
- 提供完整 API 文档、架构文档、示例应用和性能报告。
- 构建产物支持 ESM、CJS 和类型声明。
- 性能目标通过可复现 benchmark 验证。

## 14. 后续建议

当前最小框架闭环、示例、文档和发布前门禁已经建立。后续建议优先推进以下方向：

- 持续记录 jsdom 与 Chromium 生产构建 benchmark 趋势；两个 benchmark 命令都支持 opt-in 本地 JSONL history，`pnpm benchmark:history` 可汇总 median、p95 和 variance，后续再评估阈值和发布性能结论。
- 根据 [`docs/devtools.md`](./docs/devtools.md) 的边界继续扩展 DevTools summary payload；浏览器扩展或可视化面板应在更多真实示例验证后再实现。
- 发布前运行 release readiness 与 full release check，确认 npm 包名、访问权限、Changesets version、browser benchmark/e2e 结果和 `private` 配置调整策略。
