(() => {
  const $ = selector => document.querySelector(selector);
  const factionById = id => GAME_DATA.factions.find(f => f.id === id) || { name: '朝廷・中立', color: '#8c7c67', attitude: '公議' };
  const state = { ...GAME_DATA.start, selectedRegion: 'edo', person: 0, layer: 'politics', inspector: 'region', log: [] };

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function pushLog(text, kind = '') { state.log.unshift({ text, kind }); state.log = state.log.slice(0, 5); }
  function dateLabel() { return `嘉永${state.year - 1852}年（${state.year}）・${state.month}月`; }
  function renderStatus() {
    $('#date').textContent = dateLabel();
    $('#treasury').textContent = `${state.treasury.toLocaleString()}両`;
    $('#court-support').textContent = `${state.court} / 100`;
    $('#modernization').textContent = `${state.modernization} / 100`;
    $('#tension').textContent = `${state.tension} / 100`;
    $('#victory-court').textContent = `${state.court} / 100`;
    $('#victory-modernization').textContent = `${state.modernization} / 100`;
  }
  function regionColor(region) {
    if (state.layer === 'politics') return factionById(region.faction).color;
    if (state.layer === 'military') return ['edo', 'tohoku', 'ezo'].includes(region.id) ? '#4e6c86' : ['satsuma', 'choshu'].includes(region.id) ? '#b35f3d' : '#927d54';
    const level = { ezo: 62, edo: 73, satsuma: 70, choshu: 57, tosa: 46, kyoto: 38, echigo: 33, tohoku: 29 }[region.id] || 30;
    return level > 65 ? '#cfb44d' : level > 45 ? '#7f9d7a' : '#7e736c';
  }
  function renderMap() {
    const map = $('#map'); map.innerHTML = '<div class="map-tools"><div class="mini-map" aria-label="日本全図"></div><div class="zoom-stack"><button aria-label="拡大">＋</button><button aria-label="縮小">−</button><button aria-label="全図">□</button></div></div><div class="sea-label">日本海</div><div class="sea-label pacific">太平洋</div><div class="landmass"></div>';
    GAME_DATA.regions.forEach(region => {
      const faction = factionById(region.faction);
      const button = document.createElement('button');
      button.className = `region-node ${region.id === state.selectedRegion ? 'active' : ''}`;
      button.style.cssText = `left:${region.x}%;top:${region.y}%;--region-color:${regionColor(region)}`;
      button.innerHTML = `<span class="node-dot"></span><span>${region.name}</span>`;
      button.onclick = () => { state.selectedRegion = region.id; render(); };
      map.append(button);
    });
    const labels = { politics: '政治的傾向', military: '軍事的緊張と影響圏', modernization: '洋式技術・産業の浸透度' };
    $('.map-notice').textContent = `地域を選択して情報を確認。現在は「${labels[state.layer]}」を表示しています。`;
  }
  function renderRegion(target) {
    const region = GAME_DATA.regions.find(r => r.id === state.selectedRegion); const faction = factionById(region.faction);
    const regionImage = region.id === 'ezo' ? 'assets/battles/naval-battle.png' : 'assets/battles/siege-battle.png';
    target.innerHTML = `<div class="inspector-heading"><p class="eyebrow">拠点・人物情報</p><h2>${region.name}</h2></div><div class="region-art"><img src="${regionImage}" alt="${region.asset}"></div><div class="region-subtabs"><button class="active">基本</button><button>軍事</button><button>施設</button><button>人物</button></div><p class="tag" style="--tag-color:${faction.color}">${faction.name}</p><dl><div><dt>領有・石高</dt><dd>${region.kokudaka}</dd></div><div><dt>主要拠点</dt><dd>${region.asset}</dd></div></dl><p class="region-note">${region.note}</p>`;
  }
  function renderPeople(target) {
    const person = GAME_DATA.people[state.person];
    target.innerHTML = `<div class="panel-title"><div><p class="eyebrow">人物</p><h2>主な人物</h2></div><button id="next-person" class="icon-button" title="次の人物">→</button></div><div class="portrait-wrap" style="--portrait-tint:${person.tint}"><img src="${person.portrait}" alt="${person.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="portrait-fallback" style="display:none">${person.name.slice(0,1)}</div></div><div class="person-copy"><h3>${person.name}</h3><p>${person.faction}　${person.role}</p><p class="trait">${person.trait}</p><div class="stats"><span>統率 <b>${person.stats[0]}</b></span><span>戦術 <b>${person.stats[1]}</b></span><span>政治 <b>${person.stats[3]}</b></span></div><p class="ideology">${person.ideology}</p></div>`;
    $('#next-person').onclick = () => { state.person = (state.person + 1) % GAME_DATA.people.length; renderInspector(); };
  }
  function renderActions() {
    $('#actions').innerHTML = GAME_DATA.actions.map(a => `<button class="action" data-action="${a.id}" ${state.treasury < a.cost ? 'disabled' : ''}><span><b>${a.title}</b><small>${a.text}</small></span><em>${a.cost}両</em></button>`).join('');
    document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => doAction(button.dataset.action));
    $('#factions').innerHTML = GAME_DATA.factions.map(f => `<div><i style="background:${f.color}"></i><span>${f.name}</span><small>${f.attitude}</small></div>`).join('');
  }
  function renderLog(target) { target.innerHTML = `<div class="inspector-heading"><p class="eyebrow">風聞・出来事</p><h2>情勢報告</h2></div><ol>${state.log.map(l => `<li class="${l.kind}">${l.text}</li>`).join('') || '<li>浦賀沖の異国船について、江戸中で噂が広がっている。</li>'}</ol>`; }
  function renderInspector() {
    const target = $('#inspector-content');
    document.querySelectorAll('[data-inspector]').forEach(button => button.classList.toggle('active', button.dataset.inspector === state.inspector));
    if (state.inspector === 'region') renderRegion(target);
    if (state.inspector === 'person') renderPeople(target);
    if (state.inspector === 'chronicle') renderLog(target);
  }
  function renderMapFeed() { $('#map-feed-content').innerHTML = state.log.slice(0, 4).map((entry, index) => `<div><i>${String(state.month).padStart(2,'0')}/${String(Math.max(1, 12 - index)).padStart(2,'0')}</i>${entry.text}</div>`).join(''); }
  function render() { renderStatus(); renderMap(); renderInspector(); renderActions(); renderMapFeed(); }
  function doAction(id) {
    const action = GAME_DATA.actions.find(a => a.id === id); if (state.treasury < action.cost) return;
    state.treasury -= action.cost; Object.entries(action.effect).forEach(([key, value]) => state[key] = clamp(state[key] + value));
    pushLog(action.log); render();
  }
  function advanceTurn() {
    state.month += 1; if (state.month === 13) { state.month = 1; state.year += 1; state.treasury += 90; }
    state.tension = clamp(state.tension + (Math.random() > .6 ? 1 : -1));
    const event = GAME_DATA.events.find(e => e.year === state.year && e.month === state.month);
    if (event) { Object.entries(event.effect).forEach(([key, value]) => state[key] = clamp(state[key] + value)); pushLog(`${event.title} — ${event.text}`, 'event'); }
    else pushLog(`${state.year}年${state.month}月。諸藩の動きを探らせている。`);
    render();
  }
  $('#advance-turn').onclick = advanceTurn;
  $('#advance-bottom').onclick = advanceTurn;
  document.querySelectorAll('[data-layer]').forEach(button => button.onclick = () => { state.layer = button.dataset.layer; document.querySelectorAll('[data-layer]').forEach(b => b.classList.toggle('active', b === button)); renderMap(); });
  document.querySelectorAll('[data-inspector]').forEach(button => button.onclick = () => { state.inspector = button.dataset.inspector; renderInspector(); });
  document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); advanceTurn(); } });
  pushLog('嘉永6年、浦賀沖に黒船が姿を現した。', 'event'); render();
})();
