import { createServer } from "node:http";
import { handleRequest } from "./route-handlers.js";

export interface StartWatchServerOptions {
  repoPath: string;
  runId?: string;
  host?: string;
  port?: number;
}

export interface WatchServerHandle {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startWatchServer(options: StartWatchServerOptions): Promise<WatchServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4317;
  const server = createServer(async (request, response) => {
    const payload = await handleRequest(
      { url: request.url ?? "/" },
      {
        repoPath: options.repoPath,
        runId: options.runId,
      },
    ).catch((error) => ({
      statusCode: 500,
      body: JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
      contentType: "application/json; charset=utf-8",
    }));

    response.writeHead(payload.statusCode, { "content-type": payload.contentType });
    response.end(payload.body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Watch server did not expose a TCP address.");
  }

  return {
    host: address.address,
    port: address.port,
    url: `http://${address.address}:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
