# 项目日志

本目录用于记录项目每一次可追踪变动，包括变动原因、影响范围、涉及文件、验证结果和后续动作。

## 目录结构

```text
solace-project-log/
├── README.md
├── index.md
├── template.md
└── solace-entries/
    ├── 2026-07-09-001-readme-enrichment.md
    ├── 2026-07-09-002-project-plan-created.md
    └── 2026-07-09-003-project-log-created.md
```

## 记录规则

- 每次项目内容变动后，新增一条日志文件。
- 文件命名格式：`YYYY-MM-DD-NNN-short-description.md`。
- `NNN` 为当天递增编号，从 `001` 开始。
- 每条日志必须包含影响范围和涉及文件。
- 如果变更只是文档、计划或日志，也要记录。
- 如果后续创建 Git 仓库，日志中的提交字段可补充 commit hash。

## 快速入口

- 日志索引：[index.md](./index.md)
- 日志模板：[template.md](./template.md)
