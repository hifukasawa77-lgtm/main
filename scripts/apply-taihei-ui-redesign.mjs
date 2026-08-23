import fs from 'node:fs';

const path = 'taihei.html';
let src = fs.readFileSync(path, 'utf8');

function replaceBetween(startMarker, endMarker, replacement) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) throw new Error(`marker not found: ${startMarker} -> ${endMarker}`);
  src = src.slice(0, a) + replacement.trimEnd() + '\n' + src.slice(b);
}

replaceBetween('function button(ctx, b, hover) {', 'function hit(b, p) {', String.raw`
function button(ctx, b, hover) {
  const active = !!b.active;
  frame(ctx, b.x, b.y, b.w, b.h, {
    fill: b.disabled ? 'rgba(255,255,255,0.025)' : active ? 'rgba(116,58,30,0.72)' : hover ? 'rgba(112,73,38,0.58)' : 'rgba(55,39,25,0.76)',
    stroke: b.disabled ? 'rgba(255,255,255,0.08)' : active ? 'rgba(190,139,70,0.95)' : hover ? 'rgba(181,132,68,0.82)' : 'rgba(120,88,53,0.68)',
    radius: b.radius != null ? b.radius : 3,
  });
  if (!b.disabled && (hover || active)) {
    ctx.fillStyle = active ? '#9f2f24' : '#b38a45';
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 3);
  }
  const cx = b.x + b.w / 2;
  txt(ctx, b.jp, cx, b.y + (b.en ? b.h / 2 - 15 : b.h / 2 - 7), {
    font: b.font || '600 15px "Hiragino Mincho ProN", "Yu Mincho", serif',
    color: b.disabled ? '#746957' : '#ead9b5', align: 'center',
  });
  if (b.en) txt(ctx, b.en, cx, b.y + b.h / 2 + 6, { font: '10px sans-serif', color: '#9d896b', align: 'center' });
}
`);

replaceBetween('  _drawTopBar(ctx) {', '  _drawMap(ctx, g) {', String.raw`
  _drawTopBar(ctx) {
    const state = this.state, camp = state.camps[this.player];
    const own = Object.values(state.provinces).filter((p) => p.owner === this.player);
    const army = own.reduce((n, p) => n + (p.garrison || 0), 0);
    const myGens = Object.values(state.generals).filter((g) => g.camp === this.player && !g.dead);
    const loyalty = myGens.length ? Math.round(myGens.reduce((n, g) => n + (g.loyalty || 0), 0) / myGens.length) : 0;
    const myCourt = campCourtOf(state, this.player);
    const courtRel = myCourt ? Math.round(Rule.courtRelValue(state, this.player, myCourt)) : 0;
    const pending = myGens.filter((g) => (g.pendingContribution || 0) > 0).length;

    frame(ctx, ML.top.x, ML.top.y, ML.top.w, ML.top.h, { fill: 'rgba(39,28,19,0.96)', stroke: 'rgba(179,138,69,0.82)', radius: 2 });
    ctx.fillStyle = '#b38a45'; ctx.fillRect(ML.top.x, ML.top.y + ML.top.h - 2, ML.top.w, 2);
    drawKamon(ctx, this.player, ML.top.x + 25, ML.top.y + ML.top.h / 2, 15);
    txt(ctx, '太平風雲記', ML.top.x + 50, ML.top.y + 7, { font: '600 17px "Hiragino Mincho ProN", serif', color: '#f0e2bf' });
    txt(ctx, `${state.year}年 ${state.month || 1}月　${camp.jp}`, ML.top.x + 50, ML.top.y + 29, { font: '11px "Hiragino Mincho ProN", serif', color: '#bca984' });

    const stats = [
      ['金', Math.round(camp.gold), '貫'], ['兵', army, '人'], ['威信', camp.prestige, '/100'],
      ['朝廷', courtRel, '/100'], ['忠義', loyalty, '/100'], ['恩賞待ち', pending, '件'],
    ];
    const sx = ML.top.x + 330, sw = (ML.top.w - 344) / stats.length;
    stats.forEach((s, i) => {
      const x = sx + i * sw;
      if (i) { ctx.strokeStyle = 'rgba(117,83,48,0.5)'; ctx.beginPath(); ctx.moveTo(x, ML.top.y + 7); ctx.lineTo(x, ML.top.y + ML.top.h - 7); ctx.stroke(); }
      txt(ctx, s[0], x + 10, ML.top.y + 7, { font: '10px sans-serif', color: '#a59070' });
      txt(ctx, String(s[1]), x + 10, ML.top.y + 23, { font: '600 15px "Hiragino Mincho ProN", serif', color: '#ead9b5' });
      txt(ctx, s[2], x + sw - 8, ML.top.y + 27, { font: '9px sans-serif', color: '#89775d', align: 'right' });
    });
  }
`);

