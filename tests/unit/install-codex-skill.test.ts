import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { projectRoot } from "../helpers/project-root.js";

const execFileAsync = promisify(execFile);
const installScript = join(projectRoot, "scripts", "install-codex-skill.sh");
const trackedSkillPath = join(projectRoot, "skills", "omt");

describe("install-codex-skill.sh", () => {
  it("installs the tracked skill as a symlink", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "omt-codex-home-"));

    const result = await execFileAsync(installScript, ["omt", "--codex-home", codexHome], {
      cwd: projectRoot,
    });

    expect(result.stdout).toContain("installed skill:");
    const installedPath = join(codexHome, "skills", "omt");
    expect((await lstat(installedPath)).isSymbolicLink()).toBe(true);
    expect(await realpath(installedPath)).toBe(await realpath(trackedSkillPath));
  });

  it("is a no-op when the correct symlink is already installed", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "omt-codex-home-"));

    await execFileAsync(installScript, ["omt", "--codex-home", codexHome], {
      cwd: projectRoot,
    });
    const result = await execFileAsync(installScript, ["omt", "--codex-home", codexHome], {
      cwd: projectRoot,
    });

    expect(result.stdout).toContain("skill already installed:");
    const installedPath = join(codexHome, "skills", "omt");
    expect(await realpath(installedPath)).toBe(await realpath(trackedSkillPath));
  });

  it("backs up an existing target when --force is used", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "omt-codex-home-"));
    const targetPath = join(codexHome, "skills", "omt");
    await mkdir(targetPath, { recursive: true });
    await writeFile(join(targetPath, "stale.txt"), "old skill\n");

    const result = await execFileAsync(installScript, ["omt", "--codex-home", codexHome, "--force"], {
      cwd: projectRoot,
    });

    expect(result.stdout).toContain("backed up existing target to:");
    expect((await lstat(targetPath)).isSymbolicLink()).toBe(true);
    const entries = await readdir(join(codexHome, "skills"));
    expect(entries.some((entry) => entry.startsWith("omt.backup."))).toBe(true);
  });

  it("uses CODEX_HOME when --codex-home is not provided", async () => {
    const codexHome = await mkdtemp(join(tmpdir(), "omt-codex-home-"));

    await execFileAsync(installScript, ["omt"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
      },
    });

    const installedPath = join(codexHome, "skills", "omt");
    expect((await lstat(installedPath)).isSymbolicLink()).toBe(true);
    expect(await realpath(installedPath)).toBe(await realpath(trackedSkillPath));
  });
});
