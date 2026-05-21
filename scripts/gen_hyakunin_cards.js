'use strict';
const fs   = require('fs');
const path = require('path');

/* ================================================================
   百人一首 絵札 SVG 生成スクリプト
   - emperor  : 天皇・院（冠＋紫袍）
   - empress  : 女帝（冠＋緋袍・黒髪）
   - monk     : 法師・僧正（袈裟＋頭巾）
   - female   : 女流歌人（長髪＋十二単）
   - noble    : 男性貴族（立烏帽子＋狩衣）
   ================================================================ */

// ── 歌人タイプ分類 ──────────────────────────────────────────────
const TYPES = {
  emperor : [1,13,15,68,77,99,100],
  empress : [2],
  monk    : [8,12,21,47,66,69,70,76,82,85,86,87,95,96],
  female  : [9,19,38,53,54,56,57,58,59,60,61,62,65,67,72,80,88,89,90,92],
};
function typeOf(id) {
  for (const [t,ids] of Object.entries(TYPES)) if (ids.includes(id)) return t;
  return 'noble';
}

// ── カラーパレット（タイプ別、IDでローテーション）────────────────
const NOBLE_PAL = [
  { c1:'#5B3FA0', c2:'#C41E3A', c3:'#F8ECD4' },
  { c1:'#1B4D8E', c2:'#8B0000', c3:'#FFF8E7' },
  { c1:'#2E7D32', c2:'#B8860B', c3:'#FFF0DC' },
  { c1:'#8B1A1A', c2:'#2E5D1B', c3:'#FAEBD7' },
  { c1:'#4B5320', c2:'#8B0000', c3:'#F5DEB3' },
  { c1:'#4B0082', c2:'#CD853F', c3:'#FFFFF0' },
  { c1:'#1A5276', c2:'#922B21', c3:'#FEF9E7' },
  { c1:'#6E2C00', c2:'#1A5276', c3:'#FDFEFE' },
  { c1:'#0B3D91', c2:'#6E2C00', c3:'#FFF5E6' },
  { c1:'#1B6CA8', c2:'#4A235A', c3:'#FDFEFE' },
];
const MONK_PAL  = [
  { c1:'#7B6B56', c2:'#C8602A', c3:'#E8D5B0' },
  { c1:'#5C5040', c2:'#B8860B', c3:'#E0CEAA' },
  { c1:'#4A4238', c2:'#8B7355', c3:'#DDD0B0' },
  { c1:'#3D3530', c2:'#CD853F', c3:'#E5D8C0' },
];
const FEMALE_PAL = [
  { c1:'#8B1A1A', c2:'#5B3FA0', c3:'#F8ECD4' },
  { c1:'#8B0000', c2:'#1B4D8E', c3:'#FFF8E7' },
  { c1:'#2E5D8B', c2:'#8B1A1A', c3:'#FFF0DC' },
  { c1:'#6B1A8B', c2:'#2E7D32', c3:'#FAEBD7' },
  { c1:'#B8860B', c2:'#8B1A1A', c3:'#FFF8E7' },
  { c1:'#1A5276', c2:'#8B1A1A', c3:'#FFF5E6' },
  { c1:'#4A235A', c2:'#C41E3A', c3:'#FFF0E6' },
  { c1:'#8B4513', c2:'#1B4D8E', c3:'#FFF8F0' },
];

function pal(id, arr) { return arr[(id - 1) % arr.length]; }

// ── SVG 人物図 ────────────────────────────────────────────────────
// 座標系: カード248×380, イラストエリア y=60〜160, x=14〜160（左寄せ）

function svgNoble(id) {
  const p = pal(id, NOBLE_PAL);
  const sk = '#F2C080', hat = '#1a1808';
  return `
    <!-- 台座（畳風） -->
    <ellipse cx="84" cy="157" rx="55" ry="6" fill="#C8A870" opacity="0.3"/>
    <!-- 裾・袴 -->
    <path d="M32,157 L36,105 Q58,96 84,94 Q110,96 132,105 L136,157 Z" fill="${p.c1}"/>
    <!-- 左袖 -->
    <path d="M36,105 L14,122 L12,152 L32,157 Z" fill="${p.c1}"/>
    <!-- 右袖 -->
    <path d="M132,105 L154,122 L156,152 L136,157 Z" fill="${p.c1}"/>
    <!-- 第2層（衿） -->
    <path d="M70,94 L66,130 L74,130 L74,94 Z" fill="${p.c2}"/>
    <path d="M92,94 L94,130 L102,130 L98,94 Z" fill="${p.c2}"/>
    <!-- 第3層（内衣） -->
    <path d="M74,94 L74,120 L94,120 L94,94 Z" fill="${p.c3}"/>
    <!-- 頭部 -->
    <ellipse cx="84" cy="82" rx="14" ry="16" fill="${sk}"/>
    <!-- 立烏帽子 -->
    <path d="M74,72 Q76,44 84,36 Q92,44 94,72 Z" fill="${hat}"/>
    <ellipse cx="84" cy="72" rx="13" ry="4.5" fill="#232110"/>
    <!-- 目 -->
    <ellipse cx="78" cy="83" rx="2.8" ry="2" fill="#1a0800"/>
    <ellipse cx="90" cy="83" rx="2.8" ry="2" fill="#1a0800"/>
    <!-- 眉 -->
    <path d="M74,78 Q78,75 81,78" stroke="#1a0800" stroke-width="1.3" fill="none"/>
    <path d="M87,78 Q90,75 94,78" stroke="#1a0800" stroke-width="1.3" fill="none"/>
    <!-- 口 -->
    <path d="M81,90 Q84,93 87,90" stroke="#8B3A2A" stroke-width="1.2" fill="none"/>
    <!-- 笏 -->
    <rect x="104" y="100" width="5" height="54" rx="2.5" fill="#A08858"/>
    <!-- 衣紋の線 -->
    <path d="M80,94 L76,140" stroke="${p.c2}" stroke-width="0.7" opacity="0.5"/>
    <path d="M88,94 L92,140" stroke="${p.c2}" stroke-width="0.7" opacity="0.5"/>`;
}

