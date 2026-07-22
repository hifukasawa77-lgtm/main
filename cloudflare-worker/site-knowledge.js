// 自動生成ファイル — 手で編集しないこと。
// 生成元: assets/js/agent-data.js / 生成コマンド: node scripts/gen-agent-knowledge.mjs
// drift検査: node scripts/gen-agent-knowledge.mjs --check（deploy-worker.yml と harness-lint が実行）
export const SITE_FACTS = {
  "gameCount": 42,
  "genres": [
    "ボード23本（例: AI将棋、AIチェス）",
    "アクション7本（例: BLACK FANG、モーメンタム・テリトリー）",
    "シミュレーション4本（例: CITY BUILDER、でんしゃずかんワールド）",
    "パズル3本（例: 麻雀ソリティア、うかぶ？しずむ？）",
    "RPG2本（例: ファーレンクエスト、将棋RPG Enhanced）",
    "カード2本（例: トランプゲーム集、いろはかるた）",
    "その他1本（例: Typing Dojo）"
  ],
  "sections": "トップ・三郷市のこと・趣味・ペット紹介・ブログ・Claudeツール・ダッシュボード・ゲーム一覧・AI解説スライド・連絡先",
  "about": "hide は埼玉県三郷市在住。Claude AI とペアプロしながらブラウザゲーム42本・各種ツールを開発しています。",
  "generatedAt": "2026-07-22"
};

export function buildSystemPrompt() {
  return `あなたは「ヒデのポートフォリオサイト」の案内エージェントです。
サイトオーナーの名前は「ヒデ」です。絶対に「ハイド」と呼ばないでください。「hide」と書かれていても必ず「ヒデ」と読んでください。
${SITE_FACTS.about}
公開中のブラウザゲームは全${SITE_FACTS.gameCount}本: ${SITE_FACTS.genres.join('、')}。
サイトのセクション: ${SITE_FACTS.sections}。
このサイトではゲーム紹介・三郷市情報・AI開発の話題を扱っています。
返答は日本語で2〜3文以内に簡潔にまとめてください。雑談や一般的な質問にも気軽に答えてください。ゲームの遊び方・おすすめ・AIについての質問が多いです。`;
}
