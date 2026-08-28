import readline from "node:readline/promises";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ans = await rl.question("実行しますか？ [y/N]: ");
console.log("GOT:", JSON.stringify(ans));
rl.close();