function svgEmperor(id) {
  const sk = '#F2C080';
  const c1 = (id % 2 === 0) ? '#4B0082' : '#7B1A4A';
  const c2 = '#C41E3A', c3 = '#F8ECD4';
  return `
    <ellipse cx="84" cy="157" rx="55" ry="6" fill="#C8A870" opacity="0.3"/>
    <path d="M28,157 L33,102 Q58,92 84,90 Q110,92 135,102 L140,157 Z" fill="${c1}"/>
    <path d="M33,102 L10,120 L8,152 L28,157 Z" fill="${c1}"/>
    <path d="M135,102 L158,120 L160,152 L140,157 Z" fill="${c1}"/>
    <path d="M70,90 L66,128 L74,128 L74,90 Z" fill="${c2}"/>
    <path d="M94,90 L98,128 L106,128 L102,90 Z" fill="${c2}"/>
    <path d="M74,90 L74,118 L94,118 L94,90 Z" fill="${c3}"/>
    <!-- 頭部 -->
    <ellipse cx="84" cy="79" rx="15" ry="17" fill="${sk}"/>
    <!-- 冠（かんむり）- 平たい公家冠 -->
    <rect x="68" y="62" width="32" height="9" rx="2" fill="#1a1808"/>
    <rect x="71" y="55" width="26" height="8" rx="1.5" fill="#1a1808"/>
    <path d="M80,55 L84,36 L88,55 Z" fill="#1a1808"/>
    <line x1="84" y1="38" x2="84" y2="55" stroke="#B8860B" stroke-width="1"/>
    <!-- 冠の金線装飾 -->
    <line x1="68" y1="66" x2="100" y2="66" stroke="#B8860B" stroke-width="0.8" opacity="0.7"/>
    <!-- 眼・眉・口 -->
    <ellipse cx="78" cy="81" rx="2.8" ry="2" fill="#1a0800"/>
    <ellipse cx="90" cy="81" rx="2.8" ry="2" fill="#1a0800"/>
    <path d="M74,76 Q78,73 81,76" stroke="#1a0800" stroke-width="1.3" fill="none"/>
    <path d="M87,76 Q90,73 94,76" stroke="#1a0800" stroke-width="1.3" fill="none"/>
    <path d="M81,88 Q84,91 87,88" stroke="#8B3A2A" stroke-width="1.2" fill="none"/>
    <!-- 笏 -->
    <rect x="106" y="98" width="5" height="56" rx="2.5" fill="#A08858"/>`;
}

function svgEmpress(id) {
  const sk = '#F5DABC', hair = '#1a1205';
  const c1 = '#8B1A1A', c2 = '#5B3FA0', c3 = '#F8ECD4';
  return `
    <ellipse cx="84" cy="157" rx="60" ry="6" fill="#C8A870" opacity="0.3"/>
    <!-- 裾（広がり） -->
    <path d="M20,157 L28,112 Q55,98 84,96 Q113,98 140,112 L148,157 Z" fill="${c1}"/>
    <!-- 左袖（大振り） -->
    <path d="M28,112 L4,128 L4,155 L20,157 Z" fill="${c1}"/>
    <!-- 右袖 -->
    <path d="M140,112 L164,128 L164,155 L148,157 Z" fill="${c1}"/>
    <!-- 第2層 -->
    <path d="M68,96 L62,138 L72,138 L72,96 Z" fill="${c2}"/>
    <path d="M96,96 L102,138 L112,138 L108,96 Z" fill="${c2}"/>
    <path d="M72,96 L72,126 L108,126 L108,96 Z" fill="${c3}"/>
    <!-- 頭部 -->
    <ellipse cx="84" cy="80" rx="13" ry="15" fill="${sk}"/>
    <!-- 黒髪（左） -->
    <path d="M72,76 Q64,88 62,120 Q58,148 62,157 L68,157 Q66,140 68,116 Q70,92 74,80 Z" fill="${hair}"/>
    <!-- 黒髪（右） -->
    <path d="M96,76 Q104,88 106,120 Q110,148 106,157 L100,157 Q102,140 100,116 Q98,92 92,80 Z" fill="${hair}"/>
    <!-- 冠（女帝） -->
    <rect x="70" y="64" width="28" height="8" rx="2" fill="#1a1808"/>
    <line x1="70" y1="68" x2="98" y2="68" stroke="#B8860B" stroke-width="0.8"/>
    <!-- 目 -->
    <ellipse cx="79" cy="82" rx="2.5" ry="1.8" fill="#1a0800"/>
    <ellipse cx="89" cy="82" rx="2.5" ry="1.8" fill="#1a0800"/>
    <path d="M75,78 Q79,76 82,78" stroke="#1a0800" stroke-width="1.2" fill="none"/>
    <path d="M86,78 Q89,76 93,78" stroke="#1a0800" stroke-width="1.2" fill="none"/>
    <path d="M81,88 Q84,91 87,88" stroke="#8B3A2A" stroke-width="1.1" fill="none"/>
    <!-- 扇 -->
    <path d="M100,108 L118,86" stroke="#B8860B" stroke-width="2" stroke-linecap="round"/>
    <path d="M100,108 Q116,84 130,92" stroke="#B8860B" stroke-width="1" fill="none" opacity="0.6"/>`;
}

