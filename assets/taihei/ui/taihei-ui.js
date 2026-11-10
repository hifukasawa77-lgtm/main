/* Presentation adapter. Rule, RNG, save namespace/schema and battle resolution stay
 * in taihei.html. Native controls call the existing scene handlers; no new rules. */
(() => {
  'use strict';
  const app = document.createElement('main');
  app.id = 'taihei-app';
  document.body.insertBefore(app, canvas);
  document.body.classList.add('taihei-ui');
  const mast = document.createElement('header');
  mast.className = 'ui-masthead';
  mast.innerHTML = '<div class="ui-brand">太平風雲記<small>TAIHEI FUUUNKI</small></div><span class="ui-kicker">忠義と権謀の時代</span>';
  app.append(mast);
  const page = document.createElement('div'); app.append(page);
  const live = document.createElement('div'); live.setAttribute('role','status'); live.setAttribute('aria-live','polite'); app.append(live);
  const dialog = document.createElement('dialog'); dialog.id = 'taihei-dialog'; app.append(dialog);
  const footer = document.createElement('footer'); footer.className='ui-footer';
  footer.textContent='太平記の時代、1331–1392。政務・恩賞・朝廷との関係が、勢力の行く末を変える。'; app.append(footer);
  let current = null, dirty = true, records = [], renderedKey = '', returnFocus = null, confirming = false, selectIndex=0, lastView='';
  const originalText = txt;
  txt = function(ctx,text,x,y,opts) { records.push({text:String(text),x,y}); return originalText(ctx,text,x,y,opts); };
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!=null)n.textContent=text; return n; };
  const add = (parent,tag,cls,text) => {const n=el(tag,cls,text);parent.append(n);return n;};
  const heading = (parent,jp,en) => {add(parent,'h1','',jp);if(en)add(parent,'p','ui-en',en);};
  const panel = (parent,title) => {const n=add(parent,'section','ui-panel');if(title)add(n,'h2','',title);return n;};
  const act = fn => { fn(); dirty=true; };
  function btn(parent,jp,en,fn,options={}) {
    const n=add(parent,'button',options.primary?'ui-primary':options.danger?'ui-danger':'');
    n.type='button'; add(n,'span','',jp); if(en)add(n,'small','',en);
    n.disabled=!!options.disabled;
    if(options.selected!=null)n.setAttribute('aria-pressed',String(!!options.selected));
    n.addEventListener('click',()=>act(fn)); return n;
  }
  function image(parent,src,cls='ui-art',alt='') {const n=add(parent,'img',cls);n.src=src;n.alt=alt;n.loading='lazy';n.addEventListener('error',()=>n.remove(),{once:true});return n;}
  function nativeAction(s,b) {
    if(!b || b.disabled || game.scene!==s)return;
    if(b.onClick) b.onClick(game);
    else {const p=game.input.pointer;const old={...p};Object.assign(p,{x:b.x+b.w/2,y:b.y+b.h/2,justPressed:true,isDown:false});try{s.update(0,game);}finally{Object.assign(p,old,{justPressed:false});}}
  }
  function fromButton(parent,s,b) {return btn(parent,b.jp||'選択',b.en,()=>nativeAction(s,b),{disabled:b.disabled,selected:b.active,primary:b===s.go||b===s.next});}
  function actions(parent,s,items) {const n=add(parent,'div','ui-actions');items.filter(Boolean).forEach(b=>fromButton(n,s,b));}
  function details(parent,title,lines) {const n=add(parent,'details','');add(n,'summary','',title);lines.forEach(t=>add(n,'p','',t));return n;}
  function stat(parent,label,value) {const n=add(parent,'div','ui-stat');label.split(' / ').forEach(t=>add(n,'small','',t));add(n,'strong','',String(value));}
  function select(parent,label,items,value,change) {
    const id='ui-select-'+(++selectIndex); const l=add(parent,'label','',label);l.htmlFor=id;
    const n=add(parent,'select','');n.id=id;
    items.forEach(([v,t])=>{const o=add(n,'option','',t);o.value=v;});n.value=value;
    n.addEventListener('change',()=>act(()=>change(n.value)));return n;
  }
  function confirmAction(title,copy,fn) {
    confirming=true;
    returnFocus=document.activeElement;
    const music=dialog.querySelector('.history-music');if(music)document.body.append(music);
    dialog.replaceChildren();const h=add(dialog,'div','ui-dialog-head');add(h,'h2','',title);
    btn(h,'戻る','Cancel',()=>closeDialog());const body=add(dialog,'div','ui-dialog-body ui-stack');add(body,'p','',copy);
    btn(body,title,'Confirm',()=>{closeDialog();fn();},{primary:true}); if(!dialog.open)dialog.showModal();h.querySelector('button').focus();
  }
  function closeDialog() {confirming=false;if(dialog.open)dialog.close();const key=returnFocus?.dataset?.focus;const target=returnFocus?.isConnected?returnFocus:key?page.querySelector(`[data-focus="${key}"]`):null;target?.focus();returnFocus=null;}
  dialog.addEventListener('close',()=>{returnFocus?.focus();returnFocus=null;});
  function title(s) {
    const hero=add(page,'section','ui-hero');add(hero,'div','ui-kicker','南北朝・歴史シミュレーション');
    heading(hero,'太平風雲記','TAIHEI FUUUNKI · 1331–1392');
    add(hero,'p','','忠義は移ろい、朝廷は割れる。');
    add(hero,'p','','国を治め、将に報い、乱世を導く。あなたの一手が、新たな歴史を紡ぐ。');
    const a=add(hero,'div','ui-stack ui-hero-actions');
    btn(a,'新たな歴史を始める','New game',()=>game.changeScene(new ScenarioSelectScene()),{primary:true});
    btn(a,'続きから遊ぶ','Continue',()=>nativeAction(s,s.buttons.find(b=>b.id==='cont')),{disabled:!s.hasSave});
    if(!s.hasSave)add(a,'small','','保存された進行はありません / No active save');
    if(s.staleSave)add(hero,'p','','保存形式が古いため、既存データを読み込めません。');
    const p=panel(page,'乱世の歩き方');
    add(p,'p','','① 国を選ぶ　② 政務・軍事・外交を行う　③ 月を進める');
    details(p,'遊び方・保存について / How to play',[
      '政務で施設を整え、軍事で隣接国へ出兵します。恩賞不足は将の忠義に影響します。朝廷との関係と正統性も勝敗を左右します。',
      '行動後や月の進行時に、このブラウザへ自動保存されます。続きから再開できます。新しい陣営の確定時に既存の保存を上書きします。',
      '合戦は自軍の部隊を選び、移動先または敵を選択します。騎馬＞弓＞徒歩＞騎馬。各合を終えると敵が行動します。',
      'Auto-saves remain in this browser. Choose a province, issue commands, then advance the month. Rewards and court relations matter as much as military strength.'
    ]);
  }
  function scenario(s) {
    add(page,'p','ui-kicker','出陣の支度　1 / 3');heading(page,'時代を選ぶ','Choose a scenario');
    const grid=add(page,'div','ui-grid');
    SCENARIOS.forEach((sc,i)=>{const card=panel(grid);image(card,SCENARIO_ART_DEFS[sc.id]);
      add(card,'div','ui-kicker',`${sc.startYear}年 ${sc.startMonth}月 · 全${sc.maxTurns}か月`);
      btn(card,(s.sel===i?'✓ 選択中　':'')+sc.jp,sc.en,()=>{s.sel=i;},{selected:s.sel===i});add(card,'p','',sc.desc.jp);add(card,'small','',sc.desc.en);
    });
    actions(page,s,[s.back,s.go]);
  }
  function faction(s) {
    add(page,'p','ui-kicker','出陣の支度　2 / 3');heading(page,'陣営と主人公を選ぶ','Choose your power & officer');
    const sc=SCENARIOS.find(x=>x.id===s.scenarioId);add(page,'p','',sc.jp);
    const layout=add(page,'div','ui-layout');const choices=panel(layout,'陣営 / Powers');
    const grid=add(choices,'div','ui-stack');
    s.list.forEach((f,i)=>{const info=factionInfo(f.id,s.scenarioId);btn(grid,(s.sel===i?'✓ ':'')+info.jp,info.en,()=>{s.sel=i;s.generalSel=null;s.generalPage=0;},{selected:s.sel===i});});
    const p=panel(layout,'所属武将 / Officers');
    add(p,'p','','主人公の選択は任意です。再度押すと解除できます。');
    const f=s.list[s.sel];const gens=GENERALS_DEF.filter(g=>g.camp===f.id&&(g.born==null||g.born<=sc.startYear)&&(g.died==null||g.died>=sc.startYear));
    const list=add(p,'div','ui-stack');
    gens.forEach(g=>{const b=btn(list,(s.generalSel===g.id?'✓ ':'')+g.jp,g.en+' · '+IDEOLOGY[g.ideology].jp,()=>{s.generalSel=s.generalSel===g.id?null:g.id;},{selected:s.generalSel===g.id});image(b,GENERAL_PORTRAIT_BASE+g.id+'.webp','ui-portrait');});
    // Preserve the original faction summary, including scenario-specific descriptions.
    const summary=records.filter(t=>t.x>=544&&t.y>=246&&t.y<=320).map(t=>t.text);
    details(p,'陣営の特徴 / Power details',summary);
    actions(page,s,[s.back,s.go]);
  }
  function story(s) {
    if(s instanceof OpeningScene) {
      add(page,'p','ui-kicker','出陣の支度　3 / 3');const sc=SCENARIOS.find(x=>x.id===s.scenarioId);heading(page,sc.jp,sc.en);
      image(page,SCENARIO_ART_DEFS[s.scenarioId]);const p=panel(page,'歴史の幕開け');
      s.lines.jp.forEach(t=>add(p,'p','',t));details(p,'English',s.lines.en);
      const a=add(page,'div','ui-actions');fromButton(a,s,s.back);
      btn(a,'この陣営で出陣する','Confirm & begin',()=>{
        if(save.get('autosave',null))confirmAction('出陣して保存を上書き','新しい進行が自動保存され、以前の進行を置き換えます。 / Replace the existing save?',()=>nativeAction(s,s.next));
        else nativeAction(s,s.next);
      },{primary:true});
    } else if(s instanceof CutsceneScene) {
      const ev=s._current();add(page,'p','ui-kicker',`歴史の転機　${s.idx+1} / ${s.events.length}`);heading(page,`${ev.year}年　${ev.jp}`,ev.en);
      const art=ASSETS_RT.eventArt.get(ev.id);if(art?.ready)image(page,art.image.src);
      const p=panel(page);(ev.lines||[]).forEach(l=>add(p,'p','',l.jp));details(p,'English',(ev.lines||[]).map(l=>l.en));
      btn(page,ev.battle?'合戦へ進む':'次へ',ev.battle?'Proceed to battle':'Next',()=>s._advance(game),{primary:true});
    } else {
      heading(page,s instanceof EndingScene?'歴史の結末':'史実合戦の結末','Ending');
      const texts=records.filter(t=>!((s.back||s.toTitle)&&t.y>(s.back||s.toTitle).y));
      const p=panel(page);texts.forEach(t=>add(p,'p','',t.text));actions(page,s,[s.back||s.toTitle]);
    }
  }
  function provinceChooser(parent,s) {
    const opts=[['','国を選んでください / Select province']];
    const sorted=DATA.provinces.slice().sort((a,b)=>(s.state.provinces[b.id].owner===s.player)-(s.state.provinces[a.id].owner===s.player));
    sorted.forEach(p=>{const ps=s.state.provinces[p.id];opts.push([p.id,`${ps.owner===s.player?'自国 · ':''}${p.jp}　${ps.owner?campLabelOf(s.state,ps.owner).jp:'独立'}`]);});
    select(parent,'対象国 / Province',opts,s.sel||'',id=>{s.sel=id||null;});
  }
  function map(s) {
    const st=s.state,c=st.camps[s.player];add(page,'p','ui-kicker',`${st.year}年 ${st.month||1}月 · 第${st.turn}ターン`);heading(page,c.jp,'領国を治め、次の一手を。');
    const stats=add(page,'div','ui-stats');stat(stats,'軍資金 / Gold',`${Math.round(c.gold)} 貫`);
    const own=Object.values(st.provinces).filter(p=>p.owner===s.player);stat(stats,'兵力 / Troops',own.reduce((n,p)=>n+p.garrison,0)+' 人');stat(stats,'領国 / Provinces',own.length+' 国');
    const layout=add(page,'div','ui-layout ui-map-layout');const left=add(layout,'div','ui-stack');const right=add(layout,'div','ui-stack');
    const territory=panel(left,'一、対象国を選ぶ');provinceChooser(territory,s);
    if(s.sel){const p=DATA.provById[s.sel],ps=st.provinces[s.sel];add(territory,'h3','',p.jp+'国');
      add(territory,'p','',`${ps.owner===s.player?'自国':ps.owner?campLabelOf(st,ps.owner).jp:'独立勢力'} · 兵 ${ps.garrison}人 · 石高 ${p.koku}`);
      add(territory,'p','',`施設：${ps.facility?FACILITIES[ps.facility].jp:'なし'}　地形：${TERRAIN_T[p.terrain]?.jp||p.terrain}`);
    }
    territory.classList.add('ui-order-1');
    const m=add(territory,'details','');m.open=matchMedia('(min-width:701px)').matches;add(m,'summary','','全国図 / Map');const mc=add(m,'canvas','ui-map');mc.width=950;mc.height=526;mc.setAttribute('role','img');mc.setAttribute('aria-label','全国の勢力図。国の選択には上の選択欄を使用できます。');mc.dataset.map='true';
    const z=add(m,'div','ui-action-grid');
    btn(z,'地図を拡大','Zoom in',()=>s._zoomAt(ML.map.x+ML.map.w/2,ML.map.y+ML.map.h/2,1.4));
    btn(z,'地図を縮小','Zoom out',()=>s._zoomAt(ML.map.x+ML.map.w/2,ML.map.y+ML.map.h/2,1/1.4));
    btn(z,'全体に戻す','Reset map',()=>{s.cam.zoom=1;s.cam.cx=ML.map.x+ML.map.w/2;s.cam.cy=ML.map.y+ML.map.h/2;});
    [['↑ 北へ',0,-1],['↓ 南へ',0,1],['← 西へ',-1,0],['→ 東へ',1,0]].forEach(([label,dx,dy])=>btn(z,label,'Pan map',()=>{s.cam.cx+=dx*140/s.cam.zoom;s.cam.cy+=dy*140/s.cam.zoom;s._clampCam();}));
    mc.addEventListener('click',e=>{const r=mc.getBoundingClientRect();const id=s._provAt(ML.map.x+(e.clientX-r.left)/r.width*950,ML.map.y+(e.clientY-r.top)/r.height*526);if(id)act(()=>{s.sel=id;});});
    const commands=panel(right,'二、行動を選ぶ');commands.classList.add('ui-order-2');add(commands,'p','',s.sel?`対象：${DATA.provById[s.sel].jp}国`:'まず対象国を選択。人事・朝廷・記録は直接開けます。');
    const grid=add(commands,'div','ui-action-grid');MAP_COMMANDS.filter(x=>x.id!=='endTurn').forEach(cmd=>btn(grid,cmd.jp,cmd.en,()=>openPanel(s,cmd.id),{selected:s.panel===cmd.id}));
    const next=panel(right,'三、月を進める');next.classList.add('ui-order-3');add(next,'p','','他勢力が行動し、収入・忠義・歴史が動きます。');
    btn(next,'今月を終える →','End month',()=>confirmAction('月を進める',`${st.year}年${st.month||1}月の行動を終えます。他勢力の行動と自動保存が行われます。 / End this month and auto-save?`,()=>s._endTurn(game)),{primary:true});
    add(next,'small','','行動後・月の進行時に自動保存 / Auto-save enabled');
    details(left,'勢力・朝廷・主人公の詳細 / Status',records.filter(t=>t.x>=ML.side.x&&t.y<ML.side.y+ML.side.h).map(t=>t.text));
    const logs=panel(left,'直近の動き / Recent events');const ol=add(logs,'ol','ui-logs');st.log.slice(-3).reverse().forEach(e=>{const li=add(ol,'li','',`${e.year}年 ${e.jp}`);add(li,'small','',e.en);});
    const tools=add(right,'details','');add(tools,'summary','','保存・タイトル / Save & title');
    btn(tools,'今の進行を保存','Save now',()=>{save.set('autosave',st);announce('進行を保存しました / Saved');});
    btn(tools,'タイトルへ戻る','Return to title',()=>game.changeScene(new TitleScene()));
    details(right,'遊び方 / Help',['恩賞不足と忠義低下に注意。朝廷の正統性と関係も重要です。','政務は自国、軍事は自国を出兵元に選択します。悪党の作戦と討伐令は他勢力の国を選びます。','合戦は自軍を選択→移動または攻撃→この合を終える、の順に操作します。']);
  }
  function announce(text) {live.className='ui-notice';live.textContent=text;}
  function openPanel(s,id) {returnFocus=document.activeElement;s.panel=id;renderedKey='';}
  function panelContent(s) {
    if(confirming)return;
    const title=MAP_COMMANDS.find(x=>x.id===s.panel);
    const key=JSON.stringify([s.panel,s.sel,s.courtTab,s.rosterSel,s.rosterPage,s.state.camps[s.player].gold,s.state.akutou[s.player],s.notice?.jp]);
    if(key===renderedKey&&dialog.open)return;
    const oldTop=dialog.scrollTop;const focused=document.activeElement?.dataset?.control;
    const music=dialog.querySelector('.history-music');if(music)document.body.append(music);
    dialog.replaceChildren();const h=add(dialog,'div','ui-dialog-head');add(h,'h2','',title.jp);
    btn(h,'閉じる','Close',()=>{s.panel=null;closeDialog();});
    const body=add(dialog,'div','ui-dialog-body ui-stack');provinceChooser(body,s);
    if(s.noticeT>0&&s.notice)add(body,'p','ui-notice',s.notice.jp);
    if(s.panel==='roster'&&s.rosterSel)image(body,GENERAL_PORTRAIT_BASE+s.rosterSel+'.webp','ui-portrait');
    if(s.panel==='chronicle') {
      const list=add(body,'ol','ui-logs');s.state.log.slice().reverse().forEach(e=>{const li=add(list,'li','',`${e.year}年 ${e.jp}`);add(li,'small','',e.en);});
    } else {
      // Reflow the original panel's text and controls in reading order, preserving
      // costs, target names, descriptions, roster pages and all existing handlers.
      const bs=s.buttons.filter(b=>b.y>=PANEL_RECT.y&&b.y<PANEL_RECT.y+PANEL_RECT.h&&!b.id&&b.jp!=='×');
      const ts=records.filter(t=>t.x>=PANEL_RECT.x&&t.x<=PANEL_RECT.x+PANEL_RECT.w&&t.y>=PANEL_RECT.y+66&&t.y<PANEL_RECT.y+PANEL_RECT.h);
      const inside=(t,b)=>t.x>=b.x&&t.x<=b.x+b.w&&t.y>=b.y&&t.y<=b.y+b.h;
      const rowContext=(t,b)=>['Attack','Reward'].includes(b.en)&&t.x<b.x&&t.y>=b.y-6&&t.y<=b.y+b.h+12;
      let elements=bs.map(b=>({y:b.y,x:b.x,b,texts:ts.filter(t=>inside(t,b)),context:ts.filter(t=>rowContext(t,b))}));
      ts.filter(t=>!bs.some(b=>inside(t,b)||rowContext(t,b))).forEach(t=>elements.push({y:t.y,x:t.x,t}));
      // Roster details precede the selectable list on small screens.
      if(s.panel==='roster'){const detail=elements.filter(e=>e.x>=848);const rest=elements.filter(e=>e.x<848);elements=[...detail.sort((a,b)=>a.y-b.y),...rest.sort((a,b)=>a.y-b.y||a.x-b.x)];}
      else elements.sort((a,b)=>a.y-b.y||a.x-b.x);
      elements.forEach((e,i)=>{
        if(e.b){
          const b=e.b;let label=b.jp||e.texts.map(t=>t.text).join(' ')||'武将を選択';
          if(b.en==='Reward'&&e.context.length)label=e.context[0].text+'に恩賞';
          const card=add(body,'div','ui-stack');
          e.context.forEach(t=>add(card,'p','',t.text));
          const rosterRow=s.panel==='roster'&&!b.jp;
          const rosterGroup=rosterRow?Math.round((b.x-PANEL_RECT.x-24)/224):0;
          const rosterGroupLabel=[factionInfo('ashikaga',s.state.scenarioId).jp,factionInfo('nancho',s.state.scenarioId).jp,'地方勢力'][rosterGroup];
          const rosterSelected=rosterRow&&label.replace(/^[†◇] /,'')===GENERALS_DEF.find(g=>g.id===s.rosterSel)?.jp;
          const n=btn(card,(rosterSelected?'✓ ':'')+label,rosterRow?rosterGroupLabel:b.en,()=>{
            if(b.en==='Attack') confirmAction('出兵する','選択した敵国へ出兵し、合戦を開始します。 / Launch this attack?',()=>nativeAction(s,b));
            else nativeAction(s,b);
          },{disabled:b.disabled,selected:rosterRow?rosterSelected:s.panel==='court'&&['南朝','北朝'].includes(b.jp)?(b.jp==='南朝'?s.courtTab==='nancho':s.courtTab==='hokucho'):undefined});
          n.dataset.control=e.context.length?b.en+'-'+e.context[0].text:String(i);
          e.texts.filter(t=>t.text!==label&&t.text!==b.en).forEach(t=>add(card,'small','',t.text));
        } else add(body,'p',/^[\x00-\x7f]*$/.test(e.t.text)?'ui-en':'',e.t.text);
      });
    }
    renderedKey=key;if(!dialog.open)dialog.showModal();else dialog.scrollTop=oldTop;
    if(focused)dialog.querySelector(`[data-control="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  }
  function result(s) {
    const r=s.actionResult;const p=panel(page,r.titleJp);add(p,'p','ui-kicker',r.statusJp+' / '+r.statusEn);
    const art=ASSETS_RT.actionArt.get(r.id);if(art?.ready)image(p,art.image.src);
    add(p,'p','',r.copyJp);add(p,'small','',r.copyEn);
    btn(p,'領国へ戻る','Return to map',()=>{s.actionResult=null;s.notice=null;s.noticeT=0;},{primary:true});
  }
  function battle(s) {
    const b=s.b;heading(page,`${b.target.jp}の合戦`,`${b.round} / ${b.maxRounds} 合目`);
    if(s.result){const won=s.result.winner===s.playerSide;const p=panel(page,won?'勝利':'敗退');add(p,'p','',s.result.why);btn(p,'結果を確認して進む','Continue',()=>s.onDone(s.result),{primary:true});return;}
    const stats=add(page,'div','ui-stats');stat(stats,'自軍',TBattle.alive(b,s.playerSide).reduce((n,u)=>n+u.troops,0));stat(stats,'敵軍',TBattle.alive(b,s.playerSide==='atk'?'def':'atk').reduce((n,u)=>n+u.troops,0));stat(stats,'選択部隊',s.sel?UNITS[s.sel.type].jp:'未選択');
    const p=panel(page,'部隊を選び、移動・攻撃');add(p,'p','','自軍 → 移動先、または敵軍を選択。点線は移動可能。盤面だけ左右にスクロールできます。');
    const scroll=add(p,'div','ui-battle-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','戦場。左右スクロールで全13列を表示');
    const board=add(scroll,'div','ui-board');
    for(let y=0;y<HEX.rows;y++)for(let x=0;x<HEX.cols;x++){
      const u=TBattle.at(b,x,y);const terrain=TBattle.terrainAt(b,x,y);const reachable=s.reach?.has(`${x},${y}`);
      const n=btn(board,u?(u.side===s.playerSide?'自':'敵')+UNITS[u.type].jp:terrain.jp,u?`${u.troops}人${u.acted?' 済':''}`:`${x+1},${y+1}`,()=>{
        const pos=hexToPixel(x,y,s.hs);nativeAction(s,{x:s.ox+pos.x-1,y:s.oy+pos.y-1,w:2,h:2});
      },{selected:s.sel===u&&!!u});
      n.setAttribute('aria-label',`${x+1}列 ${y+1}行 ${u?`${u.side===s.playerSide?'自軍':'敵軍'} ${UNITS[u.type].jp} 兵${u.troops} 士気${Math.round(u.morale)} ${u.acted?'行動済み':''}`:terrain.jp}${reachable?' 移動可能':''}`);
      if(u)n.classList.add(u.side===s.playerSide?'ui-ally':'ui-enemy');else if(reachable)n.classList.add('ui-reach');
    }
    const a=add(page,'div','ui-actions');btn(a,'この合を終える','End round',()=>s._endRound(game),{primary:true});
    if(s.noticeT>0)add(page,'p','ui-notice',s.notice.jp);
    details(page,'兵科と部隊 / Units',records.filter(t=>t.x>=BL.side.x&&t.y<BL.side.y+BL.side.h).map(t=>t.text));
    const log=panel(page,'戦況 / Battle log');b.log.slice(0,8).forEach(t=>add(log,'p','',t));
  }
  function render(s) {
    const oldScene=current;current=s;
    const view=s.constructor.name+(s.result?'-result':'')+(s.actionResult?'-action-result':'');
    const viewChanged=view!==lastView;lastView=view;
    const detailStates=Array.from(page.querySelectorAll('details'),d=>d.open);
    const boardScroll=page.querySelector('.ui-battle-scroll')?.scrollLeft||0;
    const activeKey=document.activeElement?.dataset?.focus;
    page.replaceChildren();
    if(s instanceof TitleScene)title(s);
    else if(s instanceof ScenarioSelectScene)scenario(s);
    else if(s instanceof FactionSelectScene)faction(s);
    else if(s instanceof MapScene){if(s.actionResult)result(s);else map(s);}
    else if(s instanceof BattleScene)battle(s);
    else if(s instanceof BootScene){heading(page,'太平風雲記','読み込み中 / Loading…');}
    else story(s);
    page.querySelectorAll('button').forEach((n,i)=>n.dataset.focus=String(i));
    if(oldScene===s){page.querySelectorAll('details').forEach((d,i)=>{if(i<detailStates.length)d.open=detailStates[i];});const board=page.querySelector('.ui-battle-scroll');if(board)board.scrollLeft=boardScroll;}
    if(oldScene!==s||viewChanged){closeDialog();renderedKey='';live.textContent='';live.className='';window.scrollTo(0,0);const h=page.querySelector('h1,h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
    else if(activeKey&&!dialog.open)page.querySelector(`[data-focus="${activeKey}"]`)?.focus({preventScroll:true});
    if(!confirming&&(!(s instanceof MapScene)||!s.panel)){if(dialog.open)closeDialog();renderedKey='';}
  }
  // Re-render only after a user action or scene transition. The original renderer
  // continues to supply art and panel metadata; focus/scroll survive idle frames.
  const originalPanel=MapScene.prototype._drawPanel;
  MapScene.prototype._drawPanel=function(ctx,g){records=[];originalPanel.call(this,ctx,g);};
  const scenes=[BootScene,TitleScene,ScenarioSelectScene,FactionSelectScene,OpeningScene,CutsceneScene,HistoricalGameOverScene,EndingScene,MapScene,BattleScene];
  for(const C of scenes){const draw=C.prototype.draw;C.prototype.draw=function(ctx,g){
    records=[];draw.call(this,ctx,g);
    if(dirty||current!==this){dirty=false;render(this);}
    if(this instanceof MapScene){
      const c=page.querySelector('[data-map]');if(c&&c.parentElement.open&&!this.panel&&!this.actionResult)c.getContext('2d').drawImage(canvas,ML.map.x,ML.map.y,ML.map.w,ML.map.h,0,0,c.width,c.height);
      if(this.panel&&!this.actionResult)panelContent(this);
      if(this.noticeT>0&&this.notice&&live.textContent!==this.notice.jp)announce(this.notice.jp);
    }
  };}
  dialog.addEventListener('cancel',()=>{confirming=false;if(current instanceof MapScene)current.panel=null;dirty=true;});
  // GameKit globally consumes Space/arrows for Canvas. Native form controls must
  // retain their standard keyboard behavior without changing the shared engine.
  app.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.stopPropagation();});
  // Shared music widget is fixed by default. Keep it after game content.
  const musicObserver=new MutationObserver(()=>{
    const music=document.querySelector('.history-music');
    if(music){music.style.position='static';music.style.margin='16px auto';music.style.fontSize='14px';music.addEventListener('keydown',e=>e.stopPropagation());musicObserver.disconnect();}
  });musicObserver.observe(document.body,{childList:true,subtree:true});
})();
