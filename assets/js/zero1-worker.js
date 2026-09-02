// ZERO-1 Mobile のモデルを動かす worker。
//
// ★LLMの読み込み（数百MB〜2.5GBの取得・WebAssemblyのコンパイル・GPUへの転送）を
//   画面と同じ糸で回すと、**その数分間まるごと画面が固まる**。進捗も再描画されないので
//   「0%のまま動かない」ように見え、実際には進んでいるのか止まっているのかも分からない
//   （2026-09-03 深澤報告。画面の一部だけが描き変わる崩れ方をしていた）。
//   ここへ追い出すと画面の糸が空くので、進捗も経過時間も出し続けられる。
//
// ★版はページの importmap と必ず同じにすること。ずれると integrity を通った版とは
//   **別の版**を読み込んでしまう（scripts/verify-zero1-mobile.mjs の検査が突き合わせる）。
//   ページ本体は importmap の integrity で改ざんを検知しており、ここは同じURLを読むので
//   同一セッションでは検証済みのものがブラウザのキャッシュから使われる。
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/lib/index.js';

const { WebWorkerMLCEngineHandler } = await import(WEBLLM_URL);
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event) => { handler.onmessage(event); };
