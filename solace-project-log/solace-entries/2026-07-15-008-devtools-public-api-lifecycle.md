# 2026-07-15-008：补充 DevTools public API lifecycle guard

## 基本信息

- 日期：2026-07-15
- 类型：DevTools 文档 / package exports / 文档契约测试 / 项目日志
- 状态：已完成
- 关联提交：本条日志随实现提交一并提交

## 变动摘要

为 `solace/devtools` 补充 public API lifecycle 规则，明确新增导出、payload 变更和破坏性变更的处理方式，
并把 public subpath 的 JavaScript runtime export 列表锁定为仅 `createDevtoolsRecorder` 与
`onDevtoolsEvent`。

## 变动原因

`solace/devtools` 已经作为 public subpath 暴露，但文档没有把“生命周期”具体化，package boundary 也只
验证了函数存在与少量内部 helper 缺失。补上 lifecycle 规则后，后续新增 DevTools API 时需要先经过
文档、测试、日志三道边界。

## 影响范围

- 影响模块：DevTools 文档、package exports 集成测试、文档契约测试、项目日志。
- 行为变化：public runtime export list 被精确锁定；新 API / payload / breaking change 需要显式 lifecycle 审查。
- 风险等级：低；不改 runtime 实现，只收紧边界和文档规则。

## 涉及文件

| 文件                                                                                | 动作 | 说明                              |
| ----------------------------------------------------------------------------------- | ---- | --------------------------------- |
| `docs/devtools.md`                                                                  | 修改 | 新增 public API lifecycle 段落    |
| `tests/integration/package-exports.test.ts`                                         | 修改 | 锁定 DevTools public runtime keys |
| `tests/unit/devtools/devtools-docs.test.ts`                                         | 新增 | 覆盖 lifecycle 文档契约           |
| `docs/superpowers/specs/2026-07-15-devtools-public-api-lifecycle-design.md`         | 新增 | 记录设计                          |
| `docs/superpowers/plans/2026-07-15-devtools-public-api-lifecycle.md`                | 新增 | 记录实施计划                      |
| `solace-project-log/index.md`                                                       | 修改 | 追加 2026-07-15 日志索引          |
| `solace-project-log/solace-entries/2026-07-15-008-devtools-public-api-lifecycle.md` | 新增 | 记录本次变更                      |

## 验证记录

| 验证项          | 命令或方式                                               | 结果                                             |
| --------------- | -------------------------------------------------------- | ------------------------------------------------ |
| TDD RED         | `pnpm test -- tests/unit/devtools/devtools-docs.test.ts` | 按预期失败，`docs/devtools.md` 尚无 lifecycle 段 |
| Docs contract   | `pnpm test -- tests/unit/devtools/devtools-docs.test.ts` | 通过，20 个测试文件、145 个测试通过              |
| Package exports | `pnpm test:package`                                      | 通过，8 个测试通过，`dist/devtools.*` 生成       |
| Tests           | `pnpm test`                                              | 通过，20 个测试文件、145 个测试通过              |
| Typecheck       | `pnpm typecheck`                                         | 通过                                             |
| Lint            | `pnpm lint`                                              | 通过                                             |
| Build           | `pnpm build`                                             | 通过                                             |
| 格式检查        | `pnpm format:check`                                      | 通过                                             |

## 后续动作

- 后续新增 DevTools runtime export 时，先补 package exports、consumer smoke 和 docs contract，再改实现。
- 若 public subpath 需要破坏性调整，应先写明 breaking change 计划，再改导出面。
