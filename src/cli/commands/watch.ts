import { CliError } from "../../shared/errors.js";
import { startWatchServer } from "../../watch-v2/http-server.js";

export async function runWatchCommand(_projectRoot: string, args: Record<string, string>): Promise<void> {
  const repoPath = args["repo-path"];
  if (!repoPath) {
    throw new CliError("watch requires --repo-path");
  }

  const requestedPort = args.port ? Number.parseInt(args.port, 10) : 4317;
  if (!Number.isFinite(requestedPort) || requestedPort < 0) {
    throw new CliError("watch requires --port to be a non-negative integer");
  }

  const host = args.host ?? "127.0.0.1";
  const server = await startWatchServer({
    repoPath,
    runId: args["run-id"],
    host,
    port: requestedPort,
  });

  process.stdout.write(`${server.url}\n`);

  const close = async () => {
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}
