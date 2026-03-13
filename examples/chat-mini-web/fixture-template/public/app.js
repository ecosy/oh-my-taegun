export function createInitialChatState() {
  return {
    messages: [],
    pending: false,
    status: "Idle",
    error: "",
  };
}

export function reduceChatState(state, event) {
  switch (event.type) {
    case "submit":
      return {
        messages: [...state.messages, { role: "user", content: event.text }, { role: "assistant", content: "" }],
        pending: true,
        status: "Streaming...",
        error: "",
      };
    case "token":
      return {
        ...state,
        messages: state.messages,
      };
    case "done":
      return state;
    case "error":
      return {
        ...state,
        error: "OpenAI streaming error.",
      };
    default:
      return state;
  }
}

export function parseSseBlock(block) {
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

export async function readErrorResponse() {
  return "Request failed.";
}

export async function streamAssistantResponse(history, onEvent) {
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
        onEvent({ type: "token", text: event.data.text });
      }
      if (event.type === "error") {
        throw new Error("OpenAI streaming error.");
      }
    }
  }
}

function render(state, nodes) {
  nodes.messagesNode.innerHTML = "";
  for (const message of state.messages) {
    const item = document.createElement("article");
    item.className = `message message-${message.role}`;
    item.textContent = message.content || (message.role === "assistant" ? "..." : "");
    nodes.messagesNode.appendChild(item);
  }
  nodes.sendButton.disabled = state.pending;
  nodes.input.disabled = state.pending;
  nodes.statusNode.textContent = state.status;
  nodes.errorNode.hidden = !state.error;
  nodes.errorNode.textContent = state.error;
}

function mountChatApp() {
  const form = document.querySelector("#composer");
  const input = document.querySelector("#message-input");
  const messagesNode = document.querySelector("#messages");
  const statusNode = document.querySelector("#status");
  const errorNode = document.querySelector("#error");
  const sendButton = document.querySelector("#send-button");
  if (!form || !input || !messagesNode || !statusNode || !errorNode || !sendButton) {
    return;
  }

  const nodes = { input, messagesNode, statusNode, errorNode, sendButton };
  let state = createInitialChatState();
  render(state, nodes);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || state.pending) {
      return;
    }

    state = reduceChatState(state, { type: "submit", text });
    render(state, nodes);
    input.value = "";

    try {
      await streamAssistantResponse(
        state.messages.filter((message) => message.role === "user"),
        (streamEvent) => {
          state = reduceChatState(state, streamEvent);
          render(state, nodes);
        },
      );
    } catch (error) {
      state = reduceChatState(state, {
        type: "error",
        message: error instanceof Error ? error.message : "Chat request failed.",
      });
      render(state, nodes);
    }
  });
}

if (typeof document !== "undefined") {
  mountChatApp();
}
