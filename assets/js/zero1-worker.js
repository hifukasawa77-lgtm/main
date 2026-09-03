// ZERO-1 Mobile のモデルを動かす worker。
//
// ★LLMの読み込み（数百MB〜2.5GBの取得・WebAssemblyのコンパイル・GPUへの転送）を
//   画面と同じ糸で回すと、**その数分間まるごと画面が固まる**。進捗も再描画されないので
//   「0%のまま動かない」ように見え、実際には進んでいるのか止まっているのかも分からない。
//   ここへ追い出すと画面の糸が空くので、進捗も経過時間も出し続けられる。
//
// ★**この糸は「作れても動かない」ことがある**。読み込みに失敗しても worker は
//   例外を投げてくれず、ただ黙る。呼んだ側は返事を待ち続けて**0%のまま永久に止まる**
//   （2026-09-03 深澤報告。経過時計だけが動き、進捗は1度も出なかった）。
//   そこで「動き出した」ことを必ず自分から知らせ、失敗したらその理由も送る。
//
// ★版はページの importmap と必ず同じにすること。ずれると integrity を通った版とは
//   **別の版**を読み込んでしまう（scripts/verify-zero1-mobile.mjs の検査が突き合わせる）。
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/lib/index.js';

// 取りこぼしを作らないよう、何よりも先に「黙って死ぬ」経路を塞ぐ
self.addEventListener('unhandledrejection', (event) => {
  self.postMessage({ zero1:'failed', message: `${event.reason?.name ?? 'Error'}: ${event.reason?.message ?? event.reason}` });
});

try {
  const { WebWorkerMLCEngineHandler } = await import(WEBLLM_URL);
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (event) => { handler.onmessage(event); };
  // ここまで来て初めて「使える」。呼んだ側はこの合図を待ってから仕事を渡す
  self.postMessage({ zero1:'ready' });
} catch (cause) {
  self.postMessage({ zero1:'failed', message: `${cause?.name ?? 'Error'}: ${cause?.message ?? cause}` });
}
