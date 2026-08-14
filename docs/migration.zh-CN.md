# 迁移与回滚手册

[English](./migration.md)

本文档定义 Solace `1.0` 准入门禁要求的发布流程，适用于文档化的公共 package 入口和行为。
它不会把仓库 fixture 变成真实 adoption evidence，也不授权 npm 或 Git 外部状态变更。

## 迁移流程

1. 根据[兼容性与弃用策略](./compatibility.zh-CN.md)中的八个受保护入口比较源版本和目标版本，
   列出所有受影响的 import path、公共类型、运行时行为、文档化错误契约和 maturity label。
2. 将变更分类为 additive、fix-only、deprecated 或 breaking。`0.1.x` patch 不能移除受保护入口，
   也不能引入不兼容的 stable signature。
3. 每项弃用都必须增加可见的文档标记；公共声明可以表达弃用时，还必须增加 TypeScript
   `@deprecated` 标记。必须指定 replacement、保留旧 boundary，并提供带迁移前后消费者示例的
   版本专属 migration note。
4. 在修改已发布 package 之前准备 changeset 或明确选定的 prerelease metadata、release note、
   compatibility matrix 记录和 retained tests。
5. 在精确版本 package consumer 中验证目标 package，记录结果，并在批准 rollout 前解决失败。
6. 记录源版本、目标版本、受影响公共入口、验证命令、结果、未解决风险和 rollout decision。

仓库示例和 package-only adoption fixture 可以验证契约，但不能满足
`adoption.independent-apps`。该条件要求由不同主体维护、并从 npm 安装的应用。

## 精确包消费者验证

升级证据必须使用精确的已发布版本：

```bash
pnpm registry:smoke -- <exact-version>
pnpm adoption:smoke -- --package <exact-version>
pnpm stable:app:upgrade
```

对于尚未发布的 candidate，`pnpm adoption:smoke` 会把本地 tarball 安装到临时 consumer。
所有 consumer 都必须从文档化的 `@italone/solace` package path 导入；不得使用 `src/**`、
`dist/**`、workspace link 或源码 alias。

验证记录必须包含：

- dependency 安装结果和实际解析的精确版本；
- TypeScript typecheck 和生产 bundle 结果；
- 应用在浏览器运行时的 CSR 交互结果；
- 使用服务端渲染时的 SSR 输出、matching hydration identity 和显式恢复行为；
- bundle observations、预期失败路径和错误恢复结果；
- browser inventory，并把环境或网络失败与契约失败分开记录。

## 证据记录

每个版本必须保存包含以下字段的专属记录：

| 字段                 | 必填内容                                                    |
| -------------------- | ----------------------------------------------------------- |
| Source version       | consumer 当前使用的精确版本                                 |
| Target version       | 精确 candidate 或 npm 版本                                  |
| Protected entries    | 每个受影响的 export key 和 import path                      |
| Replacement          | 指定的替代项和版本专属迁移前后示例                          |
| Commands and results | 安装、typecheck、build、runtime、SSR/hydration 和浏览器数据 |
| Known-good version   | consumer 已验证的精确回滚目标                               |
| Risks and decision   | 未解决风险、rollout decision、reviewer 和日期               |
| Follow-up            | 适用时填写 corrective version 或 retained-test owner        |

如果命令被跳过、registry 请求失败，或 package 被源码 alias 替代，不得把证据标记为 verified。

## 回滚触发条件

确认以下任一情况后必须停止 rollout 并开始回滚：

- 受保护 package 入口无法解析，或其 stable signature 变得不兼容；
- 精确版本 consumer 无法安装、typecheck 或完成生产 build；
- CSR 行为、SSR 输出、hydration identity 或文档化恢复行为发生非预期变化；
- runtime failure 无法通过文档化 boundary 恢复；
- bundle size 或性能超过已批准的发布预算；
- DevTools 或 package 变更把权限扩大到已审查 origins 之外；
- 严重 security 或 correctness 问题需要进入兼容性策略中的 exception 流程。

## 回滚流程

1. 停止继续 rollout，保留日志、精确 package 版本、package-manager lockfile、bundle 输出、
   浏览器结果和失败 consumer evidence。
2. 把每个受影响 consumer 的 `package.json` 和 lockfile 恢复到最近验证过的精确 npm 版本，
   使用该 consumer 的锁定 package-manager 流程重新安装。
3. 重新运行失败的精确 package consumer、`pnpm registry:smoke -- <known-good-version>` 和相关
   compatibility smoke，记录旧行为是否恢复。
4. 仓库代码需要修改时回退 source change，并在正常发布门禁后发布新的 corrective version；
   不得复用受影响的版本号。
5. 只有维护者明确批准时，才可以修改 npm dist-tag，使其指向已经发布的 known-good version。
6. 记录 trigger、known-good version、corrective version、dist-tag decision、恢复结果、reviewer
   和 follow-up owner。

未成功的回滚仍属于 incident。在精确 package consumer 和受影响公共契约门禁重新通过之前，
不得恢复 rollout。

## Registry 与 Git 边界

已发布的 npm 版本不可变。不得通过覆盖、删除或重新发布既有版本实施回滚，也不得把已有 Git
release tag 移动到不同内容。

`npm publish`、`npm unpublish`、`npm dist-tag`、`git push` 和 Git tag 创建都需要单独的维护者授权。
本文档只记录这些决策，不授予执行权限。dist-tag 回滚必须指向已经发布的精确版本；source fix
必须在正常发布检查后使用新版本发布。
