import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readWatchSnapshot } from "./repository-reader.js";

export interface WatchRouteDefaults {
  repoPath: string;
  runId?: string;
}

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export async function handleRequest(
  request: RequestContext,
  defaults: WatchRouteDefaults,
): Promise<ResponsePayload> {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/api/health") {
    return json(200, { ok: true });
  }

  if (url.pathname === "/api/snapshot") {
    const snapshot = await readWatchSnapshot(
      url.searchParams.get("repoPath") ?? defaults.repoPath,
      url.searchParams.get("runId") ?? defaults.runId,
    );
    return json(200, snapshot);
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return text(200, await readStaticAsset("index.html"), "text/html; charset=utf-8");
  }

  if (url.pathname === "/app.js") {
    return text(200, await readStaticAsset("app.js"), "application/javascript; charset=utf-8");
  }

  if (url.pathname === "/styles.css") {
    return text(200, await readStaticAsset("styles.css"), "text/css; charset=utf-8");
  }

  return text(404, "Not found", "text/plain; charset=utf-8");
}

export interface RequestContext {
  url: string;
}

export interface ResponsePayload {
  statusCode: number;
  body: string;
  contentType: string;
}

function json(statusCode: number, body: unknown): ResponsePayload {
  return {
    statusCode,
    body: JSON.stringify(body, null, 2),
    contentType: "application/json; charset=utf-8",
  };
}

function text(statusCode: number, body: string, contentType: string): ResponsePayload {
  return { statusCode, body, contentType };
}

async function readStaticAsset(file: string): Promise<string> {
  const directPath = resolve(moduleDirectory, "static", file);
  if (existsSync(directPath)) {
    return readFile(directPath, "utf8");
  }
  return readFile(resolve(moduleDirectory, "..", "..", "src", "watch-v2", "static", file), "utf8");
}
