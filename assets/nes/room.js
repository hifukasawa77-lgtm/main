'use strict';
(()=>{
const $=id=>document.getElementById(id),frame=$('emulatorFrame');
let rom=null,bios=null,info=null,session=0,playing=false,loading=false,paused=false,timer=0,romRead=0,biosRead=0;
const pressed=new Map();const log=s=>{$('log').textContent+=s+'\n';};
const status=s=>{$('status').textContent=s;log(s);};
function update(){
 $('powerBtn').disabled=loading||!rom||(info?.kind==='fds'&&!bios);
 $('powerBtn').firstChild.textContent=playing?(paused?'再開する ':'一時停止 '):'電源を入れる ';
 $('resetBtn').disabled=!playing;$('fullscreenBtn').disabled=!playing;$('ejectBtn').disabled=!rom&&!loading&&!playing;
 $('romInput').disabled=loading||playing;$('biosInput').disabled=loading||playing;$('coreSelect').disabled=loading||playing;
 $('powerLamp').textContent=playing?'● POWER ON':loading?'● LOADING':'● STANDBY';
 document.querySelectorAll('[data-button]').forEach(b=>b.disabled=!playing||paused);
}
function send(type,data={}){frame.contentWindow?.postMessage({type,session,...data},location.origin);}
function releaseAll(){for(const button of pressed.values())send('input',{button,value:0});pressed.clear();}
function stop(){releaseAll();session++;clearTimeout(timer);frame.removeAttribute('src');frame.hidden=true;$('standby').hidden=false;playing=loading=paused=false;$('diskPanel').hidden=true;update();}
function metadata(){const entries={'ファイル':rom?.name||'未読込','形式':info?.format||'—','容量':rom?`${rom.size.toLocaleString()} bytes`:'—','映像方式':info?.region||'—'};
 if(info?.kind==='nes'){entries['マッパー']=String(info.mapper);if(info.submapper)entries['サブマッパー']=String(info.submapper);entries['PRG / CHR']=`${info.prg/1024} / ${info.chr/1024} KB`;}
 if(info?.kind==='fds')entries['ディスク面数']=String(info.sides);
 $('metadata').replaceChildren();for(const [k,v]of Object.entries(entries)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;$('metadata').append(dt,dd);}}
$('romInput').addEventListener('change',async e=>{
 const token=++romRead,file=e.target.files[0];rom=null;info=null;update();if(!file){metadata();return;}
 try{if(file.size>NESFormats.MAX_SIZE)throw Error('32 MB以下のファイルを選択してください。');const bytes=new Uint8Array(await file.arrayBuffer());if(token!==romRead)return;info=NESFormats.parse(bytes);rom=file;$('romName').textContent=file.name;$('log').textContent='';metadata();status(info.kind==='fds'&&!bios?'FDS BIOSを選択してください。':'準備完了。「電源を入れる」で起動します。');}
 catch(err){if(token!==romRead)return;$('romName').textContent='NO CARTRIDGE';metadata();status(err.message);}update();
});
$('biosInput').addEventListener('change',async e=>{
 const token=++biosRead,file=e.target.files[0];bios=null;update();
 try{if(!file){$('biosStatus').textContent='disksys.rom · 8 KB';return;}if(file.size!==8192)throw Error('FDS BIOSは8,192バイトのdisksys.romを選択してください。');const bytes=new Uint8Array(await file.arrayBuffer());if(token!==biosRead)return;NESFormats.validateBios(bytes);bios=new File([bytes],'disksys.rom');$('biosStatus').textContent='BIOS 選択済み · 8 KB';status('BIOSを選択しました。');}
 catch(err){if(token!==biosRead)return;$('biosStatus').textContent='BIOS 未設定';status(err.message);}finally{if(token===biosRead)update();}
});
$('powerBtn').addEventListener('click',()=>{
 if(playing){releaseAll();paused=!paused;send('pause',{paused});status(paused?'一時停止中':'ゲームを再開しました。');update();return;}
 if(!rom||loading||(info.kind==='fds'&&!bios))return;
 session++;loading=true;paused=false;frame.src='assets/nes/player.html';frame.hidden=false;$('standby').hidden=true;status('実行コアを読み込み中です。初回は少し時間がかかります。');update();
 const current=session;timer=setTimeout(()=>{if(current===session&&loading){status('読み込みに時間がかかっています。画面内の表示をご確認ください。再試行する場合は「取出し」を押してください。');}},45000);
});
addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const d=e.data;if(!d||typeof d!=='object')return;
 if(d.type==='host-ready'&&loading){send('boot',{rom,bios:info.kind==='fds'?bios:null,core:$('coreSelect').value});return;}
 if(d.session!==session)return;
 if(d.type==='started'){clearTimeout(timer);loading=false;playing=true;paused=false;status('起動しました。画面内メニューで設定・セーブを操作できます。');
  if(info.kind==='fds'){const count=Number.isInteger(d.diskCount)&&d.diskCount>0?d.diskCount:0;$('diskPanel').hidden=false;$('diskSelect').replaceChildren();for(let i=0;i<count;i++){const o=document.createElement('option');o.value=i;o.textContent=`ディスク ${Math.floor(i/2)+1} / ${i%2?'B':'A'}面`;$('diskSelect').append(o);}$('diskSelect').disabled=!count;if(!count)log('このコアからディスク面切替情報を取得できませんでした。画面内のDisksメニューをご確認ください。');}update();}
 if(d.type==='error'){clearTimeout(timer);loading=false;playing=false;status('起動に失敗しました。'+String(d.message||'別のコア・ROMをお試しください。').slice(0,300));update();}
 if(d.type==='disk-changed')status(`ディスクを${Number(d.index)+1}面目に切り替えました。`);
 if(d.type==='exited'){stop();status('終了しました。再度電源を入れて起動できます。');}
});
$('resetBtn').addEventListener('click',()=>{releaseAll();send('reset');paused=false;update();status('ゲームをリセットしました。');});
$('ejectBtn').addEventListener('click',()=>{stop();romRead++;rom=null;info=null;$('romInput').value='';$('romName').textContent='NO CARTRIDGE';metadata();status('カセットを取り出しました。');update();});
$('coreSelect').addEventListener('change',()=>status('コアを変更しました。電源を入れて起動してください。'));
$('diskSelect').addEventListener('change',()=>send('disk',{index:Number($('diskSelect').value)}));
$('fullscreenBtn').addEventListener('click',async()=>{try{await frame.requestFullscreen();}catch(_){status('このブラウザでは全画面表示を開始できませんでした。');}});
function press(key,button){if(!playing||paused||pressed.has(key))return;pressed.set(key,button);send('input',{button,value:1});}
function release(key){if(!pressed.has(key))return;send('input',{button:pressed.get(key),value:0});pressed.delete(key);}
for(const b of document.querySelectorAll('[data-button]')){const button=Number(b.dataset.button);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);press(`pointer-${e.pointerId}`,button);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>release(`pointer-${e.pointerId}`));b.addEventListener('click',e=>{if(e.detail===0){press('accessible-'+button,button);setTimeout(()=>release('accessible-'+button),120);}});}
const mapping={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,z:0,x:8,Enter:3,Shift:2};
addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;const button=mapping[e.key]??mapping[e.key.toLowerCase()];if(button===undefined||!playing||paused)return;e.preventDefault();press('key-'+e.code,button);});
addEventListener('keyup',e=>release('key-'+e.code));addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});update();
})();
