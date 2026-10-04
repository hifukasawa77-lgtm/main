'use strict';
(()=>{
const $=s=>document.querySelector(s),key='vocalis-character-v1';let profile={name:'Hikari',voice:'female',appearance:'ラベンダー色の髪、青い瞳、白とブルーの衣装。優しく明るい雰囲気。',style:'アニメ'},image='',candidate='',busy=false,controller;
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('vocalis-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function imageStore(value){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction('images',value===undefined?'readonly':'readwrite'),store=tx.objectStore('images'),r=value===undefined?store.get('active-avatar'):store.put(value,'active-avatar');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result||'');tx.onerror=()=>reject(tx.error);});}finally{d.close();}}
function draw(){const card=$('.voice');card.classList.add('character-card');card.querySelector('b').textContent=profile.name;card.querySelector('small').textContent=profile.voice==='male'?'男性 · 簡易合成歌声':'女性 · 簡易合成歌声';const art=card.querySelector('.voice-art');art.replaceChildren();if(image){const img=document.createElement('img');img.src=image;img.alt=profile.name+'の顔';art.append(img);}else art.textContent=profile.name.slice(0,1);$('.track-name b').textContent=profile.name+' Vocal';document.querySelectorAll('.voice')[1]?.classList.add('inactive-concept');}
async function save(){localStorage.setItem(key,JSON.stringify(profile));await imageStore(image);draw();window.dispatchEvent(new CustomEvent('vocal-character-change',{detail:{...profile}}));}
const dialog=document.createElement('dialog');dialog.className='song-dialog character-dialog';dialog.innerHTML=`<div class="song-heading"><div><span>YOUR VIRTUAL SINGER</span><h2>名前と顔で、あなたの歌い手に。</h2></div><button id="char-close" aria-label="閉じる">×</button></div><div class="character-layout"><div class="character-portrait" id="char-portrait"><span>顔グラフィック</span></div><form id="char-form"><label>ボーカロイドの名前<input id="char-name" maxlength="40" required></label><label>声のタイプ<select id="char-voice"><option value="female">女性</option><option value="male">男性</option></select></label><label>顔・髪・衣装・雰囲気<textarea id="char-appearance" rows="4" maxlength="1000" placeholder="例：銀色のショートヘア、緑の瞳、近未来の衣装"></textarea></label><label>グラフィックの画風<select id="char-style"><option>アニメ</option><option>3D</option><option>イラスト</option></select></label><div class="song-actions"><button type="button" id="char-generate">✦ AIで顔を生成</button><button type="submit" id="char-save">プロフィールを保存</button></div></form></div><p id="char-status" role="status" aria-live="polite">名前と声はすぐ保存できます。顔の生成にはAI接続が必要です。</p><p class="song-caption">画像生成では名前・声・見た目の説明をCloudflare Workers AIへ送信します。OpenAI APIキーはブラウザーに置かれません。外見の生成は歌声モデルの学習とは別の機能です。</p><div class="song-actions"><button id="char-cancel" hidden>生成を中止</button><button id="char-image-save">顔画像を書き出し</button><button id="char-export">キャラクター保存</button><button id="char-import">キャラクターを開く</button></div><input id="char-file" type="file" accept=".json" hidden>`;document.body.append(dialog);const status=$('#char-status');
function preview(value){const box=$('#char-portrait');box.replaceChildren();if(value){const img=document.createElement('img');img.src=value;img.alt='生成した顔のプレビュー';box.append(img);}else{const s=document.createElement('span');s.textContent=profile.name.slice(0,1);box.append(s);}}

const library=document.createElement('section');library.className='portrait-library';
const libraryTitle=document.createElement('h3');libraryTitle.textContent='顔ライブラリ / Face library';
const libraryHint=document.createElement('p');libraryHint.textContent='男性10体・女性10体から選択できます。選んだ顔・名前・声は「プロフィールを保存」で反映されます。 / Choose a face, then save your profile.';
library.append(libraryTitle,libraryHint);
for(const voice of ['female','male']){
 const heading=document.createElement('h4');heading.textContent=voice==='male'?'男性 / Male · 10':'女性 / Female · 10';library.append(heading);
 const grid=document.createElement('div');grid.className='portrait-grid';library.append(grid);
 for(const portrait of window.VocalPortraits.filter(p=>p.voice===voice)){
  const choice=document.createElement('button');choice.type='button';choice.className='portrait-choice';choice.dataset.portrait=portrait.id;choice.setAttribute('aria-pressed','false');choice.setAttribute('aria-label',portrait.name+' · '+(voice==='male'?'男性 / Male':'女性 / Female'));
  const img=document.createElement('img');img.src=portrait.src;img.alt=portrait.name;img.loading='lazy';img.width=320;img.height=320;
  const label=document.createElement('span');label.textContent=portrait.name;choice.append(img,label);grid.append(choice);
  choice.onclick=async()=>{
   if(busy)return;busy=true;setLibraryDisabled(true);$('#char-save').disabled=true;$('#char-generate').disabled=true;status.textContent='顔を読み込み中 / Loading portrait…';
   try{
    const value=await portraitData(portrait);candidate=value;
    $('#char-name').value=portrait.name;$('#char-voice').value=portrait.voice;$('#char-style').value='アニメ';$('#char-appearance').value=portrait.name+'：顔ライブラリのオリジナル歌い手 / Original virtual singer';
    preview(value);library.querySelectorAll('.portrait-choice').forEach(b=>b.setAttribute('aria-pressed',String(b===choice)));
    status.textContent=portrait.name+'を選択しました。「プロフィールを保存」で反映してください。 / Save your profile to apply.';
   }catch(e){status.textContent='顔を読み込めませんでした / Could not load portrait: '+e.message;}
   finally{busy=false;setLibraryDisabled(false);$('#char-save').disabled=false;$('#char-generate').disabled=false;}
  };
 }
}
dialog.insertBefore(library,status);
function setLibraryDisabled(disabled){library.querySelectorAll('button').forEach(b=>b.disabled=disabled);}
async function portraitData(portrait){
 const img=new Image();img.src=portrait.src;await img.decode();
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
 canvas.getContext('2d').drawImage(img,0,0);
 const value=canvas.toDataURL('image/png');if(!CharacterCore.imageSafe(value))throw Error('画像形式が不正です。');return value;
}

function fields(){return CharacterCore.validate({name:$('#char-name').value,voice:$('#char-voice').value,appearance:$('#char-appearance').value,style:$('#char-style').value});}
function open(){candidate='';library.querySelectorAll('.portrait-choice').forEach(b=>b.setAttribute('aria-pressed','false'));$('#char-name').value=profile.name;$('#char-voice').value=profile.voice;$('#char-appearance').value=profile.appearance;$('#char-style').value=profile.style;preview(image);status.textContent='名前・声・見た目を設定して保存してください。';dialog.showModal();}
const button=document.createElement('button');button.className='pill';button.textContent='名前・顔を設定';button.onclick=open;$('.toolbar').insertBefore(button,$('#ai'));$('.voice').onclick=open;$('.voice').tabIndex=0;$('.voice').onkeydown=e=>{if(e.key==='Enter')open();};$('#char-close').onclick=()=>dialog.close();dialog.addEventListener('cancel',()=>controller?.abort());$('#char-cancel').onclick=()=>controller?.abort();
$('#char-form').onsubmit=async e=>{e.preventDefault();try{profile=fields();if(candidate)image=candidate;await save();status.textContent='名前・声・顔を保存しました。';candidate='';}catch(e){draw();status.textContent='保存に失敗しました。キャラクター保存でバックアップしてください：'+e.message;}};
$('#char-generate').onclick=async()=>{if(busy)return;let request;try{request=fields();if(!request.appearance)throw Error('見た目の説明を入力してください。');}catch(e){status.textContent=e.message;return;}if(location.protocol==='file:'){status.textContent='公開されたHTTPSページから開いてください。';return;}busy=true;setLibraryDisabled(true);candidate='';controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),250000);['char-generate','char-save','char-close','char-import'].forEach(id=>$('#'+id).disabled=true);$('#char-cancel').hidden=false;status.textContent='AIが顔グラフィックを生成中…数分かかる場合があります。';try{const data=await window.VocalisUsage.generate('/vocal/portrait',{profile:request},controller.signal);if(!CharacterCore.imageSafe(data.image))throw Error('生成された画像を読み込めませんでした。');candidate=data.image;preview(candidate);status.textContent='顔を生成しました。「プロフィールを保存」でこの顔を採用できます。';}catch(e){status.textContent=e.name==='AbortError'?'生成を中止しました。':e.message;}finally{clearTimeout(timeout);controller=null;window.VocalisUsage?.refresh();busy=false;setLibraryDisabled(false);['char-generate','char-save','char-close','char-import'].forEach(id=>$('#'+id).disabled=false);$('#char-cancel').hidden=true;}};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#char-image-save').onclick=async()=>{const value=candidate||image;if(!value){status.textContent='まず顔グラフィックを生成してください。';return;}download(await(await fetch(value)).blob(),'vocalis-character.'+(value.startsWith('data:image/jpeg')?'jpg':'png'));};
$('#char-export').onclick=()=>{try{download(new Blob([JSON.stringify({version:1,profile:fields(),image:candidate||image})],{type:'application/json'}),'vocalis-character.json');}catch(e){status.textContent=e.message;}};
$('#char-import').onclick=()=>$('#char-file').click();$('#char-file').onchange=async()=>{try{const file=$('#char-file').files[0];if(!file||file.size>13000000)throw Error('対応するキャラクターJSONを選んでください。');const p=JSON.parse(await file.text());const valid=CharacterCore.validate(p.profile);if(p.image&&!CharacterCore.imageSafe(p.image))throw Error('画像形式が不正です。');profile=valid;image=p.image||'';candidate='';await save();$('#char-name').value=profile.name;$('#char-voice').value=profile.voice;$('#char-appearance').value=profile.appearance;$('#char-style').value=profile.style;preview(image);status.textContent='キャラクターを読み込みました。';}catch(e){status.textContent=e.message;}$('#char-file').value='';};
window.VocalCharacter={getProfile:()=>({...profile}),setVoice:voice=>{profile.voice=voice;try{localStorage.setItem(key,JSON.stringify(profile));}catch{}draw();}};
(async()=>{try{const raw=localStorage.getItem(key);if(raw)profile=CharacterCore.validate(JSON.parse(raw));image=await imageStore();if(image&&!CharacterCore.imageSafe(image))image='';if(!image){const preset=window.VocalPortraits.find(p=>p.voice===profile.voice);image=await portraitData(preset);}}catch{}draw();window.dispatchEvent(new CustomEvent('vocal-character-ready',{detail:{...profile}}));})();
})();
