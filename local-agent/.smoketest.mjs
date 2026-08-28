import { makeToolImpls } from "./lib/tools.js";
const tools = makeToolImpls("C:\\Users\\hifuk\\main\\local-agent\\.testroot");
const res = await tools.write_file({ path: "hello.txt", content: "ローカルエージェント動作確認" });
console.log("RESULT:", res);
