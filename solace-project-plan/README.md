# Solace Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `readme.md` 的项目方案，从零创建一个 TypeScript 前端自研框架 Solace，并分阶段完成工程化、响应式核心、渲染器、组件系统、调度器、工具链、示例、文档和性能验证。

**Architecture:** 项目采用先单包、后可扩展为 monorepo 的执行策略。核心运行时按 `shared -> reactivity -> scheduler -> vnode -> renderer -> component -> event -> store` 分层推进，先交付可运行最小闭环，再补齐性能、编译和发布能力。

**Tech Stack:** TypeScript 5.x, pnpm, Vite, Rollup, Vitest, jsdom, Playwright, tinybench, ESLint, Prettier, Changesets.

---

## 计划目录

- [`00-execution-index.md`](./00-execution-index.md)：总执行顺序和阶段依赖。
- [`01-file-map.md`](./01-file-map.md)：最终项目文件结构和职责映射。
- [`solace-phase-00-foundation/`](./solace-phase-00-foundation/)：项目初始化、工具链、质量门禁。
- [`solace-phase-01-reactivity/`](./solace-phase-01-reactivity/)：响应式对象、effect、computed、watch。
- [`solace-phase-02-renderer/`](./solace-phase-02-renderer/)：VNode、`h`、DOM renderer、diff。
- [`solace-phase-03-components-events/`](./solace-phase-03-components-events/)：组件模型、生命周期、事件系统。
- [`solace-phase-04-scheduler-store/`](./solace-phase-04-scheduler-store/)：调度器、`nextTick`、轻量 store。
- [`solace-phase-05-compiler-tooling/`](./solace-phase-05-compiler-tooling/)：JSX/Vite 接入、包构建和类型产物。
- [`solace-phase-06-quality-release/`](./solace-phase-06-quality-release/)：示例、文档、性能基准和 alpha 发布。

## 执行原则

- 每个 `step-*.md` 是一个独立执行文件，按文件名顺序执行。
- 每个步骤完成后运行该文件列出的验证命令。
- 当前目录尚未初始化 Git 仓库；如果需要提交记录，先初始化 Git。
- 当前单包项目骨架、源码、测试、示例、文档和发布前门禁已经创建完成；后续继续执行时应以现有文件为准，不要重新初始化项目。
- 性能目标必须通过可复现 benchmark 验证，不能提前写成已达成结论。
