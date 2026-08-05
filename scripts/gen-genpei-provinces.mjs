#!/usr/bin/env node
/*
 * gen-genpei-provinces.mjs — 源平争乱記の令制国データを生成する
 *
 * 戦国風雲記の assets/sengoku/provinces.json（65件）を読み、12世紀の令制国 66 国へ
 * 再編して assets/genpei/provinces.json を書き出す。詳細設計 1.1 の仕様。
 *
 *   改称  南越後→越後 / 北信濃→信濃 / 東土佐→土佐
 *   統合  南近江＋北近江→近江（neighbors は和集合、自己参照を除く）
 *   追加  淡路（南海道）/ 隠岐（山陰道）
 *   除外  壱岐・対馬（地図画像の範囲外。西海道は9国）
 *   置換  kokudaka（太閤検地由来）→ tasu（田数・町。12世紀の概算）
 *   付与  region を五畿七道へ / famineZone（養和の飢饉の地域係数キー）
 *
 * ★ assets/sengoku/ は読むだけで、書き戻さない（sengoku.html 側の資産を汚さない）。
 * ★ id は据え置く。変えると neighbors の参照が無言で切れる。
 *
 * 使い方: node scripts/gen-genpei-provinces.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/sengoku/provinces.json');
const OUT = path.join(ROOT, 'assets/genpei/provinces.json');

/* ---- 五畿七道（詳細設計 2.1 の「道」列と一致させること） ---- */
const CIRCUIT = {
  kinai:  ['yamashiro', 'yamato', 'kawachi', 'izumi', 'settsu'],
  tokaido: ['iga', 'ise', 'shima', 'owari', 'mikawa', 'totomi', 'suruga', 'izu',
            'kai', 'sagami', 'musashi', 'awa_kanto', 'kazusa', 'shimousa', 'hitachi'],
  tosando: ['omi', 'mino', 'hida', 'shinano', 'kozuke', 'shimotsuke', 'mutsu', 'dewa'],
  hokurikudo: ['wakasa', 'echizen', 'kaga', 'noto', 'etchu', 'echigo', 'sado'],
  sanindo: ['tanba', 'tango', 'tajima', 'inaba', 'hoki', 'izumo', 'iwami', 'oki'],
  sanyodo: ['harima', 'mimasaka', 'bizen', 'bitchu', 'bingo', 'aki', 'suo', 'nagato'],
  nankaido: ['kii', 'awaji', 'awa_shikoku', 'sanuki', 'iyo', 'tosa'],
  saikaido: ['buzen', 'bungo', 'chikuzen', 'chikugo', 'hizen', 'higo', 'hyuga', 'osumi', 'satsuma'],
};
const CIRCUIT_JP = {
  kinai: '畿内', tokaido: '東海道', tosando: '東山道', hokurikudo: '北陸道',
  sanindo: '山陰道', sanyodo: '山陽道', nankaido: '南海道', saikaido: '西海道',
};

/* ---- 養和の飢饉の地域係数キー（基本設計 4.7 / RULE.famine.coef） ---- */
const FAMINE_ZONE = {
  ou:        ['mutsu', 'dewa'],
  bando:     ['sagami', 'musashi', 'awa_kanto', 'kazusa', 'shimousa', 'hitachi', 'kozuke', 'shimotsuke'],
  hokuriku:  ['wakasa', 'echizen', 'kaga', 'noto', 'etchu', 'echigo', 'sado'],
  tokai:     ['izu', 'suruga', 'totomi', 'mikawa', 'owari', 'kai', 'shinano', 'hida', 'mino'],
  kinai:     ['yamashiro', 'yamato', 'kawachi', 'izumi', 'settsu', 'omi', 'iga', 'ise', 'shima'],
  // 残りはすべて saikoku（山陰・山陽・南海・西海）
};

/* ---- 12世紀の田数（町）。kokudaka から導いた概算に、12世紀と16世紀で
       開発度が大きく違う国だけ倍率で補正する。史実着想の近似値。 ---- */
const TASU_BASE = 0.9;              // kokudaka(千石) → 田数(町) の基準係数
const TASU_ADJUST = {
  // 12世紀はまだ開発が浅い（太閤検地の値をそのまま使うと過大になる）
  mutsu: 0.50, dewa: 0.50, hida: 0.70, kai: 0.80, shinano: 0.80,
  // 近世に大規模な新田開発が入った国
  owari: 0.80, mino: 0.85, omi: 0.85, echigo: 0.75, settsu: 0.85, harima: 0.85,
  // 和名類聚抄の田数では東国の条里が大きい
  musashi: 1.20, shimousa: 1.20, kazusa: 1.15, hitachi: 1.20, shimotsuke: 1.10,
  // 島津荘・宇佐宮領など大荘園を抱え、12世紀の生産力が相対的に高い
  hyuga: 1.30, osumi: 1.15, buzen: 1.15, chikuzen: 1.10,
};

function circuitOf(id) {
  for (const [k, list] of Object.entries(CIRCUIT)) if (list.includes(id)) return k;
  throw new Error(`道が未定義の国: ${id}`);
}
function famineZoneOf(id) {
  for (const [z, list] of Object.entries(FAMINE_ZONE)) if (list.includes(id)) return z;
  return 'saikoku';
}
function tasuOf(id, kokudaka) {
  return Math.max(5, Math.round(kokudaka * TASU_BASE * (TASU_ADJUST[id] ?? 1)));
}

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const byId = new Map(src.provinces.map(p => [p.id, p]));