replaceBetween('  _drawSide(ctx) {', '  _drawLog(ctx) {', String.raw`
  _drawSide(ctx) {
    frame(ctx, ML.side.x, ML.side.y, ML.side.w, ML.side.h, { fill: 'rgba(34,24,16,0.95)', stroke: 'rgba(126,91,54,0.72)', radius: 2 });
    let y = ML.side.y + 12;
    const x = ML.side.x + 13, w = ML.side.w - 26;
    const heading = (label) => {
      ctx.fillStyle = 'rgba(126,78,38,0.22)'; ctx.fillRect(x - 5, y - 4, w + 10, 24);
      ctx.fillStyle = '#9f2f24'; ctx.fillRect(x - 5, y - 4, 3, 24);
      txt(ctx, label, x + 5, y, { font: '600 13px "Hiragino Mincho ProN", serif', color: '#e9d9b2' }); y += 29;
    };

    heading('選択国 / Province');
    if (this.sel) {
      const prov = DATA.provById[this.sel], ps = this.state.provinces[this.sel];
      const ownerLabel = ps.owner ? campLabelOf(this.state, ps.owner) : { jp: '在地勢力', en: 'Independent' };
      txt(ctx, `${prov.jp}国`, x, y, { font: '600 22px "Hiragino Mincho ProN", serif', color: '#f0e2bf' });
      txt(ctx, ownerLabel.jp, x + w, y + 5, { font: '11px "Hiragino Mincho ProN", serif', color: ps.owner ? campColorOf(ps.owner) : '#9b8b72', align: 'right' }); y += 31;
      const cells = [['石高', prov.koku], ['兵', ps.garrison], ['地形', prov.terrain], ['施設', ps.facility ? FACILITIES[ps.facility].jp : 'なし']];
      cells.forEach((c, i) => {
        const cw = (w - 6) / 2, cx = x + (i % 2) * (cw + 6), cy = y + Math.floor(i / 2) * 39;
        frame(ctx, cx, cy, cw, 33, { fill: 'rgba(0,0,0,0.16)', stroke: 'rgba(111,78,47,0.48)', radius: 1 });
        txt(ctx, c[0], cx + 7, cy + 5, { font: '9px sans-serif', color: '#99856a' });
        txt(ctx, String(c[1]), cx + 7, cy + 17, { font: '600 12px "Hiragino Mincho ProN", serif', color: '#ddc9a4' });
      });
      y += 83;

      const gen = Object.values(this.state.generals).find((g) => !g.dead && g.province === this.sel && (!ps.owner || g.camp === ps.owner));
      if (gen) {
        heading('武将 / General');
        drawGeneralPortrait(ctx, gen, x, y, 50);
        txt(ctx, gen.jp, x + 62, y + 2, { font: '600 15px "Hiragino Mincho ProN", serif', color: '#ead9b5' });
        txt(ctx, `統 ${gen.stats.leadership || '-'}　武 ${gen.stats.martial || '-'}　政 ${gen.stats.politics || '-'}`, x + 62, y + 23, { font: '10px sans-serif', color: '#a89372' });
        const lw = Math.max(0, Math.min(1, (gen.loyalty || 0) / 100));
        frame(ctx, x + 62, y + 40, w - 62, 7, { fill: 'rgba(0,0,0,.28)', stroke: 'rgba(105,76,45,.5)', radius: 1 });
        ctx.fillStyle = lw < .4 ? '#9f2f24' : '#b38a45'; ctx.fillRect(x + 63, y + 41, (w - 64) * lw, 5);
        txt(ctx, `忠義 ${Math.round(gen.loyalty || 0)}`, x + w, y + 52, { font: '9px sans-serif', color: '#9e8a6b', align: 'right' });
        y += 72;
      }
    } else {
      txt(ctx, '地図上の国を選択してください', x, y, { font: '12px "Hiragino Mincho ProN", serif', color: '#9d8a6e' }); y += 32;
    }

    heading('朝廷・正統性 / Courts');
    for (const cid of ['hokucho', 'nancho']) {
      const court = this.state.courts[cid], leg = Math.round(Rule.effectiveLegitimacy(this.state, cid));
      const c = cid === 'hokucho' ? '#9b3b32' : '#365b73';
      txt(ctx, court.jp, x, y, { font: '600 12px "Hiragino Mincho ProN", serif', color: c });
      txt(ctx, String(leg), x + w, y, { font: '600 13px sans-serif', color: '#d8c5a1', align: 'right' }); y += 18;
      frame(ctx, x, y, w, 7, { fill: 'rgba(0,0,0,.28)', stroke: 'rgba(105,76,45,.45)', radius: 1 });
      ctx.fillStyle = c; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, leg / 100)), 5); y += 15;
    }
    const myCourt = campCourtOf(this.state, this.player);
    if (myCourt) {
      const rel = Math.round(Rule.courtRelValue(this.state, this.player, myCourt));
      txt(ctx, `朝廷関係　${rel} / 100`, x, y + 2, { font: '11px "Hiragino Mincho ProN", serif', color: '#bca77f' });
    }
  }
`);

