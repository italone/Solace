# 阶段 0：项目基础设施

## 目标

把当前只有 `readme.md` 的目录初始化为可开发、可测试、可构建的 TypeScript 前端框架项目。

## 执行文件

1. [`step-01-create-workspace.md`](./step-01-create-workspace.md)
2. [`step-02-configure-tooling.md`](./step-02-configure-tooling.md)
3. [`step-03-quality-and-ci.md`](./step-03-quality-and-ci.md)

## 阶段验收

- 存在 `package.json`、`tsconfig.json`、`src/index.ts`、`tests/unit`、`examples`。
- 能执行 `pnpm format:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- README 和 `solace-project-plan` 保留为需求与执行依据。
