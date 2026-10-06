(function (root) {
  'use strict';
  const D = root.BakumatsuCharacterData || (typeof require === 'function' && require('./bakumatsu-character-data.js'));
  const B=root.BakumatsuBattle || (typeof require==='function' && require('./bakumatsu-battle.js'));
  const deadline=s=>s.history?.enabled?1870:1869;
  const clamp=(v,lo=0,hi=100)=>Math.max(lo,Math.min(hi,v));
  const copy=x=>JSON.parse(JSON.stringify(x));
  const relationKey=(a,b)=>[a,b].sort().join(':');
  function relationship(s,a,b) { return s.relationships[relationKey(a,b)] || 0; }
  function trust(s,a,b,value) { s.relationships[relationKey(a,b)]=clamp(value); }
  function active(s) { return s.peopleById[s.activePersonId]; }
  function protagonist(s) { return s.peopleById[s.protagonistId]; }
  function log(s,text) { s.logs.unshift({text,date:dateLabel(s)});s.logs=s.logs.slice(0,60); }
  function dateLabel(s) { const d=s.date;return `${d.year}年${d.month}月${d.day}日 ${D.phases[d.phase]}`; }
  function goal(p) { return ({尊王:['勤王','倒幕'],公議:['公武合体','議会構想'],佐幕:['幕府護持','幕政改革']})[p.ideology][Number(p.progressiveness>=50)]; }
  function companions(s,id=s.protagonistId) { const p=s.peopleById[id];return Object.values(s.peopleById).filter(t=>t.id!==id && t.alive && t.ideology===p.ideology && relationship(s,id,t.id)>=80); }
  function create(scenarioId,heroId,difficulty='normal') {
    const scenario=D.scenarios.find(x=>x.id===scenarioId),hero=D.heroes.find(x=>x.id===heroId);
    if(!scenario || !hero || !['easy','normal','hard'].includes(difficulty)) throw Error('開始条件が不正です。');
    const s={schemaVersion:1,mode:'character',scenarioId,difficulty,settings:{timer:difficulty!=='easy',spirit:true},date:{year:scenario.year,month:scenario.month,day:scenario.day,phase:0},protagonistId:heroId,activePersonId:heroId,initialIdeology:hero.ideology,peopleById:{},domainsById:{},relationships:{},audiences:{emperor:false,shogun:false},campaigns:{aizu:false,choshu:false},logs:[],status:'playing',result:'',pendingCounter:null,lastCounterDate:'',duel:null};
    B.init(s,Boolean(scenario.history));
    const base={hp:100,money:difficulty==='easy'?260:difficulty==='hard'?120:180,resistance:100,alive:true,kind:'political'};
    for (const h of D.heroes) {s.peopleById[h.id]={...base,...copy(h)};if(h.id==='ryoma' && scenarioId==='bunkyu')s.peopleById[h.id].rank=0;}
    for (const [i,d] of D.domains.entries()) {
      const locationId=D.capitals[d.id]||d.id;
      // 藩内の紹介網は架空の役職人物。実在人物の誤った在職設定を避ける。
      for(let rank=0;rank<4;rank++) {
        const id=`${d.id}-${rank}`,names=['在郷の志士','藩士代表','家老代理','藩主（政務代理）'];
        s.peopleById[id]={...base,id,name:`${d.name} ${names[rank]}`,domainId:d.id,locationId,rank,ideology:d.ideology,foreignPolicy:d.foreignPolicy,progressiveness:45+i%4*10,sword:40+rank*10,military:45+rank*10,learning:45+rank*12,charm:50+rank*8,favorite:D.methods[(i+rank)%5],resistance:60+rank*10,fictional:true};
      }
      s.domainsById[d.id]={...copy(d),leaderId:`${d.id}-3`,troops:2800+d.power*35,training:35,modernization:35};
    }
    log(s,'志士として旅立った。思想・能力は本作のゲーム設定。暦は西暦、政治展開は仮想です。');
    return s;
  }
  function canMeet(s,t) {
    const p=active(s);
    if(!t || t.id===p.id || !t.alive || t.kind!=='political')return {ok:false,reason:'面会対象ではありません。'};
    if(t.locationId!==p.locationId)return {ok:false,reason:'相手のいる拠点へ移動してください。'};
    if(t.rank<=p.rank+1)return {ok:true};
    const introducer=companions(s,p.id).find(q=>q.domainId===t.domainId && q.rank===t.rank-1);
    return introducer?{ok:true,introducer:introducer.id}:{ok:false,reason:`${D.ranks[t.rank-1]}の信頼80以上の紹介、または身分${D.ranks[Math.max(0,t.rank-1)]}の同志への操作切替が必要です。`};
  }
  function authority(s,domainId) {
    const p=active(s),d=s.domainsById[domainId],leader=d && s.peopleById[d.leaderId];
    return Boolean(leader && leader.alive && leader.ideology===s.initialIdeology && p.ideology===s.initialIdeology && (p.id===leader.id || relationship(s,p.id,leader.id)>=80));
  }
  function unified(s) { return Object.values(s.domainsById).filter(d=>d.ideology===s.initialIdeology).length; }
  function requirements(s) {
    const i=s.initialIdeology;
    return [{label:'全11勢力の国体思想統一',ok:unified(s)===11},...(i==='尊王'?[{label:'会津の武力征伐',ok:s.campaigns.aizu},{label:'江戸で将軍に面会',ok:s.audiences.shogun}]:i==='佐幕'?[{label:'長州の武力征伐',ok:s.campaigns.choshu},{label:'京都で天皇に面会',ok:s.audiences.emperor}]:[{label:'京都で天皇に面会',ok:s.audiences.emperor},{label:'江戸で将軍に面会',ok:s.audiences.shogun}])];
  }
  function checkEnding(s) {
    if(s.status!=='playing')return;
    const p=protagonist(s);
    if(!p.alive || p.hp<=0) {s.status='lost';s.result='主人公が倒れ、維新への道は途絶えた。';}
    else if(p.ideology!==s.initialIdeology) {s.status='lost';s.result='主人公の国体思想が転向した。';}
    else if(s.date.year>=deadline(s)) {s.status='lost';s.result=`${deadline(s)}年1月1日の期限を迎えた。`;}
    else if(!s.battle && requirements(s).every(x=>x.ok)) {s.status='won';s.result=`${s.initialIdeology}の大義に基づく明治維新を達成！`;}
    if(s.status!=='playing'){s.pendingCounter=null;s.duel=null;s.battle=null;log(s,s.result);}
  }
  function tick(s,count) {
    for(let n=0;n<count && s.status==='playing';n++) {
      s.date.phase++;
      if(s.date.phase===4) {
        s.date.phase=0;s.date.day++;
        const days=new Date(Date.UTC(s.date.year,s.date.month,0)).getUTCDate();
        if(s.date.day>days){s.date.day=1;s.date.month++;if(s.date.month===13){s.date.month=1;s.date.year++;}}
      }
      // 日付境界では期限・死亡・転向のみを確定。勝利は行動の全枠消費後。
      if(s.date.year>=deadline(s) || !protagonist(s).alive || protagonist(s).hp<=0 || protagonist(s).ideology!==s.initialIdeology)checkEnding(s);
    }
  }
  function route(from,to,method='walk') {
    if(from===to)return [];
    if(method==='ship') {const a=D.places.find(x=>x.id===from),b=D.places.find(x=>x.id===to);return a?.port && b?.port ? [to] : null;}
    const queue=[[from]],seen=new Set([from]);
    while(queue.length){const path=queue.shift(),last=path[path.length-1];for(const edge of D.edges){const next=edge[0]===last?edge[1]:edge[1]===last?edge[0]:null;if(!next||seen.has(next))continue;const extended=[...path,next];if(next===to)return extended.slice(1);seen.add(next);queue.push(extended);}}
    return null;
  }
  function moveCost(s,to,method='walk') {
    if(!['walk','palanquin','ship'].includes(method))return null;
    const path=route(active(s).locationId,to,method);if(!path || !path.length)return null;
    return {path,slots:method==='walk'?path.length:method==='ship'?2:Math.ceil(path.length/2),money:method==='walk'?0:method==='ship'?30:path.length*8};
  }
  function power(s,method) {
    const p=active(s);
    return {賄賂:Math.min(100,p.money/2),脅迫:(p.military+p.sword)/2,理論:p.learning,威圧:Math.min(100,p.rank*20+companions(s,p.id).length*8),本音:p.charm}[method];
  }
  function effect(s,t,method,spirit) {return clamp(Math.round(6+power(s,method)*.15+clamp(spirit,0,1)*8+(t.favorite===method?5:method==='脅迫'&&t.favorite==='本音'?-5:0)-t.resistance*.04),3,30);}
  function error(message){return {ok:false,message};}
  function act(s,command,rng=Math.random) {
    if(s.status!=='playing')return error('この物語は終了しています。記録から再開するかタイトルへ戻ってください。');
    const p=active(s),type=command.type;
    if(s.pendingCounter && !['counter','settings'].includes(type))return error('逆説得への応答を選んでください。');
    if(s.duel && !['strike','flee','settings'].includes(type))return error('剣戟を決着させてください。');
    if(s.battle && (type==='battlePractice'||!type.startsWith('battle') && type!=='settings'))return error('合戦を決着させてください。');
    if(type.startsWith('battle')&&type!=='battlePractice'){
      if(type==='battleFinish'){
        const b=s.battle;if(!b || b.phase!=='result')return error('合戦はまだ決着していません。');
        const won=b.outcome==='victory',survivors=b.units.filter(u=>u.team==='player').reduce((n,u)=>n+u.hp,0);
        if(!b.practice){const source=s.domainsById[b.source];if(source)source.troops=Math.max(0,source.troops-(Math.min(3600,Math.max(600,b.initialTroops))-survivors)-(b.outcome==='retreat'?Math.round(survivors*.1):0));
          if(b.eventId)s.history.results[b.eventId]=b.outcome;
          if(won&&b.target){const t=s.domainsById[b.target];t.ideology=s.initialIdeology;s.peopleById[t.leaderId].ideology=s.initialIdeology;t.troops=Math.max(500,t.troops-1000);if(['aizu','choshu'].includes(t.id))s.campaigns[t.id]=true;}
          if(won&&b.eventId==='aizu-war'&&b.side===0)s.campaigns.aizu=true;
          p.military=clamp(p.military+(won?3:1));
        }
        const message=b.name+'：'+({victory:'勝利',defeat:'敗北',retreat:'撤退',peace:'交渉成立'})[b.outcome];s.battle=null;log(s,message);tick(s,b.practice?0:1);checkEnding(s);B.trigger(s);return {ok:true,message,slots:b.practice?0:1};
      }
      return B.act(s.battle,command,rng);
    }
    if(type==='historySettings'){if(typeof command.enabled!=='boolean'||typeof command.mobilized!=='boolean'||!command.causes||Object.keys(B.causes).some(k=>typeof command.causes[k]!=='boolean'))return error('参陣設定が不正です。');s.history.enabled=command.enabled;s.history.mobilized=command.mobilized;s.history.causes=Object.fromEntries(Object.keys(B.causes).map(k=>[k,command.causes[k]]));checkEnding(s);B.trigger(s);return {ok:true,message:'歴史イベントの参陣・契機を設定しました。',slots:0};}
    if(type==='battlePractice'){const e=B.events.find(e=>e.id===command.event);if(!e)return error('演習の合戦を選んでください。');s.battle=B.create({name:e.name+'（演習）',eventId:e.id,source:p.domainId,terrain:e.terrain,phase:e.id==='first-choshu'?'negotiation':'briefing',troops:2400,practice:true,date:B.stamp(s.date)});return {ok:true,message:'演習を開始。実際の年月・兵力・歴史結果は変わりません。',slots:0};}
    if(type==='historyWait'){if(!s.history.enabled||!s.history.mobilized)return error('歴史イベントを有効にし、参陣してください。');const day=B.stamp(s.date),e=B.events.find(e=>e.date>day&&e.location===p.locationId&&e.sides.some(ids=>ids.includes(p.domainId))&&s.history.causes[e.cause]&&!s.history.results[e.id]);if(!e)return error('この拠点で待てる未発生イベントはありません。');const days=(Date.parse(e.date+'T00:00:00Z')-Date.UTC(s.date.year,s.date.month-1,s.date.day))/86400000;tick(s,days*4-s.date.phase);B.trigger(s);return {ok:true,message:e.name+'の時期まで現地待機した。',slots:days*4};}
    let slots=0,message='';
    if(type==='settings') {s.settings.timer=Boolean(command.timer);s.settings.spirit=Boolean(command.spirit);return {ok:true,message:'操作設定を変更しました。'};}
    if(type==='move') {
      const cost=moveCost(s,command.to,command.method);
      if(!cost)return error('移動経路がありません。船は港同士で利用できます。');
      if(p.money<cost.money)return error('移動費用が不足しています。');
      p.money-=cost.money;p.locationId=command.to;slots=cost.slots;message=`${D.places.find(x=>x.id===command.to).name}へ移動。${slots}枠・${cost.money}両。`;
    } else if(type==='persuade') {
      const t=s.peopleById[command.target],meeting=canMeet(s,t),method=command.method,topic=command.topic||'ideology';
      if(!meeting.ok)return error(meeting.reason);
      if(!D.methods.includes(method) || !['ideology','foreignPolicy'].includes(topic))return error('説得方法または議題が不正です。');
      if(p.money<(method==='賄賂'?20:0) || p.hp<(method==='賄賂'?1:6))return error(method==='賄賂'?'賄賂には20両必要です。':'体力が足りません。宿で休んでください。');
      const spirit=s.settings.spirit && Number.isFinite(command.spirit)?command.spirit:.5,amount=effect(s,t,method,spirit);
      if(method==='賄賂')p.money-=20;else p.hp-=5;
      if(method==='脅迫')trust(s,p.id,t.id,relationship(s,p.id,t.id)-5);
      if(t[topic]===p[topic]){trust(s,p.id,t.id,relationship(s,p.id,t.id)+amount);message=`${t.name}の信頼 +${amount}（${relationship(s,p.id,t.id)}/100）。`;}
      else {t.resistance=clamp(t.resistance-amount);message=`${t.name}の抵抗 -${amount}（残り${t.resistance}）。`;if(t.resistance===0){t[topic]=p[topic];t.resistance=80;trust(s,p.id,t.id,20);message=`${t.name}が${p[topic]}へ転向。信頼20から交流を深めよう。`;}}
      if(authority(s,t.domainId)) {const d=s.domainsById[t.domainId];d.ideology=s.initialIdeology;d.foreignPolicy=t.foreignPolicy;message+=' 藩政権を獲得し、藩論を統一した。';}
      slots=1;
      const stamp=`${s.date.year}-${s.date.month}-${s.date.day}`;
      if(t.ideology!==p.ideology && stamp!==s.lastCounterDate && method!=='脅迫' && rng()<.18){s.pendingCounter=t.id;s.lastCounterDate=stamp;}
      if(method==='脅迫' && t.ideology!==p.ideology && rng()<.20){s.duel={targetId:t.id,enemyHp:70,stance:Math.floor(rng()*3),round:0};s.pendingCounter=null;message+=' 相手が刀を抜いた！';}
    } else if(type==='switch') {
      const t=s.peopleById[command.target];
      if(command.target!==s.protagonistId && !companions(s).some(q=>q.id===command.target))return error('主人公と信頼80以上・同思想の同志へ切り替えられます。');
      if(!t || !t.alive)return error('その人物は操作できません。');
      s.activePersonId=t.id;message=`${t.name}を操作します。`;slots=0;
    } else if(type==='train') {
      const definitions={sword:{cost:10,key:'sword',gain:5},learning:{cost:10,key:'learning',gain:5},military:{cost:15,key:'military',gain:5}};
      const cfg=definitions[command.skill];if(!cfg)return error('施設を選択してください。');
      if(p.money<cfg.cost || p.hp<11)return error('修行には資金と体力11以上が必要です。');
      p.money-=cfg.cost;p.hp-=10;p[cfg.key]=clamp(p[cfg.key]+cfg.gain);
      if(command.skill==='learning')p.progressiveness=clamp(p.progressiveness+3);
      slots=1;message='修行を行い、能力が成長した。';
    } else if(type==='lecture') {
      if(!D.ideologies.includes(command.ideology))return error('講義を選んでください。');
      if(!command.confirmed)return error('転向リスクを確認してから受講してください。');
      if(p.money<10)return error('受講には10両必要です。');
      p.money-=10;p.learning=clamp(p.learning+6);p.ideology=command.ideology;slots=1;message=`講義を受け、${p.ideology}の思想を選んだ。`;
    } else if(type==='rest') {if(p.money<5)return error('宿代5両が足りません。仕事で資金を得られます。');p.money-=5;p.hp=clamp(p.hp+35);slots=1;message='宿で休み、体力を回復した。';}
    else if(type==='work') {p.money=clamp(p.money+25,0,99999);p.hp=clamp(p.hp+5);slots=1;message='町の仕事を手伝い、25両を得た。';}
    else if(type==='wait') {slots=1;message='時勢を見守った。';}
    else if(type==='policy') {
      const place=D.places.find(x=>x.id===p.locationId),d=s.domainsById[place.domainId];
      if(!d || !authority(s,d.id))return error('この藩の藩主との信頼80・同思想が必要です。');
      if(!['recruit','drill','modernize'].includes(command.policy))return error('藩政を選択してください。');
      if(p.money<30)return error('藩政には30両必要です。');
      p.money-=30;d.ideology=s.initialIdeology;
      if(command.policy==='recruit')d.troops=clamp(d.troops+800,0,99999);
      if(command.policy==='drill')d.training=clamp(d.training+10);
      if(command.policy==='modernize')d.modernization=clamp(d.modernization+10);
      slots=1;message=`${d.name}で藩政を実行した。`;
    } else if(type==='campaign') {
      const d=s.domainsById[command.source],t=s.domainsById[command.target];
      if(!d || !t || d.id===t.id || !authority(s,d.id))return error('藩政権を持つ出陣元と異なる目標藩が必要です。');
      if((D.capitals[d.id]||d.id)!==p.locationId)return error('出陣元の城下へ移動してください。');
      if(d.troops<1000 || p.money<40)return error('遠征には兵1000以上・40両必要です。');
      p.money-=40;s.battle=B.create({name:t.name+'への遠征',source:d.id,target:t.id,troops:d.troops,enemyTroops:t.troops,training:d.training,modernization:d.modernization,terrain:'fort',date:B.stamp(s.date)});message=t.name+'への遠征。合戦画面で部隊を指揮してください。';
    } else if(type==='audience') {
      if(!['emperor','shogun'].includes(command.with))return error('面会先が不正です。');
      if(unified(s)!==11)return error('全11勢力の思想統一が必要です。');
      if(p.locationId!==(command.with==='emperor'?'kyoto':'edo'))return error('面会先の拠点へ移動してください。');
      s.audiences[command.with]=true;slots=1;message=command.with==='emperor'?'天皇への面会を果たした。':'将軍への面会を果たした。';
    } else if(type==='counter') {
      const t=s.peopleById[s.pendingCounter];if(!t)return error('逆説得は発生していません。');
      if(!['leave','argue'].includes(command.response))return error('反論か退席を選んでください。');
      if(command.response==='argue'){
        if((p.learning+p.charm)/2+rng()*40<t.learning+20){p.resistance=clamp(p.resistance-30);message='反論を押し切られ、思想抵抗が30低下した。';if(p.resistance===0){p.ideology=t.ideology;message+=' 思想が転向した。';}}
        else message='自らの大義を論じ、逆説得を退けた。';
      } else message='面会を切り上げ、転向を回避した。';
      s.pendingCounter=null;slots=1;
    } else if(type==='strike' || type==='flee') {
      const duel=s.duel,t=duel && s.peopleById[duel.targetId];if(!duel || !t)return error('剣戟は発生していません。');
      if(type==='flee'){p.hp=clamp(p.hp-8);s.duel=null;slots=1;message='刀を避けて離脱。体力 -8。';}
      else {
        if(!Number.isInteger(command.strike) || command.strike<0 || command.strike>2)return error('面・突・胴を選んでください。');
        const advantage=(command.strike-duel.stance+3)%3,damage=Math.round(10+p.sword*.16+p.military*.06+(advantage===1?14:advantage===2?-5:3));
        duel.enemyHp=clamp(duel.enemyHp-damage);p.hp=clamp(p.hp-Math.round(8+t.sword*.10-(advantage===1?6:0)));duel.round++;
        message=`${['面','突','胴'][command.strike]}！ 相手に${damage}の打撃。`;
        if(p.hp===0){p.alive=false;s.duel=null;slots=1;message+=' 倒れた。';}
        else if(duel.enemyHp===0){trust(s,p.id,t.id,relationship(s,p.id,t.id)+10);p.sword=clamp(p.sword+2);s.duel=null;slots=1;message+=' 剣戟に勝利。信頼+10、剣道+2。';}
        else duel.stance=Math.floor(rng()*3);
      }
    } else return error('未知の行動です。');
    log(s,message);tick(s,slots);checkEnding(s);
    // 操作していた同志が死亡・転向した場合は主人公へ戻す。
    if(s.status==='playing' && (!active(s).alive || active(s).ideology!==s.initialIdeology)){s.activePersonId=s.protagonistId;log(s,'同志が操作対象から離れたため、主人公へ戻った。');}
    B.trigger(s);return {ok:true,message,slots};
  }
  function validate(value) {
    // 記録は任意のJSONを信用せず、値域と全参照を確認してから採用する。
    if(!value || value.schemaVersion!==1 || value.mode!=='character')throw Error('志士編の対応する記録ではありません。');
    const s=copy(value);B.validate(s);const scenario=D.scenarios.find(x=>x.id===s.scenarioId);
    if(!scenario || !D.heroes.some(h=>h.id===s.protagonistId) || !['easy','normal','hard'].includes(s.difficulty) || !D.ideologies.includes(s.initialIdeology))throw Error('開始設定が不正です。');
    const fresh=create(s.scenarioId,s.protagonistId,s.difficulty),pids=Object.keys(fresh.peopleById),dids=Object.keys(fresh.domainsById);
    const numeric=(n,min,max)=>Number.isFinite(n)&&Number.isInteger(n)&&n>=min&&n<=max;
    const d=s.date;
    if(!d || !numeric(d.year,scenario.year,deadline(s)) || !numeric(d.month,1,12) || !numeric(d.day,1,new Date(Date.UTC(d.year,d.month,0)).getUTCDate()) || !numeric(d.phase,0,3) || Date.UTC(d.year,d.month-1,d.day)<Date.UTC(scenario.year,scenario.month-1,scenario.day) || (d.year===deadline(s) && (d.month!==1 || d.day!==1)))throw Error('記録の日付が不正です。');
    if(!s.peopleById || Object.keys(s.peopleById).length!==pids.length || !s.domainsById || Object.keys(s.domainsById).length!==dids.length)throw Error('人物・藩データが不足しています。');
    for(const id of pids){const p=s.peopleById[id],template=fresh.peopleById[id];if(!p || p.id!==id || p.domainId!==template.domainId || !D.places.some(x=>x.id===p.locationId) || !D.ideologies.includes(p.ideology) || !D.foreignPolicies.includes(p.foreignPolicy) || p.rank!==template.rank || typeof p.alive!=='boolean' || (p.alive && p.hp===0))throw Error('人物参照が不正です。');for(const key of ['hp','resistance','progressiveness','sword','military','learning','charm'])if(!numeric(p[key],0,100))throw Error('人物能力が不正です。');if(!numeric(p.money,0,99999))throw Error('所持金が不正です。');s.peopleById[id]={...template,...Object.fromEntries(['locationId','ideology','foreignPolicy','progressiveness','hp','money','sword','military','learning','charm','resistance','alive'].map(k=>[k,p[k]]))};}
    for(const id of dids){const v=s.domainsById[id],template=fresh.domainsById[id];if(!v || v.id!==id || v.leaderId!==template.leaderId || !D.ideologies.includes(v.ideology) || !D.foreignPolicies.includes(v.foreignPolicy) || !numeric(v.troops,0,99999) || !numeric(v.training,0,100)|| !numeric(v.modernization,0,100))throw Error('藩の参照・能力が不正です。');s.domainsById[id]={...template,...Object.fromEntries(['ideology','foreignPolicy','troops','training','modernization'].map(k=>[k,v[k]]))};}
    if(!s.relationships || Array.isArray(s.relationships) || typeof s.relationships!=='object')throw Error('信頼データが不正です。');
    for(const [key,v] of Object.entries(s.relationships)){const ids=key.split(':');if(ids.length!==2 || ids[0]===ids[1] || ids.some(id=>!pids.includes(id)) || key!==relationKey(...ids) || !numeric(v,0,100))throw Error('信頼データが不正です。');}
    if(!pids.includes(s.activePersonId) || (!s.peopleById[s.activePersonId].alive && s.status!=='lost') || (s.activePersonId!==s.protagonistId && !companions(s).some(x=>x.id===s.activePersonId)))throw Error('操作人物が不正です。');
    if(!s.settings || typeof s.settings.timer!=='boolean' || typeof s.settings.spirit!=='boolean' || !s.audiences || typeof s.audiences.emperor!=='boolean' || typeof s.audiences.shogun!=='boolean' || !s.campaigns || typeof s.campaigns.aizu!=='boolean' || typeof s.campaigns.choshu!=='boolean' || !['playing','won','lost'].includes(s.status) || !Array.isArray(s.logs) || s.logs.length>60 || s.logs.some(x=>typeof x.text!=='string'||x.text.length>1000||typeof x.date!=='string'||x.date.length>60))throw Error('進行データが不正です。');
    if(s.pendingCounter!==null && (!pids.includes(s.pendingCounter)||!canMeet(s,s.peopleById[s.pendingCounter]).ok || s.peopleById[s.pendingCounter].ideology===active(s).ideology))throw Error('逆説得の対象が不正です。');
    if(typeof s.lastCounterDate!=='string'||s.lastCounterDate.length>20)throw Error('逆説得の日付が不正です。');
    if(s.duel!==null && (!s.duel || !pids.includes(s.duel.targetId) || !canMeet(s,s.peopleById[s.duel.targetId]).ok || !numeric(s.duel.enemyHp,1,100) || !numeric(s.duel.stance,0,2) || !numeric(s.duel.round,0,100)))throw Error('戦闘データが不正です。');
    if(s.pendingCounter && s.duel)throw Error('進行状態が競合しています。');
    s.result=typeof s.result==='string'?s.result.slice(0,200):'';
    const probe=copy(s);probe.status='playing';checkEnding(probe);if(s.status!==probe.status)throw Error('勝敗状態が不正です。');
    return s;
  }
  const api={create,act,active,protagonist,relationship,companions,canMeet,authority,unified,requirements,goal,dateLabel,moveCost,effect,checkEnding,validate,route};
  root.BakumatsuCharacterEngine=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
