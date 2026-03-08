import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrUpdatePullRequest } from "../../src/delivery/pr-client.js";

describe("pr client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("reuses an existing PR when one already exists", async () => {
    process.env.GITHUB_TOKEN = "token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ html_url: "https://github.com/ecosy/oh-my-taegun/pull/1", number: 1 }]), {
        status: 200,
      }),
    );

    const result = await createOrUpdatePullRequest({
      originUrl: "https://github.com/ecosy/oh-my-taegun.git",
      headBranch: "feature/omt-1",
      baseBranch: "develop",
      title: "title",
      body: "body",
    });

    expect(result.existing).toBe(true);
    expect(result.number).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
