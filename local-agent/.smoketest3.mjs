import { chat } from "./lib/ollama.js";
import { TOOL_DEFS } from "./lib/tools.js";

const messages = [
  { role: "system", content: "あなたはツールを使えるアシスタントです。" },
  { role: "user", content: "hello.txt というファイルを作って、中身に「テスト」と書いて" },
];

const msg1 = await chat({ model: "qwen2.5", messages, tools: TOOL_DEFS });
console.log("=== assistant message 1 ===");
console.log(JSON.stringify(msg1, null, 2));

messages.push(msg1);
if (msg1.tool_calls?.length) {
  const call = msg1.tool_calls[0];
  console.log("=== call.id ===", call.id);
  messages.push({
    role: "tool",
    tool_call_id: call.id,
    name: call.function.name,
    content: "書き込み完了: hello.txt (9文字)",
  });
  const msg2 = await chat({ model: "qwen2.5", messages, tools: TOOL_DEFS });
  console.log("=== assistant message 2 (after tool result) ===");
  console.log(JSON.stringify(msg2, null, 2));
}