function svgMonk(id) {
  const p = pal(id, MONK_PAL);
  const sk = '#E8C89A', head = '#D4A870';
  return `
    <ellipse cx="84" cy="157" rx="50" ry="6" fill="#A89060" opacity="0.3"/>
    <!-- 袈裟・法衣 -->
    <path d="M34,157 L38,108 Q60,100 84,98 Q108,100 130,108 L134,157 Z" fill="${p.c1}"/>
    <!-- 袖 -->
    <path d="M38,108 L16,124 L14,153 L34,157 Z" fill="${p.c1}"/>
    <path d="M130,108 L152,124 L154,153 L134,157 Z" fill="${p.c1}"/>
    <!-- 袈裟の縦線（斜めかけ） -->
    <path d="M84,98 L60,157" stroke="${p.c2}" stroke-width="5" opacity="0.5"/>
    <path d="M84,98 L62,157" stroke="${p.c3}" stroke-width="2" opacity="0.4"/>
    <!-- 内衣 -->
    <path d="M72,98 L70,130 L78,130 L78,98 Z" fill="${p.c2}" opacity="0.7"/>
    <path d="M90,98 L92,130 L100,130 L98,98 Z" fill="${p.c2}" opacity="0.7"/>
    <!-- 頭部（丸い） -->
    <ellipse cx="84" cy="82" rx="14" ry="15" fill="${sk}"/>
    <!-- 剃髪（丸頭） -->
    <ellipse cx="84" cy="72" rx="14" ry="10" fill="${head}"/>
    <!-- 頭巾（一部の法師） -->
    ${id % 3 === 0 ? `<path d="M70,72 Q72,58 84,54 Q96,58 98,72 Z" fill="#2a2010" opacity="0.7"/>` : ''}
    <!-- 目 -->
    <ellipse cx="78" cy="84" rx="2.5" ry="1.8" fill="#1a0800"/>
    <ellipse cx="90" cy="84" rx="2.5" ry="1.8" fill="#1a0800"/>
    <!-- 眉（薄め） -->
    <path d="M75,80 Q78,78 81,80" stroke="#3a2000" stroke-width="1" fill="none"/>
    <path d="M87,80 Q90,78 93,80" stroke="#3a2000" stroke-width="1" fill="none"/>
    <!-- 口 -->
    <path d="M81,90 Q84,93 87,90" stroke="#8B3A2A" stroke-width="1.1" fill="none"/>
    <!-- 数珠（念珠） -->
    <path d="M68,110 Q84,118 100,110" stroke="#3a2800" stroke-width="2" fill="none" stroke-dasharray="4,2"/>
    <!-- 錫杖 or 如意 -->
    <rect x="108" y="96" width="4" height="58" rx="2" fill="#7B6040"/>
    <circle cx="110" cy="96" r="4" fill="#7B6040"/>`;
}

