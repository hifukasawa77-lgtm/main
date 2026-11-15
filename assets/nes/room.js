'use strict';
(()=>{
const $=id=>document.getElementById(id),frame=$('emulatorFrame');
let rom=null,bios=null,info=null,session=0,playing=false,loading=false,paused=false,timer=0,romRead=0,biosRead=0;
const pressed=new Map();const log=s=>{$('log').textContent+=s+'\n';};
const status=s=>{$('status').textContent=s;log(s);};
let profile=NESVoxelData.preset('generic'),selectedTile=null,profileHash='',restoredHash='';
const voxel=()=>$('viewSelect').value==='voxel';
const compatible=()=>info?.format==='iNES'&&info.mapper===0&&info.prg<=32768&&info.chr===8192;
function update(){
 $('powerBtn').disabled=loading||!rom||(voxel()?!compatible():(info?.kind==='fds'&&!bios));
 $('powerBtn').firstChild.textContent=playing?(paused?'再開する ':'一時停止 '):'電源を入れる ';
 $('resetBtn').disabled=!playing;$('fullscreenBtn').disabled=!playing;$('ejectBtn').disabled=!rom&&!loading&&!playing;
 $('romInput').disabled=loading||playing;$('biosInput').disabled=loading||playing;$('coreSelect').disabled=loading||playing||voxel();$('viewSelect').disabled=loading;$('voxelPanel').hidden=!voxel();
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
 try{if(file.size>NESFormats.MAX_SIZE)throw Error('32 MB以下のファイルを選択してください。');const bytes=new Uint8Array(await file.arrayBuffer());if(token!==romRead)return;info=NESFormats.parse(bytes);rom=file;$('romName').textContent=file.name;$('log').textContent='';metadata();profileHash=restoredHash='';selectedTile=null;const id=/mario|マリオ/i.test(file.name)?'mario':/spartan|kung.?fu|スパルタン/i.test(file.name)?'spartan':'generic';$('profileSelect').value=id;profile=NESVoxelData.preset(id);syncProfile();readyStatus();}
 catch(err){if(token!==romRead)return;$('romName').textContent='NO CARTRIDGE';metadata();status(err.message);}update();
});
$('biosInput').addEventListener('change',async e=>{
 const token=++biosRead,file=e.target.files[0];bios=null;update();
 try{if(!file){$('biosStatus').textContent='disksys.rom · 8 KB';return;}if(file.size!==8192)throw Error('FDS BIOSは8,192バイトのdisksys.romを選択してください。');const bytes=new Uint8Array(await file.arrayBuffer());if(token!==biosRead)return;NESFormats.validateBios(bytes);bios=new File([bytes],'disksys.rom');$('biosStatus').textContent='BIOS 選択済み · 8 KB';status('BIOSを選択しました。');}
 catch(err){if(token!==biosRead)return;$('biosStatus').textContent='BIOS 未設定';status(err.message);}finally{if(token===biosRead)update();}
});
$('powerBtn').addEventListener('click',()=>{
 if(playing){releaseAll();paused=!paused;send('pause',{paused});status(paused?'一時停止中':'ゲームを再開しました。');update();return;}
 if(!rom||loading||(voxel()?!compatible():(info.kind==='fds'&&!bios)))return;
 session++;loading=true;paused=false;frame.src=voxel()?'assets/nes/player3d.html':'assets/nes/player.html';frame.hidden=false;$('standby').hidden=true;status('実行コアを読み込み中です。初回は少し時間がかかります。');update();
 const current=session;timer=setTimeout(()=>{if(current===session&&loading){status('読み込みに時間がかかっています。画面内の表示をご確認ください。再試行する場合は「取出し」を押してください。');}},45000);
});
addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const d=e.data;if(!d||typeof d!=='object')return;
 if(d.type==='host-ready'&&loading){send('boot',{rom,bios:info.kind==='fds'?bios:null,core:$('coreSelect').value,profile});return;}
 if(d.session!==session)return;
 if(d.type==='started'){clearTimeout(timer);loading=false;playing=true;paused=false;status(voxel()?'3Dで起動しました。ドラッグで回転。右下の2D原画からタイルを選んで調整できます。':'起動しました。画面内メニューで設定・セーブを操作できます。');
  if(info.kind==='fds'){const count=Number.isInteger(d.diskCount)&&d.diskCount>0?d.diskCount:0;$('diskPanel').hidden=false;$('diskSelect').replaceChildren();for(let i=0;i<count;i++){const o=document.createElement('option');o.value=i;o.textContent=`ディスク ${Math.floor(i/2)+1} / ${i%2?'B':'A'}面`;$('diskSelect').append(o);}$('diskSelect').disabled=!count;if(!count)log('このコアからディスク面切替情報を取得できませんでした。画面内のDisksメニューをご確認ください。');}update();}
 if(d.type==='error'){clearTimeout(timer);loading=false;playing=false;status('起動に失敗しました。'+String(d.message||'別のコア・ROMをお試しください。').slice(0,300));update();}
 if(d.type==='disk-changed')status(`ディスクを${Number(d.index)+1}面目に切り替えました。`);
 if(d.type==='profile-ready'&&voxel()){
  try{profile=NESVoxelData.validate(d.profile);profileHash=d.romHash;syncProfile();if(restoredHash!==profileHash){restoredHash=profileHash;const saved=localStorage.getItem('nes-voxel-'+profileHash);if(saved){const value=NESVoxelData.validate(JSON.parse(saved));if(value.romHash===profileHash){profile=value;syncProfile();send('profile',{profile});$('profileStatus').textContent='このROMの保存済み3D設定を読み込みました。';}}}}catch(err){$('profileStatus').textContent='設定を復元できませんでした。'+err.message;}
 }
 if(d.type==='tile-selected'&&voxel()&&['background','sprite'].includes(d.layer)&&Number.isInteger(d.tile)&&d.tile>=0&&d.tile<=511&&Number.isInteger(d.palette)&&d.palette>=0&&d.palette<=3){selectedTile={layer:d.layer,tile:d.tile,palette:d.palette};syncTile();}
 if(d.type==='profile-error')$('profileStatus').textContent=String(d.message).slice(0,240);
 if(d.type==='state-loaded')status('3Dモードのステートを読み込みました。');
 if(d.type==='exited'){stop();status('終了しました。再度電源を入れて起動できます。');}
});
$('resetBtn').addEventListener('click',()=>{releaseAll();send('reset');paused=false;update();status('ゲームをリセットしました。');});
$('ejectBtn').addEventListener('click',()=>{stop();romRead++;rom=null;info=null;$('romInput').value='';$('romName').textContent='NO CARTRIDGE';metadata();status('カセットを取り出しました。');update();});
$('coreSelect').addEventListener('change',()=>status('コアを変更しました。電源を入れて起動してください。'));
$('viewSelect').addEventListener('change',()=>{stop();selectedTile=null;syncTile();readyStatus();});
function readyStatus(){status(voxel()&&rom&&!compatible()?'このROMは現在の3Dモード対象外です。「2D — 互換性を優先」で起動してください。':!voxel()&&info?.kind==='fds'&&!bios?'FDS BIOSを選択してください。':rom?'準備完了。「電源を入れる」で起動します。':'ROMを選択すると開始できます。');}
function syncProfile(){for(const [id,value]of [['backgroundDepth',profile.background.depth],['spriteDepth',profile.sprite.depth]]){$(id).value=value;$(id+'Value').textContent=value;}$('hudRows').value=String(profile.hudRows);syncTile();}
function syncTile(){const s=selectedTile;for(const id of ['tileZ','tileDepth','applyTile','clearTile'])$(id).disabled=!s;$('selectedTile').textContent=s?`${s.layer==='sprite'?'キャラ':'背景'} · $${s.tile.toString(16).toUpperCase().padStart(3,'0')} · palette ${s.palette}`:'タイル未選択';if(s){const rule=profile.rules.find(r=>r.layer===s.layer&&r.tile===s.tile&&r.palette===s.palette)||profile[s.layer];$('tileZ').value=rule.z;$('tileZValue').textContent=rule.z;$('tileDepth').value=rule.depth;$('tileDepthValue').textContent=rule.depth;}}
function persistProfile(){profile=NESVoxelData.validate(profile);if(playing||loading)send('profile',{profile});if(profileHash){profile.romHash=profileHash;try{localStorage.setItem('nes-voxel-'+profileHash,JSON.stringify(profile));$('profileStatus').textContent='このROMの3D設定を保存しました。';}catch(_){$('profileStatus').textContent='ブラウザーに保存できません。設定を書き出してください。';}}else $('profileStatus').textContent='設定を変更しました。起動後にROMと関連付けて保存できます。';}
$('profileSelect').addEventListener('change',()=>{profile={...NESVoxelData.preset($('profileSelect').value),romHash:profileHash};syncProfile();persistProfile();});
for(const [id,kind]of [['backgroundDepth','background'],['spriteDepth','sprite']])$(id).addEventListener('input',()=>{profile[kind].depth=Number($(id).value);$(id+'Value').textContent=$(id).value;persistProfile();});
$('hudRows').addEventListener('change',()=>{profile.hudRows=Number($('hudRows').value);persistProfile();});
for(const id of ['tileZ','tileDepth'])$(id).addEventListener('input',()=>$(id+'Value').textContent=$(id).value);
function removeRule(){if(selectedTile)profile.rules=profile.rules.filter(r=>!(r.layer===selectedTile.layer&&r.tile===selectedTile.tile&&r.palette===selectedTile.palette));}
$('applyTile').addEventListener('click',()=>{if(!selectedTile)return;removeRule();profile.rules.push({...selectedTile,z:Number($('tileZ').value),depth:Number($('tileDepth').value)});persistProfile();});
$('clearTile').addEventListener('click',()=>{removeRule();persistProfile();syncTile();});
$('exportProfile').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nes-3d-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
$('profileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>256*1024)throw Error('設定ファイルは256 KB以下にしてください。');const value=NESVoxelData.validate(JSON.parse(await file.text()));if(value.romHash&&profileHash&&value.romHash!==profileHash)throw Error('別のROM用の設定です。同じ版のROMを選択してください。');profile=value;syncProfile();persistProfile();}catch(err){$('profileStatus').textContent='設定読込失敗：'+err.message;}e.target.value='';});
$('diskSelect').addEventListener('change',()=>send('disk',{index:Number($('diskSelect').value)}));
$('fullscreenBtn').addEventListener('click',async()=>{try{await frame.requestFullscreen();}catch(_){status('このブラウザでは全画面表示を開始できませんでした。');}});
function press(key,button){if(!playing||paused||pressed.has(key))return;pressed.set(key,button);send('input',{button,value:1});}
function release(key){if(!pressed.has(key))return;const button=pressed.get(key);pressed.delete(key);if(![...pressed.values()].includes(button))send('input',{button,value:0});}
for(const b of document.querySelectorAll('[data-button]')){const button=Number(b.dataset.button);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);press(`pointer-${e.pointerId}`,button);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>release(`pointer-${e.pointerId}`));b.addEventListener('click',e=>{if(e.detail===0){press('accessible-'+button,button);setTimeout(()=>release('accessible-'+button),120);}});}
const mapping={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,z:0,x:8,Enter:3,Shift:2};
addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;const button=mapping[e.key]??mapping[e.key.toLowerCase()];if(button===undefined||!playing||paused)return;e.preventDefault();press('key-'+e.code,button);});
addEventListener('keyup',e=>release('key-'+e.code));addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});syncProfile();update();
})();
