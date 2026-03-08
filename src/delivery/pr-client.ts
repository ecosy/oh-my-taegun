import { CliError } from "../shared/errors.js";
import type { BlockedReason, PullRequestResult } from "../shared/types.js";

export interface CreatePullRequestInput {
  originUrl: string;
  headBranch: string;
  baseBranch: string;
  title: string;
  body: string;
  token?: string;
}

export async function createOrUpdatePullRequest(input: CreatePullRequestInput): Promise<PullRequestResult> {
  const token = input.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    throw new CliError(blockedPrReason().message);
  }

  const repo = parseGitHubRepo(input.originUrl);
  if (!repo) {
    throw new CliError("Only GitHub HTTPS/SSH origins are supported for automatic PR creation.");
  }

  const existing = await findExistingPullRequest(repo.owner, repo.name, input.headBranch, token);
  if (existing) {
    return {
      url: existing.html_url,
      number: existing.number,
      existing: true,
    };
  }

  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/pulls`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({
      title: input.title,
      head: input.headBranch,
      base: input.baseBranch,
      body: input.body,
      draft: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new CliError(`Failed to create pull request: ${response.status} ${body}`);
  }

  const payload = await response.json() as GitHubPullRequest;
  return {
    url: payload.html_url,
    number: payload.number,
    existing: false,
  };
}

export function blockedPrReason(): BlockedReason {
  return {
    code: "delivery_pr_integration_missing",
    message: "GitHub token is missing or PR provider integration is unavailable in the local-first runtime.",
    requiredAction: "Set GITHUB_TOKEN or GH_TOKEN before requesting real PR delivery.",
    evidence: ["docs/spec.yaml delivery.target_outcome=real-pr"],
  };
}

function parseGitHubRepo(originUrl: string): { owner: string; name: string } | null {
  const httpsMatch = originUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/u);
  if (httpsMatch) {
    return { owner: httpsMatch[1], name: httpsMatch[2] };
  }
  const sshMatch = originUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/u);
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] };
  }
  return null;
}

async function findExistingPullRequest(
  owner: string,
  repo: string,
  headBranch: string,
  token: string,
): Promise<GitHubPullRequest | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${encodeURIComponent(headBranch)}`,
    {
      headers: githubHeaders(token),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as GitHubPullRequest[];
  return payload[0] ?? null;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    "accept": "application/vnd.github+json",
    "authorization": `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
    "user-agent": "oh-my-taegun",
  };
}

interface GitHubPullRequest {
  html_url: string;
  number: number;
}