/* ---- 1. 統合: 北近江(kita_omi) を 南近江(omi) へ畳む ---- */
const omi = byId.get('omi'), kitaOmi = byId.get('kita_omi');
omi.neighbors = [...new Set([...omi.neighbors, ...kitaOmi.neighbors])]
  .filter(n => n !== 'omi' && n !== 'kita_omi');
// 統合後の中心は両者の中点に寄せる（琵琶湖の東岸沿い）
omi.x = Math.round((omi.x + kitaOmi.x) / 2);
omi.y = Math.round((omi.y + kitaOmi.y) / 2);
omi.kokudaka += kitaOmi.kokudaka;
byId.delete('kita_omi');
// 他国の neighbors から kita_omi を除き、omi へ寄せる
for (const p of byId.values()) {
  if (!p.neighbors.includes('kita_omi')) continue;
  p.neighbors = [...new Set(p.neighbors.map(n => (n === 'kita_omi' ? 'omi' : n)))]
    .filter(n => n !== p.id);
}

/* ---- 2. 改称（id は据え置く） ---- */
const RENAME = {
  echigo:  { nameJP: '越後', nameEN: 'Echigo' },
  shinano: { nameJP: '信濃', nameEN: 'Shinano' },
  tosa:    { nameJP: '土佐', nameEN: 'Tosa' },
  omi:     { nameJP: '近江', nameEN: 'Omi' },
};
for (const [id, patch] of Object.entries(RENAME)) Object.assign(byId.get(id), patch);

/* ---- 3. 追加: 淡路・隠岐 ---- */
// x/y は論理座標(0..1000 x 0..650)。淡路は摂津・阿波・讃岐の間の海上、
// 隠岐は出雲の北の海上に置く。
byId.set('awaji', {
  id: 'awaji', nameJP: '淡路', nameEN: 'Awaji', region: '', x: 372, y: 442,
  terrain: 'coast', kokudaka: 62, neighbors: ['settsu', 'izumi', 'awa_shikoku', 'sanuki'],
});
byId.set('oki', {
  id: 'oki', nameJP: '隠岐', nameEN: 'Oki', region: '', x: 214, y: 292,
  terrain: 'coast', kokudaka: 18, neighbors: ['izumo', 'hoki'],
});
// 追加国を隣国側の neighbors にも入れる（片方向だと海路判定が非対称になる）
for (const [add, ns] of [['awaji', ['settsu', 'izumi', 'awa_shikoku', 'sanuki']], ['oki', ['izumo', 'hoki']]]) {
  for (const n of ns) {
    const p = byId.get(n);
    if (!p.neighbors.includes(add)) p.neighbors.push(add);
  }
}

/* ---- 4. 道・飢饉地域・田数の付与 ---- */
const provinces = [...byId.values()].map(p => ({
  id: p.id,
  nameJP: p.nameJP,
  nameEN: p.nameEN,
  circuit: circuitOf(p.id),
  region: CIRCUIT_JP[circuitOf(p.id)],
  famineZone: famineZoneOf(p.id),
  x: p.x,
  y: p.y,
  terrain: p.terrain,
  tasu: tasuOf(p.id, p.kokudaka),
  neighbors: [...new Set(p.neighbors)].sort(),
}));

/* ---- 5. 整合チェック（壊れたまま書き出さない） ---- */
const ids = new Set(provinces.map(p => p.id));
const errors = [];
if (provinces.length !== 66) errors.push(`国数が66でない: ${provinces.length}`);
for (const p of provinces) {
  for (const n of p.neighbors) {
    if (!ids.has(n)) errors.push(`${p.id}: 存在しない隣国 ${n}`);
    else if (!byId.get(n).neighbors.includes(p.id) && !provinces.find(q => q.id === n).neighbors.includes(p.id)) {
      errors.push(`${p.id} ⇔ ${n}: 隣接が片方向`);
    }
  }
  if (p.neighbors.includes(p.id)) errors.push(`${p.id}: 自己参照`);
}
const counts = {};
for (const p of provinces) counts[p.region] = (counts[p.region] ?? 0) + 1;
const EXPECT = { 畿内: 5, 東海道: 15, 東山道: 8, 北陸道: 7, 山陰道: 8, 山陽道: 8, 南海道: 6, 西海道: 9 };
for (const [k, v] of Object.entries(EXPECT)) {
  if (counts[k] !== v) errors.push(`${k}の国数が${v}でない: ${counts[k] ?? 0}`);
}
if (errors.length) {
  console.error('✗ 生成を中止しました:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  version: 1,
  note: '12世紀の令制国66。assets/sengoku/provinces.json から scripts/gen-genpei-provinces.mjs で生成。'
      + 'x/y は論理座標(0..1000 x 0..650)。tasu は田数(町)の概算で史実着想の近似値。'
      + 'circuit/region は五畿七道、famineZone は養和の飢饉の地域係数キー。',
  generatedFrom: 'assets/sengoku/provinces.json',
  logicalWidth: src.logicalWidth,
  logicalHeight: src.logicalHeight,
  outline: src.outline,
  provinces,
}, null, 1) + '\n', 'utf8');

console.log(`✓ ${path.relative(ROOT, OUT)} — ${provinces.length}国`);
for (const [k, v] of Object.entries(counts)) console.log(`   ${k}: ${v}`);
