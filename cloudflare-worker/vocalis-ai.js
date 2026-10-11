import '../assets/vocalis/song-core.js';
const SongCoreModule = globalThis.SongCore;

const MODELS = [
  { id: '@cf/google/gemma-3-12b-it', input: 0.345, output: 0.556 },
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', input: 0.045, output: 0.384 },
  { id: '@cf/meta/llama-3.1-8b-instruct', input: 0.282, output: 0.827 },
];

function tokens(text) { return String(text || '').length; }
function estimate(model, prompt, output) {
  return Number((((tokens(prompt) * model.input) + (tokens(output) * model.output)) / 1_000_000).toFixed(7));
}

async function generate(env, prompt, maxTokens) {
  let lastError;
  let totalUsd = 0;
  for (const model of MODELS) {
    try {
      const result = await env.AI.run(model.id, {
        messages: [{ role: 'system', content: 'Return only valid JSON. Follow the requested schema exactly.' }, { role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.8,
      });
      const output = result.response || result.choices?.[0]?.message?.content || '';
      totalUsd += estimate(model, prompt, output);
      const cleaned = output.replace(/^\uFEFF/, '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      return { model: model.id, output: cleaned, estimatedUsd: totalUsd };
    } catch (error) { lastError = error; }
  }
  throw lastError || Error('Workers AIモデルが利用できません。');
}

export async function handleVocalSong(env, body) {
  try {
    const request = SongCoreModule.validateRequest(body);
    const prompt = `テーマ=${request.theme} 長さ=${request.minutes}分 声=${request.voice} ジャンル=${request.genre}。
JSONのみで日本語歌詞と作曲設計を返す。形式:
{"title":"曲名","bpm":96,"sections":[{"name":"Aメロ","weight":2,"phrases":[{"text":"歌詞の一節","notes":[{"pitch":60,"duration":0.5,"lyric":"あ"}]}]}]}
制約: 2〜8 sections。weight比で時間配分。各フレーズは歌詞と対応する音符。pitch MIDIは${request.voice==='male'?'48〜72':'60〜84'}。音符は0.25〜2拍、1〜3音/モーラ。独創的で自然に。JSON以外は出力しない。`;
    const generated = await generate(env, prompt, 900);
    const plan = JSON.parse(generated.output);
    const result = SongCoreModule.compile(plan, request);
    return { status: 200, body: { ...result, usage: { kind: 'song', model: generated.model, estimated: true, estimatedUsd: generated.estimatedUsd } } };
  } catch (error) {
    if (error instanceof SyntaxError) return { status: 502, body: { error: 'AIの曲データを解析できませんでした。再試行してください。' } };
    return { status: Number(error.status) || 502, body: { error: error.message || 'AI曲生成に失敗しました。' } };
  }
}

export async function handleVocalPortrait(env, body) {
  try {
    const profile = body.profile;
    if (!profile || typeof profile.appearance !== 'string' || !profile.appearance.trim()) return { status: 400, body: { error: '顔の説明を入力してください。' } };
    const prompt = `Create an original character portrait for an AI virtual singer. Character name: ${profile.name}. Adult ${profile.voice === 'male' ? 'male' : 'female'} character. Appearance: ${profile.appearance}. Art direction: ${profile.style === 'アニメ' ? 'polished anime illustration' : profile.style === '3D' ? 'stylized high quality 3D render' : 'beautiful digital illustration'}. Square bust portrait, face and hair fully visible, luminous lavender and sky-blue background, studio lighting. One character only. No words, no logos, no watermark.`;
    const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, width: 512, height: 512, num_steps: 4 });
    const image = 'data:image/jpeg;base64,' + result.image;
    return { status: 200, body: { profile, image, usage: { kind: 'portrait', model: '@cf/black-forest-labs/flux-1-schnell', estimated: true, estimatedUsd: 0.0004224 } } };
  } catch (error) {
    return { status: 502, body: { error: error.message || 'AI顔生成に失敗しました。' } };
  }
}
