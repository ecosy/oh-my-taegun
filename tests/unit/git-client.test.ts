import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commitWorkingTree, hasWorkingTreeChanges } from "../../src/delivery/git-client.js";
import { createTempGitRepo } from "../helpers/temp-repo.js";

describe("git client", () => {
  it("detects and commits working tree changes", async () => {
    const repo = await createTempGitRepo();

    expect(await hasWorkingTreeChanges(repo)).toBe(false);

    await writeFile(join(repo, "README.md"), "# changed\n");

    expect(await hasWorkingTreeChanges(repo)).toBe(true);
    expect(await commitWorkingTree(repo, "test commit")).toBe(true);
    expect(await hasWorkingTreeChanges(repo)).toBe(false);
  });
});
