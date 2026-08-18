# 兼容性与弃用策略

本文档描述 `@italone/solace` 的公共兼容性边界。它适用于已发布的包入口和文档化行为，
不适用于私有实现细节。

## 兼容性契约

本策略的兼容性主线是 `0.1.x`。本策略在至少一个已发布的 `0.1.x` 版本之后生效。在本主线中，patch release 只能新增或修复：可以新增文档化 API、修复 bug、改进 diagnostics 或澄清文档，但不应改变稳定行为。破坏性移除、不兼容的 signature 变更，以及要求消费者重写的变更不得早于 `0.2.0`。

`0.1.x` 可以包含 beta 或 experimental 能力，但 maturity label 描述的是行为和支持预期。
不得静默移除入口。除非下面的弃用流程已经在 breaking boundary 完成，否则每个受保护
入口在整个兼容性主线中都必须保持可解析。

`release/public-contract.json` 是入口成熟度的机器可读来源。`pnpm release:contract:check` 要求每个
package export 都出现在该 manifest 中，并在任何受保护入口仍为 beta 或 experimental 时拒绝 stable
admission。manifest 检查通过只表示声明边界内部一致，不代表 Solace 已达到 1.0。

## 受保护的包入口

下面八个 export key 和 import path 是受保护的公共包入口：

| Export key          | Import path                       | Maturity              | 范围                                          |
| ------------------- | --------------------------------- | --------------------- | --------------------------------------------- |
| `.`                 | `@italone/solace`                 | Beta                  | 核心 app、响应式、渲染、组件、store 和 router |
| `./devtools`        | `@italone/solace/devtools`        | Beta                  | instrumentation listener 和 recorder API      |
| `./jsx-dev-runtime` | `@italone/solace/jsx-dev-runtime` | Stable tooling entry  | 开发环境 JSX runtime                          |
| `./jsx-runtime`     | `@italone/solace/jsx-runtime`     | Stable tooling entry  | 自动 JSX runtime                              |
| `./package.json`    | `@italone/solace/package.json`    | Stable metadata entry | 明确需要包元数据的消费者                      |
| `./server`          | `@italone/solace/server`          | Beta                  | SSR、SSG 和 static asset helpers              |
| `./sfc`             | `@italone/solace/sfc`             | Experimental          | 窄范围 `.solace` TypeScript type shim         |
| `./vite`            | `@italone/solace/vite`            | Experimental          | 窄范围 `.solace` Vite transform plugin        |

## 冻结的公共成熟度边界

当前 beta 线将 `./jsx-runtime`、`./jsx-dev-runtime` 和 `./package.json` 冻结为 stable 的 tooling
和 metadata 入口。根入口、`./server` 和 `./devtools` 继续为 beta；`./sfc` 和 `./vite` 继续为
experimental。`stableAdmission` 保持为 `false`，因此该边界不代表 Solace 已达到 1.0。

成熟度晋级需要单独设计、同步中英文文档、保留 package-boundary tests、changeset 和新的 release
evidence。晋级是一项明确的兼容性决策，不能作为 manifest checker 通过后的附带结果。

## 成熟度与延期能力

Router 行为属于 beta，async rendering 和 hydration 行为也属于 beta。SFC 和 Vite 支持属于
experimental。这些 maturity label 要求显式文档、明确 deferred boundary 和 retained tests；
它们不是静默修改或移除受保护 export 的许可。

只有在明确文档化为公共契约的一部分时，exact error message 才受兼容性保护。其他情况下，
消费者应依赖 error type 和文档化条件，不应依赖偶然的 message wording。

## 私有实现细节

私有 `src/**`、生成的 `dist/**`、generated layout、deep subpaths、compiler internals、
scheduler queues、VNode internals、component instances 和其他 implementation internals 不在
本策略范围内。它们可以重组、重新生成或移除，不提供公共兼容性保证。消费者只能从上面列出的
八个文档化 export key 导入。

## 弃用流程

在 breaking boundary 移除受保护 API 或修改其公共 signature 之前，维护者必须提供以下全部内容：

1. 在 API 和相关文档中添加可见的 deprecation marker。如果公共 API 类型可以表达弃用状态，
   还必须在对应的 TypeScript 类型或声明中添加 `@deprecated` marker/declaration。
2. 指定替代项（replacement），并用迁移示例（migration example）展示旧用法和新用法。
3. 提交 changeset 和 release note，说明影响及首次 breaking release。
4. 在计划移除完成前保留覆盖旧 boundary、弃用行为和 replacement 的 retained tests。
5. 在移除发生前，至少存在一个已发布的 `0.1.x` 版本，其中包含被弃用的契约。

弃用通知必须标明受影响的 export key 和 import path。`0.1.x` patch 可以新增 replacement 或
deprecation marker，但不能移除受保护入口，也不能引入 breaking signature change。移除和不兼容
signature change 应等待 `0.2.0` 或更晚的 breaking release。

## 例外情况

严重的 security/correctness exception 可能要求更早进行 breaking change 或移除入口。发布时
必须显著说明该 exception，解释受影响的风险，提供醒目的 migration guidance 和 migration example，
并在可行时包含 replacement、changeset、release note 和 retained tests。例外必须限制在恢复安全性
或正确性所必需的最小公共范围；对未受影响的入口，maturity label 和常规弃用要求仍然有效。
