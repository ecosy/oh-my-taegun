import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../../helpers/project-root.js";
import { loadV2Markdown } from "../helpers/load-v2-doc.js";

describe("skill distribution", () => {
  it("documents repo-tracked skill installation in the README", async () => {
    const markdown = await loadV2Markdown("README.md");
    expect(markdown).toContain("## OMT Skill Install");
    expect(markdown).toContain("./scripts/install-codex-skill.sh omt");
    expect(markdown).toContain("`$omt`");
    expect(markdown).toContain("repo 업데이트가 곧 skill 업데이트");
  });

  it("documents tracked vs installed skill locations in publish policy", async () => {
    const markdown = await loadV2Markdown("docs/publish-policy.md");
    expect(markdown).toContain("skills/omt/");
    expect(markdown).toContain("~/.codex/skills/omt");
    expect(markdown).toContain("core 구현과 skill wrapper를 분리");
  });

  it("tracks only the wrapper files under skills/omt", async () => {
    const files = await listFiles(join(projectRoot, "skills", "omt"));
    expect(files.sort()).toEqual([
      "SKILL.md",
      "agents/openai.yaml",
    ]);

    const skillMarkdown = await readFile(join(projectRoot, "skills", "omt", "SKILL.md"), "utf8");
    const openAiYaml = await readFile(join(projectRoot, "skills", "omt", "agents", "openai.yaml"), "utf8");
    expect(skillMarkdown).not.toContain("/Users/");
    expect(openAiYaml).not.toContain("/Users/");
  });
});

async function listFiles(root: string, relativeRoot = ""): Promise<string[]> {
  const entries = await readdir(join(root, relativeRoot), { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, relativePath));
      continue;
    }
    files.push(relativePath);
  }

  return files;
}