function svgFemale(id) {
  const p = pal(id, FEMALE_PAL);
  const sk = '#F5DABC', hair = '#1a1205';
  return `
    <ellipse cx="84" cy="157" rx="62" ry="6" fill="#C8A870" opacity="0.3"/>
    <!-- 裾（十二単・広がり） -->
    <path d="M16,157 L25,115 Q54,100 84,98 Q114,100 143,115 L152,157 Z" fill="${p.c1}"/>
    <!-- 左袖 -->
    <path d="M25,115 L4,130 L2,155 L16,157 Z" fill="${p.c1}"/>
    <!-- 右袖 -->
    <path d="M143,115 L164,130 L166,155 L152,157 Z" fill="${p.c1}"/>
    <!-- 第2層 -->
    <path d="M66,98 L60,142 L70,142 L70,98 Z" fill="${p.c2}"/>
    <path d="M102,98 L108,142 L118,142 L114,98 Z" fill="${p.c2}"/>
    <path d="M70,98 L70,130 L114,130 L114,98 Z" fill="${p.c3}"/>
    <!-- 裾の重ね（色の帯） -->
    <line x1="16" y1="152" x2="152" y2="152" stroke="${p.c2}" stroke-width="3" opacity="0.5"/>
    <line x1="14" y1="156" x2="154" y2="156" stroke="${p.c1}" stroke-width="2" opacity="0.4"/>
    <!-- 頭部 -->
    <ellipse cx="84" cy="82" rx="13" ry="15" fill="${sk}"/>
    <!-- 長い黒髪（垂らし） -->
    <path d="M72,78 Q62,90 58,120 Q54,148 56,157 L64,157 Q62,140 65,118 Q68,94 74,82 Z" fill="${hair}"/>
    <path d="M96,78 Q106,90 110,120 Q114,148 112,157 L104,157 Q106,140 103,118 Q100,94 94,82 Z" fill="${hair}"/>
    <!-- 前髪 -->
    <path d="M73,72 Q84,68 95,72" stroke="${hair}" stroke-width="4" fill="none"/>
    <!-- 目 -->
    <ellipse cx="79" cy="84" rx="2.5" ry="1.7" fill="#1a0800"/>
    <ellipse cx="89" cy="84" rx="2.5" ry="1.7" fill="#1a0800"/>
    <!-- 眉（細い） -->
    <path d="M76,80 Q79,78 82,80" stroke="#1a0800" stroke-width="1" fill="none"/>
    <path d="M86,80 Q89,78 92,80" stroke="#1a0800" stroke-width="1" fill="none"/>
    <!-- 口（小さく） -->
    <path d="M82,89 Q84,92 86,89" stroke="#8B3A2A" stroke-width="1" fill="none"/>
    <!-- 扇 -->
    <path d="M106,112 L124,90" stroke="#B8860B" stroke-width="2" stroke-linecap="round"/>
    <path d="M106,112 Q122,88 136,96" stroke="#B8860B" stroke-width="1" fill="none" opacity="0.5"/>`;
}

// ── 縦書きテキスト生成 ────────────────────────────────────────────
function vertText(text, x, y0, size, fill, fam, dy=size+3) {
  return text.split('').map((c, i) =>
    `<text x="${x}" y="${y0 + i*dy}" font-family="${fam}" font-size="${size}" fill="${fill}" text-anchor="middle">${c}</text>`
  ).join('');
}

const FF = `'Hiragino Mincho ProN','Yu Mincho','MS Mincho',serif`;

// ── 上の句テキスト分配（3列） ──────────────────────────────────────
function kamiText(kami) {
  const chars = kami.replace(/[　 ]/g, '').split('');
  const n = chars.length;
  // 3列に分配（右列から）
  const col1end = Math.ceil(n / 3);
  const col2end = Math.ceil(n * 2 / 3);
  const c1 = chars.slice(0, col1end);
  const c2 = chars.slice(col1end, col2end);
  const c3 = chars.slice(col2end);
  let out = '';
  c1.forEach((c, i) => { out += `<text x="214" y="${100 + i*17}" font-family="${FF}" font-size="14" fill="#1a0a00" text-anchor="middle">${c}</text>`; });
  c2.forEach((c, i) => { out += `<text x="196" y="${100 + i*17}" font-family="${FF}" font-size="14" fill="#1a0a00" text-anchor="middle">${c}</text>`; });
  c3.forEach((c, i) => { out += `<text x="178" y="${100 + i*17}" font-family="${FF}" font-size="14" fill="#1a0a00" text-anchor="middle">${c}</text>`; });
  return out;
}

