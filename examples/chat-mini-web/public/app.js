const form = document.querySelector("#composer");
const input = document.querySelector("#message-input");
const messagesNode = document.querySelector("#messages");
const statusNode = document.querySelector("#status");
const errorNode = document.querySelector("#error");
const sendButton = document.querySelector("#send-button");

const messages = [];

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || sendButton.disabled) {
    return;
  }

  hideError();
  setPending(true, "Streaming...");

  const userMessage = { role: "user", content: text };
  messages.push(userMessage);
  renderMessages();
  input.value = "";

  const assistantMessage = { role: "assistant", content: "" };
  messages.push(assistantMessage);
  renderMessages();

  try {
    await streamAssistantResponse(messages, (delta) => {
      assistantMessage.content += delta;
      renderMessages();
    });
    setPending(false, "Idle");
  } catch (error) {
    messages.pop();
    renderMessages();
    setPending(false, "Idle");
    showError(error instanceof Error ? error.message : "Chat request failed.");
  }
});

function renderMessages() {
  messagesNode.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("article");
    item.className = `message message-${message.role}`;
    item.textContent = message.content || (message.role === "assistant" ? "..." : "");
    messagesNode.appendChild(item);
  }
}

async function streamAssistantResponse(history, onToken) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ messages: history }),
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let receivedText = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (!event) {
        continue;
      }
      if (event.type === "token") {
        receivedText = true;
        onToken(event.data.text);
      }
      if (event.type === "done") {
        sawDone = true;
      }
      if (event.type === "error") {
        throw new Error(event.data.message || "OpenAI streaming error.");
      }
    }
  }

  if (!sawDone && !receivedText) {
    throw new Error("The assistant did not return any output.");
  }
}

function parseSseBlock(block) {
  const lines = block.split("\n");
  let type = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      type = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return {
    type,
    data: JSON.parse(dataLines.join("\n")),
  };
}

async function readErrorResponse(response) {
  const raw = await response.text();
  if (!raw) {
    return "Request failed.";
  }
  try {
    const payload = JSON.parse(raw);
    return payload.message || payload.error?.message || raw;
  } catch {
    return raw;
  }
}

function setPending(pending, label) {
  sendButton.disabled = pending;
  input.disabled = pending;
  statusNode.textContent = label;
}

function showError(message) {
  errorNode.hidden = false;
  errorNode.textContent = message;
}

function hideError() {
  errorNode.hidden = true;
  errorNode.textContent = "";
}
