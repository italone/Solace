import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import packageJson from "../../../package.json" with { type: "json" };

const read = (path: string): string => readFileSync(resolve(__dirname, "../../../", path), "utf8");

function extract(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  expect(match, `expected pattern ${String(pattern)} to match`).not.toBeNull();
  return match![1];
}

describe("version pin sync", () => {
  it("repository version pins match package.json in both languages", () => {
    const status = read("docs/project-status.md");
    const statusZh = read("docs/project-status.zh-CN.md");

    const pinned = extract(status, /Repository package version: `([^`]+)`/);
    const pinnedZh = extract(statusZh, /仓库 package 版本：`([^`]+)`/);

    expect(pinned).toBe(packageJson.version);
    expect(pinnedZh).toBe(packageJson.version);
  });

  it("published npm beta pins agree across readme and project-status", () => {
    const readme = read("readme.md");
    const readmeZh = read("readme.zh-CN.md");
    const status = read("docs/project-status.md");
    const statusZh = read("docs/project-status.zh-CN.md");

    const readmeBeta = extract(readme, /npm `beta` is\n`([^`]+)`/);
    const readmeBetaZh = extract(readmeZh, /npm `beta` 是\n`([^`]+)`/);
    const statusBeta = extract(status, /Published npm `beta`: `([^`]+)`/);
    const statusBetaZh = extract(statusZh, /npm `beta` 已发布版本：`([^`]+)`/);

    expect(readmeBetaZh).toBe(readmeBeta);
    expect(statusBeta).toBe(readmeBeta);
    expect(statusBetaZh).toBe(readmeBeta);
  });

  it("dist-tag pins agree across languages", () => {
    const status = read("docs/project-status.md");
    const statusZh = read("docs/project-status.zh-CN.md");

    const latest = extract(status, /`latest` points to `([^`]+)`/);
    const latestZh = extract(statusZh, /`latest` 指向 `([^`]+)`/);
    const beta = extract(status, /`latest` points to `[^`]+`; `beta` points to `([^`]+)`/);
    const betaZh = extract(statusZh, /`latest` 指向 `[^`]+`；`beta` 指向 `([^`]+)`/);

    expect(latestZh).toBe(latest);
    expect(betaZh).toBe(beta);
  });
});
