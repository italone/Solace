# 2026-07-09-005：将项目根目录重命名为 Solace

## 基本信息

- 日期：2026-07-09
- 类型：项目结构
- 状态：已完成
- 关联提交：无，当前目录尚未初始化 Git 仓库

## 变动摘要

将项目根目录从 `frontend-ts` 重命名为 `Solace`，使目录名称与 README 中采用的正式框架名称保持一致。

## 变动原因

框架已经正式命名为 `Solace`。根目录继续使用 `frontend-ts` 会让项目入口、文档和后续包命名之间产生不一致，因此需要同步目录名称。

## 影响范围

- 影响模块：项目根目录、项目访问路径、项目日志。
- 影响对象：本地开发路径、后续命令执行路径、文档中可能引用的绝对路径。
- 行为变化：项目内容不变；项目目录路径从 `/Users/alone/Desktop/TEST/frontend-ts` 变为 `/Users/alone/Desktop/TEST/Solace`。
- 风险等级：低，目录命名变更；如果外部脚本硬编码旧路径，需要同步更新。

## 涉及文件

| 文件                                                                                | 动作   | 说明                                      |
| ----------------------------------------------------------------------------------- | ------ | ----------------------------------------- |
| `/Users/alone/Desktop/TEST/frontend-ts`                                             | 重命名 | 改名为 `/Users/alone/Desktop/TEST/Solace` |
| `solace-project-log/index.md`                                                       | 修改   | 追加第 005 条变更索引                     |
| `solace-project-log/solace-entries/2026-07-09-005-root-directory-renamed-solace.md` | 新增   | 记录本次目录重命名                        |

## 验证记录

| 验证项         | 命令或方式                                                                  | 结果                             |
| -------------- | --------------------------------------------------------------------------- | -------------------------------- |
| 目标目录预检查 | `test -e /Users/alone/Desktop/TEST/Solace`                                  | 通过，重命名前目标目录不存在     |
| 父目录检查     | `ls -la /Users/alone/Desktop/TEST`                                          | 通过，重命名前存在 `frontend-ts` |
| 重命名操作     | `mv /Users/alone/Desktop/TEST/frontend-ts /Users/alone/Desktop/TEST/Solace` | 通过，目录已重命名               |

## 后续动作

- 后续命令应在 `/Users/alone/Desktop/TEST/Solace` 下执行。
- 如果后续文档出现旧路径 `/Users/alone/Desktop/TEST/frontend-ts`，应同步替换为新路径。