// ── SVG 全体生成 ──────────────────────────────────────────────────
function generateCard({ id, poet, kami, shimo }) {
  const n   = id;
  const typ = typeOf(id);

  // 人物SVG選択
  const fig = typ === 'emperor' ? svgEmperor(id)
            : typ === 'empress' ? svgEmpress(id)
            : typ === 'monk'    ? svgMonk(id)
            : typ === 'female'  ? svgFemale(id)
            :                     svgNoble(id);

  // 下の句マスク用 shimo テキスト（マスクなので表示しないが位置キープ）
  const authorChars = vertText(poet, 20, 100, 11, '#3a1a00', FF, 14);
  const kamiChars   = kamiText(kami);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248 380" width="248" height="380">
  <defs>
    <linearGradient id="paper${n}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fdf6e3"/>
      <stop offset="50%" style="stop-color:#f9eed0"/>
      <stop offset="100%" style="stop-color:#f0e0b8"/>
    </linearGradient>
    <linearGradient id="hdr${n}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#8b0000"/>
      <stop offset="100%" style="stop-color:#600000"/>
    </linearGradient>
    <linearGradient id="mask${n}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#5a2d0c;stop-opacity:0.92"/>
      <stop offset="100%" style="stop-color:#3a1a06;stop-opacity:0.96"/>
    </linearGradient>
    <clipPath id="cc${n}">
      <rect x="0" y="0" width="248" height="380" rx="6"/>
    </clipPath>
  </defs>

  <g clip-path="url(#cc${n})">
    <!-- 和紙背景 -->
    <rect width="248" height="380" fill="url(#paper${n})"/>
    <rect width="248" height="380" fill="#c8a870" opacity="0.04"/>

    <!-- 外枠 -->
    <rect x="4" y="4" width="240" height="372" rx="4" fill="none" stroke="#8b3a1a" stroke-width="2"/>
    <rect x="8" y="8" width="232" height="364" rx="3" fill="none" stroke="#8b3a1a" stroke-width="0.8"/>

    <!-- ヘッダー -->
    <rect x="4" y="4" width="240" height="50" rx="4" fill="url(#hdr${n})"/>
    <rect x="4" y="42" width="240" height="12" fill="url(#hdr${n})"/>
    <text x="124" y="36" text-anchor="middle"
      font-family="${FF}"
      font-size="20" fill="#f8d36f" font-weight="bold" letter-spacing="2">第${n}首</text>

    <!-- 金線 ヘッダー下 -->
    <line x1="20" y1="54" x2="228" y2="54" stroke="#b8860b" stroke-width="1.2" opacity="0.7"/>
    <line x1="20" y1="56" x2="228" y2="56" stroke="#b8860b" stroke-width="0.5" opacity="0.5"/>

    <!-- ── 人物イラスト ── -->
    <g transform="translate(0,0)">
${fig}
    </g>

    <!-- イラスト区切り線 -->
    <line x1="20" y1="162" x2="228" y2="162" stroke="#8b3a1a" stroke-width="0.8" opacity="0.5"/>

    <!-- 上の句 ラベル -->
    <text x="124" y="178" text-anchor="middle"
      font-family="${FF}"
      font-size="9" fill="#8b3a1a" opacity="0.7" letter-spacing="3">上 の 句</text>

    <!-- 上の句（縦書き） -->
${kamiChars}

    <!-- 作者名（縦書き） -->
${authorChars}

    <!-- 金線区切り -->
    <line x1="20" y1="295" x2="228" y2="295" stroke="#b8860b" stroke-width="1" opacity="0.6"/>
    <line x1="20" y1="297" x2="228" y2="297" stroke="#b8860b" stroke-width="0.4" opacity="0.4"/>

    <!-- 下の句マスクエリア -->
    <rect x="8" y="299" width="232" height="73" rx="2" fill="url(#mask${n})"/>

    <!-- マスク斜め格子 -->
    <g opacity="0.15">
      <line x1="8" y1="299" x2="240" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="8" y1="315" x2="240" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="8" y1="331" x2="240" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="8" y1="347" x2="240" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="30" y1="299" x2="8" y2="320" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="60" y1="299" x2="8" y2="352" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="90" y1="299" x2="8" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="120" y1="299" x2="45" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="150" y1="299" x2="76" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="180" y1="299" x2="106" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="210" y1="299" x2="136" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="240" y1="299" x2="166" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
      <line x1="240" y1="323" x2="226" y2="372" stroke="#f8d36f" stroke-width="0.8"/>
    </g>

    <!-- 下の句マスクラベル -->
    <text x="124" y="332" text-anchor="middle"
      font-family="${FF}"
      font-size="11" fill="#f8d36f" opacity="0.85" letter-spacing="2">下の句は取り札で</text>
    <text x="124" y="350" text-anchor="middle"
      font-family="${FF}"
      font-size="9" fill="#d4b870" opacity="0.7">— find the matching card —</text>

    <!-- 下部金線 -->
    <line x1="20" y1="369" x2="228" y2="369" stroke="#b8860b" stroke-width="0.8" opacity="0.5"/>
  </g>
</svg>`;
}

// ── 全首データ ────────────────────────────────────────────────────
const POEMS = [
  {id:1,  poet:"天智天皇",       kami:"秋の田の かりほの庵の 苫をあらみ",       shimo:"わが衣手は 露にぬれつつ"},
  {id:2,  poet:"持統天皇",       kami:"春過ぎて 夏来にけらし 白妙の",           shimo:"衣ほすてふ 天の香具山"},
  {id:3,  poet:"柿本人麻呂",     kami:"あしびきの 山鳥の尾の しだり尾の",       shimo:"ながながし夜を ひとりかも寝む"},
  {id:4,  poet:"山部赤人",       kami:"田子の浦に うち出でてみれば 白妙の",     shimo:"富士の高嶺に 雪は降りつつ"},
  {id:5,  poet:"猿丸大夫",       kami:"奥山に もみぢ踏み分け 鳴く鹿の",         shimo:"声聞くときぞ 秋は悲しき"},
  {id:6,  poet:"中納言家持",     kami:"かささぎの 渡せる橋に おく霜の",          shimo:"白きを見れば 夜ぞ更けにける"},
  {id:7,  poet:"安倍仲麻呂",     kami:"天の原 ふりさけ見れば 春日なる",          shimo:"三笠の山に 出でし月かも"},
  {id:8,  poet:"喜撰法師",       kami:"わが庵は 都のたつみ しかぞすむ",           shimo:"世をうぢ山と 人はいふなり"},
  {id:9,  poet:"小野小町",       kami:"花の色は 移りにけりな いたづらに",        shimo:"わが身世にふる ながめせしまに"},
  {id:10, poet:"蝉丸",           kami:"これやこの 行くも帰るも 別れては",        shimo:"知るも知らぬも 逢坂の関"},
  {id:11, poet:"参議篁",         kami:"わたの原 八十島かけて 漕ぎ出でぬと",     shimo:"人には告げよ 海人の釣舟"},
  {id:12, poet:"僧正遍昭",       kami:"天つ風 雲の通ひ路 吹き閉ぢよ",          shimo:"乙女の姿 しばしとどめむ"},
  {id:13, poet:"陽成院",         kami:"筑波嶺の 峰より落つる みなの川",          shimo:"恋ぞ積もりて 淵となりぬる"},
  {id:14, poet:"河原左大臣",     kami:"陸奥の しのぶもぢずり 誰ゆゑに",         shimo:"乱れそめにし われならなくに"},
  {id:15, poet:"光孝天皇",       kami:"君がため 春の野に出でて 若菜つむ",       shimo:"わが衣手に 雪は降りつつ"},
  {id:16, poet:"中納言行平",     kami:"立ち別れ いなばの山の 峰に生ふる",       shimo:"まつとし聞かば 今帰り来む"},
  {id:17, poet:"在原業平朝臣",   kami:"ちはやふる 神代も聞かず 竜田川",        shimo:"からくれなゐに 水くくるとは"},
  {id:18, poet:"藤原敏行朝臣",   kami:"住の江の 岸による波 よるさへや",        shimo:"夢の通ひ路 人目よくらむ"},
  {id:19, poet:"伊勢",           kami:"難波潟 みじかき芦の ふしの間も",          shimo:"逢はでこの世を 過ぐしてよとや"},
  {id:20, poet:"元良親王",       kami:"わびぬれば 今はた同じ 難波なる",          shimo:"みをつくしても 逢はむとぞ思ふ"},
  {id:21, poet:"素性法師",       kami:"今来むと いひしばかりに 長月の",          shimo:"有明の月を 待ち出でつるかな"},
  {id:22, poet:"文屋康秀",       kami:"吹くからに 秋の草木の しをるれば",        shimo:"むべ山風を 嵐といふらむ"},
  {id:23, poet:"大江千里",       kami:"月見れば ちぢに物こそ 悲しけれ",         shimo:"わが身一つの 秋にはあらねど"},
  {id:24, poet:"菅家",           kami:"このたびは ぬさもとりあへず 手向山",      shimo:"紅葉の錦 神のまにまに"},
  {id:25, poet:"三条右大臣",     kami:"名にし負はば 逢坂山の さねかづら",       shimo:"人に知られで くるよしもがな"},
  {id:26, poet:"貞信公",         kami:"小倉山 峰のもみぢ葉 心あらば",            shimo:"今ひとたびの みゆき待たなむ"},
  {id:27, poet:"中納言兼輔",     kami:"みかの原 わきて流るる 泉川",              shimo:"いつ見きとてか 恋しかるらむ"},
  {id:28, poet:"源宗于朝臣",     kami:"山里は 冬ぞさびしさ まさりける",          shimo:"人目も草も かれぬと思へば"},
  {id:29, poet:"凡河内躬恒",     kami:"心あてに 折らばや折らむ 初霜の",         shimo:"置きまどはせる 白菊の花"},
  {id:30, poet:"壬生忠岑",       kami:"有明の つれなく見えし 別れより",          shimo:"暁ばかり 憂きものはなし"},
  {id:31, poet:"坂上是則",       kami:"朝ぼらけ 有明の月と みるまでに",          shimo:"よしのの里に 降れる白雪"},
  {id:32, poet:"春道列樹",       kami:"山川に 風のかけたる しがらみは",          shimo:"流れもあへぬ 紅葉なりけり"},
  {id:33, poet:"紀友則",         kami:"久方の 光のどけき 春の日に",              shimo:"しづ心なく 花の散るらむ"},
  {id:34, poet:"藤原興風",       kami:"誰をかも 知る人にせむ 高砂の",            shimo:"松も昔の 友ならなくに"},
  {id:35, poet:"紀貫之",         kami:"人はいさ 心も知らず ふるさとは",          shimo:"花ぞ昔の 香ににほひける"},
  {id:36, poet:"清原深養父",     kami:"夏の夜は まだ宵ながら 明けぬるを",       shimo:"雲のいづこに 月宿るらむ"},
  {id:37, poet:"文屋朝康",       kami:"白露に 風の吹きしく 秋の野は",            shimo:"つらぬきとめぬ 玉ぞ散りける"},
  {id:38, poet:"右近",           kami:"忘らるる 身をば思はず 誓ひてし",          shimo:"人の命の 惜しくもあるかな"},
  {id:39, poet:"参議等",         kami:"浅茅生の 小野の篠原 しのぶれど",          shimo:"あまりてなどか 人の恋しき"},
  {id:40, poet:"平兼盛",         kami:"忍ぶれど 色に出でにけり わが恋は",       shimo:"物や思ふと 人の問ふまで"},
  {id:41, poet:"壬生忠見",       kami:"恋すてふ わが名はまだき 立ちにけり",     shimo:"人知れずこそ 思ひそめしか"},
  {id:42, poet:"清原元輔",       kami:"契りきな かたみに袖を しぼりつつ",       shimo:"末の松山 波越さじとは"},
  {id:43, poet:"権中納言敦忠",   kami:"逢ひ見ての のちの心に くらぶれば",      shimo:"昔はものを 思はざりけり"},
  {id:44, poet:"中納言朝忠",     kami:"逢ふことの 絶えてしなくは なかなかに",   shimo:"人をも身をも 恨みざらまし"},
  {id:45, poet:"謙徳公",         kami:"あはれとも いふべき人は 思ほえで",       shimo:"身のいたづらに なりぬべきかな"},
  {id:46, poet:"曾禰好忠",       kami:"由良の門を 渡る舟人 かぢを絶え",         shimo:"ゆくへも知らぬ 恋の道かな"},
  {id:47, poet:"恵慶法師",       kami:"八重葎 しげれる宿の さびしきに",          shimo:"人こそ見えね 秋は来にけり"},
  {id:48, poet:"源重之",         kami:"風をいたみ 岩打つ波の おのれのみ",       shimo:"くだけて物を 思ふころかな"},
  {id:49, poet:"大中臣能宣朝臣", kami:"みかきもり 衛士のたく火の 夜は燃え",   shimo:"昼は消えつつ 物をこそ思へ"},
  {id:50, poet:"藤原義孝",       kami:"君がため 惜しからざりし 命さへ",          shimo:"長くもがなと 思ひけるかな"},
  {id:51, poet:"藤原実方朝臣",   kami:"かくとだに えやはいぶきの さしも草",    shimo:"さしも知らじな 燃ゆる思ひを"},
  {id:52, poet:"藤原道信朝臣",   kami:"明けぬれば 暮るるものとは 知りながら",  shimo:"なほ恨めしき 朝ぼらけかな"},
  {id:53, poet:"右大将道綱母",   kami:"なげきつつ ひとりぬる夜の 明くる間は",  shimo:"いかに久しき ものとかは知る"},
  {id:54, poet:"儀同三司母",     kami:"忘れじの ゆく末までは かたければ",        shimo:"今日を限りの 命ともがな"},
  {id:55, poet:"大納言公任",     kami:"滝の音は 絶えて久しく なりぬれど",       shimo:"名こそ流れて なほ聞こえけれ"},
  {id:56, poet:"和泉式部",       kami:"あらざらむ この世のほかの 思ひ出に",     shimo:"今ひとたびの 逢ふこともがな"},
  {id:57, poet:"紫式部",         kami:"めぐり逢ひて 見しやそれとも わかぬ間に", shimo:"雲がくれにし 夜半の月かな"},
  {id:58, poet:"大弐三位",       kami:"有馬山 猪名の笹原 風吹けば",              shimo:"いでそよ人を 忘れやはする"},
  {id:59, poet:"赤染衛門",       kami:"やすらはで 寝なましものを 小夜更けて",   shimo:"傾くまでの 月を見しかな"},
  {id:60, poet:"小式部内侍",     kami:"大江山 いく野の道の 遠ければ",            shimo:"まだふみもみず 天の橋立"},
  {id:61, poet:"伊勢大輔",       kami:"いにしへの 奈良の都の 八重桜",             shimo:"けふ九重に にほひぬるかな"},
  {id:62, poet:"清少納言",       kami:"夜をこめて 鳥の空音は はかるとも",        shimo:"よに逢坂の 関はゆるさじ"},
  {id:63, poet:"左京大夫道雅",   kami:"今はただ 思ひ絶えなむ とばかりを",      shimo:"人づてならで 言ふよしもがな"},
  {id:64, poet:"権中納言定頼",   kami:"朝ぼらけ 宇治の川霧 たえたえに",        shimo:"あらはれわたる 瀬々の網代木"},
  {id:65, poet:"相模",           kami:"恨みわび ほさぬ袖だに あるものを",        shimo:"恋に朽ちなむ 名こそ惜しけれ"},
  {id:66, poet:"前大僧正行尊",   kami:"もろともに あはれと思へ 山桜",            shimo:"花よりほかに 知る人もなし"},
  {id:67, poet:"周防内侍",       kami:"春の夜の 夢ばかりなる 手枕に",            shimo:"かひなく立たむ 名こそ惜しけれ"},
  {id:68, poet:"三条院",         kami:"心にも あらでうき世に ながらへば",        shimo:"恋しかるべき 夜半の月かな"},
  {id:69, poet:"能因法師",       kami:"嵐吹く 三室の山の もみぢ葉は",            shimo:"龍田の川の 錦なりけり"},
  {id:70, poet:"良暹法師",       kami:"寂しさに 宿を立ち出でて ながむれば",     shimo:"いづくも同じ 秋の夕暮れ"},
  {id:71, poet:"大納言経信",     kami:"夕されば 門田の稲葉 おとづれて",          shimo:"芦のまろ屋に 秋風ぞ吹く"},
  {id:72, poet:"祐子内親王家紀伊", kami:"音に聞く 高師の浜の あだ波は",         shimo:"かけじや袖の ぬれもこそすれ"},
  {id:73, poet:"権中納言匡房",   kami:"高砂の 尾の上の桜 咲きにけり",           shimo:"外山の霞 立たずもあらなむ"},
  {id:74, poet:"源俊頼朝臣",     kami:"うかりける 人を初瀬の 山おろしよ",       shimo:"はげしかれとは 祈らぬものを"},
  {id:75, poet:"藤原基俊",       kami:"契りおきし させもが露を 命にて",          shimo:"あはれ今年の 秋もいぬめり"},
  {id:76, poet:"法性寺入道前関白太政大臣", kami:"わたの原 漕ぎ出でて見れば ひさかたの", shimo:"雲居にまがふ 沖つ白波"},
  {id:77, poet:"崇徳院",         kami:"瀬を早み 岩にせかるる 滝川の",            shimo:"われても末に 逢はむとぞ思ふ"},
  {id:78, poet:"源兼昌",         kami:"淡路島 かよふ千鳥の 鳴く声に",            shimo:"いく夜寝覚めぬ 須磨の関守"},
  {id:79, poet:"左京大夫顕輔",   kami:"秋風に たなびく雲の 絶え間より",        shimo:"もれ出づる月の 影のさやけさ"},
  {id:80, poet:"待賢門院堀河",   kami:"長からむ 心も知らず 黒髪の",              shimo:"乱れてけさは 物をこそ思へ"},
  {id:81, poet:"後徳大寺左大臣", kami:"ほととぎす 鳴きつる方を ながむれば",     shimo:"ただ有明の 月ぞ残れる"},
  {id:82, poet:"道因法師",       kami:"思ひわび さても命は あるものを",           shimo:"憂きにたへぬは 涙なりけり"},
  {id:83, poet:"皇太后宮大夫俊成", kami:"世の中よ 道こそなけれ 思ひ入る",      shimo:"山の奥にも 鹿ぞ鳴くなる"},
  {id:84, poet:"藤原清輔朝臣",   kami:"ながらへば またこのごろや しのばれむ",   shimo:"うしと見し世ぞ 今は恋しき"},
  {id:85, poet:"俊恵法師",       kami:"夜もすがら 物思ふころは 明けやらで",     shimo:"ねやのひまさへ つれなかりけり"},
  {id:86, poet:"西行法師",       kami:"なげけとて 月やは物を 思はする",          shimo:"かこち顔なる わが涙かな"},
  {id:87, poet:"寂蓮法師",       kami:"村雨の 露もまだ干ぬ まきの葉に",         shimo:"霧立ちのぼる 秋の夕暮れ"},
  {id:88, poet:"皇嘉門院別当",   kami:"難波江の 芦のかりねの ひとよゆゑ",       shimo:"みをつくしてや 恋ひわたるべき"},
  {id:89, poet:"式子内親王",     kami:"玉の緒よ 絶えなば絶えね ながらへば",     shimo:"忍ぶることの よわりもぞする"},
  {id:90, poet:"殷富門院大輔",   kami:"見せばやな 雄島の蜑の 袖だにも",        shimo:"濡れにぞ濡れし 色はかはらず"},
  {id:91, poet:"後京極摂政前太政大臣", kami:"きりぎりす 鳴くや霜夜の さむしろに", shimo:"衣片敷き ひとりかも寝む"},
  {id:92, poet:"二条院讃岐",     kami:"わが袖は 潮干に見えぬ 沖の石の",         shimo:"人こそ知らね 乾く間もなし"},
  {id:93, poet:"鎌倉右大臣",     kami:"世の中は 常にもがもな 渚漕ぐ",           shimo:"海人の小舟の 綱手かなしも"},
  {id:94, poet:"参議雅経",       kami:"み吉野の 山の秋風 小夜更けて",            shimo:"ふるさと寒く 衣打つなり"},
  {id:95, poet:"前大僧正慈円",   kami:"おほけなく うき世の民に おほふかな",     shimo:"わが立つ杣に 墨染の袖"},
  {id:96, poet:"入道前太政大臣", kami:"花さそふ 嵐の庭の 雪ならで",              shimo:"ふりゆくものは わが身なりけり"},
  {id:97, poet:"権中納言定家",   kami:"来ぬ人を まつほの浦の 夕なぎに",        shimo:"焼くや藻塩の 身もこがれつつ"},
  {id:98, poet:"従二位家隆",     kami:"風そよぐ ならの小川の 夕暮れは",          shimo:"みそぎぞ夏の しるしなりける"},
  {id:99, poet:"後鳥羽院",       kami:"人も惜し 人も恨めし あぢきなく",          shimo:"世を思ふゆゑに 物思ふ身は"},
  {id:100,poet:"順徳院",         kami:"ももしきや 古き軒端の しのぶにも",        shimo:"なほ余りある 昔なりけり"},
];

// ── ファイル生成 ──────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'assets', 'karuta');
let count = 0;
for (const p of POEMS) {
  const file = path.join(outDir, `card_${String(p.id).padStart(3,'0')}.svg`);
  fs.writeFileSync(file, generateCard(p), 'utf8');
  count++;
  if (count % 10 === 0) process.stdout.write(`  ${count}/100 生成済み\n`);
}
console.log(`\n✅ ${count}枚の絵札を生成しました → ${outDir}`);
