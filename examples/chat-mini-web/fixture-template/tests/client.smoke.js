import test from "node:test";
import assert from "node:assert/strict";
import { createInitialChatState, reduceChatState, readErrorResponse } from "../public/app.js";

test("appends assistant tokens and completes pending state", () => {
  let state = createInitialChatState();
  state = reduceChatState(state, { type: "submit", text: "hi" });
  state = reduceChatState(state, { type: "token", text: "hello" });
  state = reduceChatState(state, { type: "token", text: " world" });
  state = reduceChatState(state, { type: "done" });

  assert.equal(state.pending, false);
  assert.equal(state.status, "Idle");
  assert.equal(state.messages.at(-1).content, "hello world");
});

test("surfaces exact upstream error messages", () => {
  let state = createInitialChatState();
  state = reduceChatState(state, { type: "submit", text: "hi" });
  state = reduceChatState(state, { type: "error", message: "You exceeded your current quota." });

  assert.equal(state.pending, false);
  assert.equal(state.error, "You exceeded your current quota.");
});

test("parses JSON error responses", async () => {
  const response = new Response(JSON.stringify({ message: "OPENAI_API_KEY is not configured." }));
  assert.equal(await readErrorResponse(response), "OPENAI_API_KEY is not configured.");
});
