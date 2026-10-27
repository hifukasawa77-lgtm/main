// ステージデータ。形式（訓練場・全13面・結界門の部屋で共通）:
//   width / pits[[x1,x2]] / platforms[{x,y,w}] / enemies[{type,x,y?}] / pickups[{cat,id,x,y?}] / theme{sky,far,ground}
//   boss: ボスID（あれば最後にボス部屋）/ gate: {x,used} 結界門 / doors: 部屋の出入口 / dark: 暗闇 / respawn: 敵の再出現（訓練場）
(function (K) {
  // 決定的な乱数（同じステージは毎回同じ配置。検査も再現できる）
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- 訓練場: 属性相性・アイテム・弾消し・穴落ちを一通り試せる ----
  const training = {
    id: 'training', name: '訓練場', bg: 'training', respawn: true, width: 1280, pits: [[900, 940]],
    platforms: [{ x: 600, y: 160, w: 64 }, { x: 700, y: 128, w: 64 }],
    enemies: [
      { type: 'plain', x: 220 }, { type: 'ember', x: 320 }, { type: 'frost', x: 420 }, { type: 'knight', x: 520 },
      { type: 'ghoul', x: 640 }, { type: 'naga', x: 760 }, { type: 'bat', x: 820, y: 190 }, { type: 'gunner', x: 1060 },
    ],
    pickups: [
      { cat: 'auto', id: 'decoy', x: 90 }, { cat: 'auto', id: 'peacock', x: 110 }, { cat: 'auto', id: 'key', x: 130 }, { cat: 'auto', id: 'charm', x: 150 },
      { cat: 'instant', id: 'speed', x: 170 }, { cat: 'instant', id: 'spin', x: 190 }, { cat: 'instant', id: 'eight', x: 210 },
      { cat: 'instant', id: 'mini', x: 250 }, { cat: 'instant', id: 'dragon', x: 280 }, { cat: 'instant', id: 'twin', x: 310 }, { cat: 'instant', id: 'falcon', x: 340 },
      { cat: 'instant', id: 'after', x: 370 }, { cat: 'instant', id: 'gold', x: 400 }, { cat: 'instant', id: 'float', x: 430 },
      { cat: 'single', id: 'wind', x: 460 }, { cat: 'single', id: 'thunder', x: 480 }, { cat: 'single', id: 'bind', x: 500 }, { cat: 'single', id: 'fire', x: 540 },
      { cat: 'single', id: 'aurora', x: 560 }, { cat: 'single', id: 'fly', x: 580 }, { cat: 'auto', id: 'torch', x: 600, y: 160 },
    ],
    gate: { x: 1180, used: false },
  };

  // ---- 全13面。名称・ボスはオリジナル。構成（4ラウンド・全13・各面ボス）は仕様どおり ----
  const SPEC = [
    { id: 'r1s1', label: 'ROUND 1-1', name: '竹林', sky: ['#0b1d12', '#1d3d2a'], far: '#12301f', ground: '#3b4a1c', mix: ['plain', 'plain', 'hopper', 'gunner'], n: 14, pits: 2, plats: 2 },
    { id: 'r1s2', label: 'ROUND 1-2', name: '杉の山道', sky: ['#0a1620', '#20384a'], far: '#102a28', ground: '#3a3a28', mix: ['plain', 'hopper', 'knight', 'bat'], n: 15, pits: 2, plats: 3 },
    { id: 'r1s3', label: 'ROUND 1-3', name: '墓地', sky: ['#14101e', '#2e2040'], far: '#201830', ground: '#40344a', mix: ['ghoul', 'skeleton', 'bat', 'gunner'], n: 16, pits: 2, plats: 3 },
    { id: 'r1s4', label: 'ROUND 1-4', name: '魔寺', sky: ['#1a0a0a', '#3a1818'], far: '#2a1010', ground: '#4a2a1a', mix: ['ghoul', 'knight', 'gunner', 'skeleton'], n: 17, pits: 3, plats: 3 },
    { id: 'r2s1', label: 'ROUND 2-1', name: '火炎山', sky: ['#2a0a00', '#6a2000'], far: '#3a1000', ground: '#5a2a10', mix: ['ember', 'emberhop', 'ghostfire', 'ember'], n: 18, pits: 3, plats: 3 },
    { id: 'r2s2', label: 'ROUND 2-2', name: '鍾乳洞', sky: ['#06101a', '#102a3a'], far: '#0a1a28', ground: '#2a3a4a', mix: ['naga', 'bat', 'naga', 'hopper'], n: 18, pits: 3, plats: 4 },
    { id: 'r2s3', label: 'ROUND 2-3', name: '氷結山', sky: ['#0a1830', '#2a4a6a'], far: '#1a3050', ground: '#5a7a9a', mix: ['frost', 'frosthop', 'icicle', 'icicle'], n: 18, pits: 3, plats: 3 },
    { id: 'r2s4', label: 'ROUND 2-4', name: '飛天の塔', sky: ['#101028', '#28285a'], far: '#181838', ground: '#3a3a5a', mix: ['plain', 'knight', 'bat', 'gunner'], n: 18, pits: 4, plats: 7, width: 2200 },
    { id: 'r3s1', label: 'ROUND 3-1', name: '底なし沼', sky: ['#10200a', '#2a3a18'], far: '#182a10', ground: '#3a4020', mix: ['naga', 'hopper', 'ghoul'], n: 16, pits: 5, plats: 4 },
    { id: 'r3s2', label: 'ROUND 3-2', name: '城壁', sky: ['#18101a', '#3a2a3a'], far: '#241a28', ground: '#4a4050', mix: ['skeleton', 'skeleton', 'gunner', 'knight'], n: 20, pits: 3, plats: 4 },
    { id: 'r3s3', label: 'ROUND 3-3', name: '石垣', sky: ['#141414', '#34343a'], far: '#202024', ground: '#505058', mix: ['knight', 'turret', 'turret', 'hopper'], n: 18, pits: 4, plats: 5 },
    { id: 'r3s4', label: 'ROUND 3-4', name: '城内', sky: ['#1a0a18', '#402038'], far: '#2a1228', ground: '#503040', mix: ['knight', 'ember', 'ghoul', 'skeleton'], n: 20, pits: 3, plats: 4 },
    { id: 'r4s1', label: 'LAST ROUND', name: '冥府', sky: ['#050008', '#1a0030'], far: '#0c0018', ground: '#2a1a3a', mix: ['ghoul', 'skeleton', 'knight', 'ember', 'frost', 'naga', 'bat'], n: 24, pits: 3, plats: 4 },
  ];
  const INSTANTS = ['speed', 'spin', 'eight', 'mini', 'falcon', 'after', 'dragon', 'twin'];
  const SINGLES = ['wind', 'thunder', 'bind', 'fire', 'aurora', 'fly', 'halt', 'see', 'bomb'];

  function build(spec, idx) {
    const R = rng(idx * 977 + 13), W = spec.width || 2000, LOCK = W - 256;
    const pits = [], plats = [], enemies = [], pickups = [];
    const inPitZone = (x, m) => pits.some(p => x > p[0] - m && x < p[1] + m);
    // 穴: 手前から一定間隔で。ボス部屋・スタート地点には作らない
    for (let i = 0; i < spec.pits; i++) {
      const x = Math.floor(320 + (LOCK - 480) * (i + 0.5 + (R() - 0.5) * 0.4) / spec.pits), w = 28 + Math.floor(R() * 8);   // 28〜35px。ジャンプで進めるのは約47px（跳躍の滞空43フレーム×1.1px）なので、44pxの穴は縁の直前でないと越えられない
      pits.push([x, x + w]);
    }
    // 足場: 下段(168)と、その上の上段(136)。ジャンプの頂点(約50px)で届く高さ
    for (let i = 0; i < spec.plats; i++) {
      const x = Math.floor(240 + (LOCK - 400) * (i + 0.3 + R() * 0.4) / spec.plats), w = 48 + Math.floor(R() * 24);
      if (inPitZone(x, 30) || inPitZone(x + w, 30)) continue;
      plats.push({ x: x, y: 168, w: w });
      if (R() < 0.6) plats.push({ x: x + 8, y: 136, w: Math.max(32, w - 20) });
    }
    const gateX = Math.floor(W * 0.5 / 10) * 10 + (inPitZone(W * 0.5, 60) ? 90 : 0);
    // 敵
    for (let i = 0; i < spec.n; i++) {
      const type = spec.mix[Math.floor(R() * spec.mix.length)];
      let x = Math.floor(260 + R() * (LOCK - 400)), tries = 0;
      while ((inPitZone(x, 60) || Math.abs(x - gateX) < 40) && tries++ < 20) x = Math.floor(260 + R() * (LOCK - 400));
      const e = { type: type, x: x };
      if (type === 'bat' || type === 'ghostfire') e.y = 190;
      if (type === 'icicle') e.y = 60;
      enemies.push(e);
    }
    // アイテム: 鍵（結界門用）・松明・自動1・即効2・単発1・上段の上のごほうび
    pickups.push({ cat: 'auto', id: 'key', x: Math.floor(W * 0.3) });
    pickups.push({ cat: 'auto', id: 'torch', x: Math.floor(W * 0.18) });
    pickups.push({ cat: 'auto', id: ['decoy', 'peacock', 'charm'][Math.floor(R() * 3)], x: Math.floor(W * 0.38) });
    for (let i = 0; i < 2; i++) pickups.push({ cat: 'instant', id: INSTANTS[Math.floor(R() * INSTANTS.length)], x: Math.floor(W * (0.6 + i * 0.12)) });
    pickups.push({ cat: 'single', id: SINGLES[Math.floor(R() * SINGLES.length)], x: Math.floor(W * 0.45) });
    const top = plats.filter(p => p.y === 136)[0] || plats[0];
    if (top) pickups.push({ cat: 'instant', id: R() < 0.5 ? 'float' : 'gold', x: top.x + 14, y: top.y });
    pickups.forEach(p => { if (p.y == null) { let tries = 0; while (inPitZone(p.x, 12) && tries++ < 20) p.x += 20; } });
    return {
      id: spec.id, label: spec.label, name: spec.name, bg: 'stage_' + spec.id, width: W, lockX: LOCK, boss: spec.id,
      pits: pits, platforms: plats, enemies: enemies, pickups: pickups, gate: { x: gateX, used: false },
      theme: { sky: spec.sky, far: spec.far, ground: spec.ground },
    };
  }

  K.STAGE_LIST = SPEC.map(function (s, i) { return { id: s.id, label: s.label, name: s.name, boss: K.BOSS_DEFS ? K.BOSS_DEFS[s.id].name : '', next: i + 1 < SPEC.length ? SPEC[i + 1].id : null, implemented: true }; });
  K.STAGES = { training: training };
  SPEC.forEach(function (s, i) { K.STAGES[s.id] = build(s, i); });

  // ---- 結界門の部屋（入るたびに作る）。hub: 天界/冥界の分かれ道 / heaven: 回復と単発アイテム / hell: 暗闇・敵・隠し報酬 ----
  K.makeRoom = function (kind, seed) {
    const R = rng((seed || 1) * 31 + 7), sky = ['#0a0a18', '#1a1a30'];
    const base = { width: 256, lockX: 0, pits: [], platforms: [], enemies: [], pickups: [], theme: { sky: sky, far: '#101020', ground: '#30283a' }, isRoom: kind };
    if (kind === 'hub') {
      return Object.assign(base, { id: 'gate_hub', name: '結界門', bg: 'gate_hub', doors: [{ x: 24, to: 'outside', label: '出口' }, { x: 100, to: 'heaven', label: '天界' }, { x: 196, to: 'hell', label: '冥界' }] });
    }
    if (kind === 'heaven') {
      return Object.assign(base, {
        id: 'gate_heaven', name: '天界', bg: 'gate_heaven', theme: { sky: ['#20203a', '#5a5a8a'], far: '#3a3a6a', ground: '#8a8aaa' },
        doors: [{ x: 24, to: 'outside', label: '出口' }],
        pickups: [{ cat: 'heal', id: 'heal', x: 90 }, { cat: 'single', id: SINGLES[Math.floor(R() * SINGLES.length)], x: 140 }, { cat: 'single', id: SINGLES[Math.floor(R() * SINGLES.length)], x: 180 }, { cat: 'auto', id: 'decoy', x: 220 }],
      });
    }
    return Object.assign(base, {                      // hell
      id: 'gate_hell', name: '冥界', bg: 'gate_hell', width: 512, dark: true, theme: { sky: ['#1a0000', '#400808'], far: '#2a0808', ground: '#3a1010' },
      doors: [{ x: 24, to: 'outside', label: '出口' }],
      enemies: [{ type: 'skeleton', x: 150 }, { type: 'ghoul', x: 240 }, { type: 'emberhop', x: 330 }, { type: 'knight', x: 420 }],
      pickups: [{ cat: 'instant', id: R() < 0.5 ? 'float' : 'gold', x: 480 }, { cat: 'single', id: SINGLES[Math.floor(R() * SINGLES.length)], x: 470 }],
    });
  };
})(window.KOMA);
