import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "..", "public");

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      if (!request.url) {
        writeJson(response, 404, { message: "Not found." });
        return;
      }

      const url = new URL(request.url, "http://localhost");
      if (request.method === "GET") {
        await serveStatic(url.pathname, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const body = await readJsonBody(request);
        await handleChat(body, response);
        return;
      }

      writeJson(response, 404, { message: "Not found." });
    } catch (error) {
      writeJson(response, 500, {
        message: error instanceof Error ? error.message : "Unexpected server error.",
      });
    }
  });
}

export async function startServer(port = Number(process.env.PORT ?? "3000")) {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

async function serveStatic(pathname, response) {
  const filePath = pathname === "/" ? join(publicDir, "index.html") : join(publicDir, pathname.slice(1));
  try {
    const payload = await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(payload);
  } catch {
    writeJson(response, 404, { message: "Not found." });
  }
}

async function handleChat(body, response) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    writeJson(response, 400, { message: "messages is required." });
    return;
  }

  if (process.env.MOCK_STREAM_TEXT) {
    response.writeHead(200, sseHeaders());
    for (const chunk of process.env.MOCK_STREAM_TEXT.split(/(\s+)/u)) {
      if (!chunk) {
        continue;
      }
      writeSse(response, "token", { text: chunk });
    }
    writeSse(response, "done", { ok: true });
    response.end();
    return;
  }

  if (process.env.MOCK_OPENAI_EVENTS) {
    response.writeHead(200, sseHeaders());
    await relayResponseStream(createMockUpstreamStream(process.env.MOCK_OPENAI_EVENTS), response);
    response.end();
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    writeJson(response, 500, { message: "OPENAI_API_KEY is not configured." });
    return;
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const message = await upstream.text();
    writeJson(response, 502, { message: message || "OpenAI upstream request failed." });
    return;
  }

  response.writeHead(200, sseHeaders());
  await relayResponseStream(upstream.body, response);
  response.end();
}

async function relayResponseStream(body, response) {
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalState = null;

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      for (const payload of parseUpstreamData(eventBlock)) {
        const action = mapUpstreamPayload(payload);
        if (!action) {
          continue;
        }
        if (action.type === "token") {
          writeSse(response, "token", { text: action.text });
          continue;
        }
        if (action.type === "done" && terminalState !== "error") {
          terminalState = "done";
          writeSse(response, "done", { ok: true });
          continue;
        }
        if (action.type === "error" && terminalState !== "error") {
          terminalState = "error";
          writeSse(response, "error", {
            message: action.message,
            classification: action.classification,
            code: action.code,
          });
        }
      }
    }
  }
}

function parseUpstreamData(block) {
  return block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
}

function mapUpstreamPayload(payload) {
  if (payload === "[DONE]") {
    return null;
  }

  try {
    const event = JSON.parse(payload);
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      return { type: "token", text: event.delta };
    }
    if (event.type === "response.completed" || event.type === "response.output_text.done") {
      return null;
    }
    if (event.type === "error") {
      return buildErrorAction(event);
    }
    if (event.type === "response.failed") {
      return null;
    }
    return null;
  } catch {
    return buildErrorAction({ message: "Malformed streaming event from upstream.", code: "malformed_upstream_event" });
  }
}

function buildErrorAction(source) {
  const message = extractUpstreamErrorMessage(source);
  const code = extractUpstreamErrorCode(source);
  return {
    type: "error",
    message,
    code,
    classification: classifyOpenAiFailure({ message, code }),
  };
}

export function extractUpstreamErrorMessage(source) {
  if (!source || typeof source !== "object") {
    return "OpenAI streaming error.";
  }
  if (typeof source.message === "string" && source.message.length > 0) {
    return source.message;
  }
  return "OpenAI streaming error.";
}

function extractUpstreamErrorCode(source) {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  if (typeof source.code === "string" && source.code.length > 0) {
    return source.code;
  }
  return undefined;
}

export function classifyOpenAiFailure({ message, code }) {
  const fingerprint = `${code ?? ""} ${message}`.toLowerCase();
  if (fingerprint.includes("insufficient_quota") || fingerprint.includes("quota") || fingerprint.includes("billing")) {
    return "account_state_error";
  }
  if (fingerprint.includes("invalid_api_key") || fingerprint.includes("incorrect api key") || fingerprint.includes("unsupported") || fingerprint.includes("model")) {
    return "configuration_error";
  }
  return "configuration_error";
}

function createMockUpstreamStream(payload) {
  return Readable.from([Buffer.from(payload, "utf8")]);
}

function sseHeaders() {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  };
}

function writeSse(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".html":
    default:
      return "text/html; charset=utf-8";
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  const address = server.address();
  if (address && typeof address === "object") {
    process.stdout.write(`chat-mini-web listening on http://localhost:${address.port}\n`);
  }
}
