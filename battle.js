const BATTLES = {
  field: {
    title:'野戦', date:'慶応4年 5月18日', place:'越後・榎峠', weather:'晴 / 視界: 良好', image:'assets/battles/field-battle.webp', objective:'榎峠の高地を確保せよ',
    friendly:{ name:'長岡藩軍', commander:'河井 継之助', image:'assets/portraits/kido-takayoshi.webp', stats:[['兵力','3,200'],['士気','76'],['弾薬','68'],['機動','73']], units:['伝習隊 900','長岡藩兵 1,400','砲兵隊 4門','奇兵隊 900'] },
    enemy:{ name:'新政府軍', commander:'山県 有朋', image:'assets/portraits/saigo-takamori.webp', stats:[['兵力','4,800'],['士気','71'],['練度','65'],['砲兵','6門']], units:['薩摩兵 1,500','長州兵 1,800','土佐兵 900','砲兵隊 6門'] },
    terrain:['高地','街道','水田'], units:[['友軍 伝習隊',24,70,'friendly'],['友軍 砲兵',39,55,'friendly'],['友軍 藩兵',51,76,'friendly'],['敵 前衛',57,37,'enemy'],['敵 砲兵',75,43,'enemy'],['敵 主力',80,66,'enemy']], orders:['前進','斉射','砲撃','側面機動','撤退']
  },
  siege: {
    title:'攻城戦', date:'慶応4年 9月22日', place:'会津・若松城', weather:'曇 / 煙: 濃い', image:'assets/battles/siege-battle.webp', objective:'北出丸を制圧し、城門を破壊せよ',
    friendly:{ name:'新政府軍', commander:'大村 益次郎', image:'assets/portraits/oomura-masujiro.webp', stats:[['兵力','8,900'],['士気','83'],['砲弾','74'],['工兵','2隊']], units:['薩摩兵 2,100','長州兵 2,300','砲兵隊 12門','工兵隊 2隊'] },
    enemy:{ name:'会津藩', commander:'松平 容保', image:'assets/portraits/matsudaira-katamori.webp', stats:[['兵力','4,600'],['士気','80'],['城壁','64'],['砲兵','8門']], units:['会津藩兵 2,100','朱雀隊 800','砲兵隊 8門','城内守備 1,700'] },
    terrain:['北出丸','二の丸','大手門'], units:[['友軍 砲兵',22,75,'friendly'],['友軍 工兵',39,64,'friendly'],['友軍 主力',51,78,'friendly'],['敵 城門守備',53,38,'enemy'],['敵 二の丸',67,32,'enemy'],['敵 本丸',77,21,'enemy']], orders:['総攻撃','砲撃','工兵前進','攪乱','撤退']
  },
  naval: {
    title:'海戦', date:'明治2年 5月11日', place:'箱館湾沖', weather:'北西風 / 風力: 3', image:'assets/battles/naval-battle.webp', objective:'敵旗艦を航行不能にせよ',
    friendly:{ name:'蝦夷艦隊', commander:'榎本 武揚', image:'assets/portraits/enomoto-takeaki.webp', stats:[['艦船','6隻'],['兵力','2,350'],['士気','85'],['石炭','62']], units:['開陽（蒸気）','回天（蒸気）','蟠龍（蒸気）','千歳（帆船）'] },
    enemy:{ name:'新政府艦隊', commander:'木戸 孝允', image:'assets/portraits/saigo-takamori.webp', stats:[['艦船','5隻'],['兵力','2,100'],['士気','76'],['砲弾','69']], units:['甲鉄（装甲艦）','春日（蒸気）','乾行（蒸気）','陽春（帆船）'] },
    terrain:['風向 北西','浅瀬','砲台射程'], units:[['回天',28,64,'friendly'],['開陽',43,77,'friendly'],['蟠龍',54,49,'friendly'],['甲鉄',74,35,'enemy'],['春日',69,61,'enemy'],['陽春',83,70,'enemy']], orders:['砲撃','集中砲火','接舷','回頭','離脱']
  }
};
const battleState = { mode:'field', progress:18, log:'伝令：敵前衛が街道を前進中。命令を選択してください。' };
const $b = s => document.querySelector(s);
function panel(side) { const army=BATTLES[battleState.mode][side]; return `<p class="side-label">${side==='friendly'?'味方軍':'敵軍'}</p><h2>${army.name}</h2><div class="commander"><img src="${army.image}" alt="${army.commander}"><div><span>総大将</span><strong>${army.commander}</strong></div></div><div class="stats">${army.stats.map(s=>`<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join('')}</div><h3>部隊一覧</h3><ul>${army.units.map(u=>`<li>${u}</li>`).join('')}</ul>`; }
function renderBattle() {
 const b=BATTLES[battleState.mode];
 $b('#battle-title').textContent=b.title; $b('#battle-date').textContent=b.date; $b('#battle-place').textContent=b.place; $b('#weather').textContent=b.weather;
 $b('#friendly-panel').innerHTML=panel('friendly'); $b('#enemy-panel').innerHTML=panel('enemy');
 const field=$b('#battlefield'); field.style.backgroundImage=`url('${b.image}')`;
 $b('#terrain-markers').innerHTML=b.terrain.map((t,i)=>`<span class="terrain terrain-${i}">${t}</span>`).join('');
 $b('#unit-layer').innerHTML=b.units.map(u=>`<button class="unit ${u[3]}" style="left:${u[1]}%;top:${u[2]}%"><i></i>${u[0]}</button>`).join('');
 $b('#objective-text').textContent=b.objective; $b('#objective-bar').style.width=`${battleState.progress}%`; $b('#action-log').textContent=battleState.log;
 $b('#orders').innerHTML=b.orders.map((o,i)=>`<button data-order="${o}" class="${i===0?'primary':''}"><b>${o}</b><small>${orderHint(o)}</small></button>`).join('');
 document.querySelectorAll('[data-order]').forEach(x=>x.onclick=()=>command(x.dataset.order));
 document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===battleState.mode));
}
function orderHint(order){return ({'前進':'地形を越えて前へ','斉射':'敵前衛へ一斉射撃','砲撃':'砲兵の火力を集中','側面機動':'敵の横へ回り込む','撤退':'被害を抑え戦線離脱','総攻撃':'一気に城門へ迫る','工兵前進':'城壁・門を工作','攪乱':'城内の士気を下げる','集中砲火':'敵旗艦を狙う','接舷':'白兵戦を仕掛ける','回頭':'風向を利用して反転','離脱':'艦隊を安全圏へ'}[order]||'命令を実行');}
function command(order){ const gain=order==='撤退'||order==='離脱'?-4:Math.floor(Math.random()*8)+5; battleState.progress=Math.max(0,Math.min(100,battleState.progress+gain)); battleState.log=`${order}を下令。${gain>0?'戦役目標への進展: +'+gain+'%':'戦線を整え、被害を抑えた。'}`; renderBattle(); }
document.querySelectorAll('[data-mode]').forEach(x=>x.onclick=()=>{battleState.mode=x.dataset.mode;battleState.progress=18;battleState.log=`${BATTLES[battleState.mode].title}を開始。戦場の状況を確認してください。`;renderBattle();});
renderBattle();
