import test from "node:test";
import assert from "node:assert/strict";
import { classifyOpenAiFailure, createAppServer, extractUpstreamErrorMessage } from "../src/server.js";

test("streams mock chat responses over SSE", async () => {
  process.env.MOCK_STREAM_TEXT = "hello world";
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /event: token/);
  assert.match(body, /hello/);
  assert.match(body, /event: done/);

  delete process.env.MOCK_STREAM_TEXT;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("fails clearly when no api key is configured", async () => {
  delete process.env.MOCK_STREAM_TEXT;
  delete process.env.OPENAI_API_KEY;
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.message, "OPENAI_API_KEY is not configured.");

  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("surfaces nested upstream error payloads with account-state classification", async () => {
  process.env.MOCK_OPENAI_EVENTS = 'data: {"type":"error","error":{"message":"You exceeded your current quota.","code":"insufficient_quota"}}\n\n';
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /event: error/);
  assert.match(body, /You exceeded your current quota/);
  assert.match(body, /account_state_error/);

  delete process.env.MOCK_OPENAI_EVENTS;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("surfaces nested response.failed payloads with configuration classification", async () => {
  process.env.MOCK_OPENAI_EVENTS = 'data: {"type":"response.failed","response":{"error":{"message":"The model is not available.","code":"model_not_found"}}}\n\n';
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /event: error/);
  assert.match(body, /The model is not available/);
  assert.match(body, /configuration_error/);

  delete process.env.MOCK_OPENAI_EVENTS;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("extracts nested upstream messages and classifications directly", () => {
  assert.equal(
    extractUpstreamErrorMessage({ response: { error: { message: "Billing is disabled." } } }),
    "Billing is disabled.",
  );
  assert.equal(
    classifyOpenAiFailure({ message: "Billing is disabled.", code: "billing_hard_limit_reached" }),
    "account_state_error",
  );
});