replaceBetween('  _drawLog(ctx) {', '  _drawCommandBar(ctx, g) {', String.raw`
  _drawLog(ctx) {
    frame(ctx, ML.log.x, ML.log.y, ML.log.w, ML.log.h, { fill: 'rgba(31,22,15,0.92)', stroke: 'rgba(111,78,47,0.55)', radius: 2 });
    txt(ctx, '年代記 / Chronicle', ML.log.x + 12, ML.log.y + 8, { font: '600 12px "Hiragino Mincho ProN", serif', color: '#d9c397' });
    const entries = this.state.log.slice(-4).reverse();
    let y = ML.log.y + 28;
    for (const e of entries) {
      txt(ctx, `${e.year}年 ${e.jp}`, ML.log.x + 12, y, { font: '11px "Hiragino Mincho ProN", serif', color: '#cbb995' });
      y += 16;
      txt(ctx, e.en, ML.log.x + 12, y, { font: '10px sans-serif', color: '#806f58' });
      y += 18;
    }
  }
`);

replaceBetween('  _drawCommandBar(ctx, g) {', '  _closeButton(ctx, g) {', String.raw`
  _drawCommandBar(ctx, g) {
    frame(ctx, ML.cmd.x, ML.cmd.y, ML.cmd.w, ML.cmd.h, { fill: 'rgba(28,19,13,0.97)', stroke: 'rgba(179,138,69,0.75)', radius: 2 });
    ctx.fillStyle = '#b38a45'; ctx.fillRect(ML.cmd.x, ML.cmd.y, ML.cmd.w, 2);
    const icon = { domestic:'政', military:'軍', personnel:'賞', court:'廷', akutou:'悪', chronicle:'記', roster:'将', endTurn:'月' };
    const n = MAP_COMMANDS.length, gap = 5;
    const bw = (ML.cmd.w - gap * (n + 1)) / n;
    const p = g.input.pointer;
    MAP_COMMANDS.forEach((c, i) => {
      const b = {
        x: ML.cmd.x + gap + i * (bw + gap), y: ML.cmd.y + 8, w: bw, h: ML.cmd.h - 14,
        jp: `${icon[c.id] || '・'}  ${c.jp}`, en: c.en, id: c.id, active: this.panel === c.id,
        onClick: (gg) => { if (c.id === 'endTurn') this._endTurn(gg); else this.panel = (this.panel === c.id ? null : c.id); },
      };
      this.buttons.push(b);
      button(ctx, b, hit(b, p));
    });
  }
`);

// Map/panel/notice palette: preserve geometry and game logic, change only presentation.
src = src
  .replace("frame(ctx, ML.map.x, ML.map.y, ML.map.w, ML.map.h, { fill: '#070b13' });", "frame(ctx, ML.map.x, ML.map.y, ML.map.w, ML.map.h, { fill: '#17110c', stroke: 'rgba(111,78,47,0.62)', radius: 2 });")
  .replace("strokeStyle = isSel ? '#22d3ee'", "strokeStyle = isSel ? '#d0a35c'")
  .replace("stroke: 'rgba(34,211,238,0.4)'", "stroke: 'rgba(179,138,69,0.65)'")
  .replace("fill: 'rgba(10,14,22,0.95)', stroke: 'rgba(34,211,238,0.35)', radius: 12", "fill: 'rgba(35,25,17,0.98)', stroke: 'rgba(179,138,69,0.68)', radius: 3")
  .replace("fill: 'rgba(34,211,238,0.14)', stroke: 'rgba(34,211,238,0.5)'", "fill: 'rgba(86,52,28,0.9)', stroke: 'rgba(179,138,69,0.72)'");

fs.writeFileSync(path, src);
console.log('Applied Taihei medieval UI redesign to', path);
