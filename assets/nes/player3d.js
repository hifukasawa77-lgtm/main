'use strict';
(()=>{
const $=id=>document.getElementById(id),origin=location.origin;
let booted=false,active=false,paused=false,session=0,nes,capture,renderer,profile,table,romHash='',romBytes,animation=0,lastTime=0,accumulator=0,frameNumber=0,lastBuffer=null,mesh=null;
const notify=(type,extra={})=>parent.postMessage({type,session,...extra},origin);
const source=$('source'),sourceContext=source.getContext('2d'),hud=$('hud'),hudContext=hud.getContext('2d');
const pixels=sourceContext.createImageData(256,240),pixel32=new Uint32Array(pixels.data.buffer),geometryBuffer=new Float32Array(256*240*2*9);
let audio=null,audioNode=null,audioRead=0,audioWrite=0,sound=false;const audioL=new Float32Array(16384),audioR=new Float32Array(16384);
const held={bridge:new Set(),key:new Set(),pad:new Set()},pressed=new Set(),mapping={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,z:0,x:8,Enter:3,Shift:2},buttons={0:1,2:2,3:3,4:4,5:5,6:6,7:7,8:0};
function input(button,value,source='bridge'){if(!nes||!active)return;const group=held[source];if(value&&!paused)group.add(button);else group.delete(button);const down=Object.values(held).some(set=>set.has(button));if(down&&!pressed.has(button)){pressed.add(button);nes.buttonDown(1,buttons[button]);}else if(!down&&pressed.has(button)){pressed.delete(button);nes.buttonUp(1,buttons[button]);}}
function release(){for(const set of Object.values(held))set.clear();for(const button of pressed)nes?.buttonUp(1,buttons[button]);pressed.clear();gamepadPressed.clear();}
function fail(err){release();active=false;cancelAnimationFrame(animation);$('notice').textContent=String(err.message||err);notify('error',{message:String(err.message||err)});}
function draw(){
 if(!capture||!renderer||!profile||!lastBuffer)return;
 mesh=NESVoxelData.geometry(capture,profile,table,geometryBuffer);renderer.draw(mesh,nes.ppu.imgPalette[0]);
 hudContext.clearRect(0,0,256,240);if(profile.hudRows)hudContext.drawImage(source,0,0,256,profile.hudRows,0,0,256,profile.hudRows);
 $('notice').textContent=`${profile.name} · ${mesh.count.toLocaleString()} prisms · ドラッグで回転 / ホイールで拡大`;
}
function onFrame(buffer){lastBuffer=buffer;for(let i=0;i<buffer.length;i++)pixel32[i]=0xff000000|buffer[i];sourceContext.putImageData(pixels,0,0);if((frameNumber++&1)===0)draw();}
function applyProfile(value){profile=NESVoxelData.validate(value);if(profile.romHash&&profile.romHash!==romHash)throw Error('このプロファイルは別のROM用です。同じ版のROMを使用してください。');profile.romHash=romHash;table=NESVoxelData.compile(profile);draw();notify('profile-ready',{profile,romHash});}
function createCore(state){
 release();capture?.dispose();
 nes=new jsnes.NES({emulateSound:true,sampleRate:48000,onFrame,onAudioSample:(l,r)=>{if(!sound||paused)return;const next=(audioWrite+1)&16383;if(next===audioRead)audioRead=(audioRead+1)&16383;audioL[audioWrite]=l;audioR[audioWrite]=r;audioWrite=next;},onBatteryRamWrite:()=>{}});
 nes.loadROM(romBytes);if(state)nes.fromJSON(state);nes.ppu.clipToTvSize=false;capture=new NESVoxelData.Capture(nes);lastBuffer=null;audioRead=audioWrite=0;
}
function loop(time){
 if(!active)return;
 animation=requestAnimationFrame(loop);
 if(paused||document.hidden){lastTime=time;accumulator=0;return;}
 accumulator+=Math.min(time-lastTime,67);lastTime=time;
 try{let steps=0;while(accumulator>=1000/60&&steps++<4){pollGamepad();nes.frame();accumulator-=1000/60;}}catch(err){fail(err);}
}
const gamepadPressed=new Set();
function pollGamepad(){const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.mapping==='standard');const down=new Set();if(pad){const keys={0:8,1:0,8:2,9:3,12:4,13:5,14:6,15:7};for(const [index,button]of Object.entries(keys))if(pad.buttons[index]?.pressed)down.add(button);if(pad.axes[0]<-0.5)down.add(6);if(pad.axes[0]>0.5)down.add(7);if(pad.axes[1]<-0.5)down.add(4);if(pad.axes[1]>0.5)down.add(5);}for(const b of gamepadPressed)if(!down.has(b))input(b,0,'pad');for(const b of down)if(!gamepadPressed.has(b))input(b,1,'pad');gamepadPressed.clear();for(const b of down)gamepadPressed.add(b);}
addEventListener('message',async e=>{
 if(e.origin!==origin||e.source!==parent)return;const d=e.data;if(!d||typeof d!=='object')return;
 if(d.type==='boot'&&!booted){
  if(!(d.rom instanceof File)||!Number.isInteger(d.session))return;session=d.session;booted=true;
  try{
   if(!window.jsnes)throw Error('3D用NESコアを取得できませんでした。インターネット接続を確認してください。');
   if(d.rom.size>NESFormats.MAX_SIZE)throw Error('ROMの容量が大きすぎます。');
   romBytes=new Uint8Array(await d.rom.arrayBuffer());const info=NESFormats.parse(romBytes);
   if(info.format!=='iNES'||info.mapper!==0||info.prg>32768||info.chr!==8192)throw Error('3Dモードは現在iNES形式のNROM（mapper 0・CHR ROM 8 KB）専用です。このROMは2Dモードで起動してください。');
   romHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',romBytes)),x=>x.toString(16).padStart(2,'0')).join('');
   renderer=new NESVoxelRenderer($('scene'));renderer.onChange=()=>{if(paused)draw();};createCore();applyProfile(d.profile||NESVoxelData.preset('generic'));
   active=true;lastTime=performance.now();animation=requestAnimationFrame(loop);notify('started',{diskCount:0,mode:'voxel'});
  }catch(err){fail(err);}return;
 }
 if(d.session!==session||!active)return;
 try{
  if(d.type==='input'&&Object.hasOwn(buttons,d.button)&&[0,1].includes(d.value))input(d.button,d.value);
  if(d.type==='pause'){release();paused=!!d.paused;audioRead=audioWrite=0;draw();}
  if(d.type==='reset'){createCore();paused=false;}
  if(d.type==='profile')applyProfile(d.profile);
  if(d.type==='camera'){if(Number.isFinite(d.yaw))renderer.yaw=Math.max(-65,Math.min(65,d.yaw));if(Number.isFinite(d.pitch))renderer.pitch=Math.max(-50,Math.min(50,d.pitch));draw();}
 }catch(err){notify('profile-error',{message:err.message});}
});
addEventListener('keydown',e=>{if(['INPUT','BUTTON'].includes(e.target.tagName))return;const b=mapping[e.key]??mapping[e.key.toLowerCase()];if(b===undefined||!active||paused)return;e.preventDefault();input(b,1,'key');});
addEventListener('keyup',e=>{const b=mapping[e.key]??mapping[e.key.toLowerCase()];if(b!==undefined)input(b,0,'key');});
addEventListener('blur',release);document.addEventListener('visibilitychange',release);
source.addEventListener('click',e=>{if(!capture)return;const bounds=source.getBoundingClientRect();const pick=capture.pick(Math.floor((e.clientX-bounds.left)*256/bounds.width),Math.floor((e.clientY-bounds.top)*240/bounds.height));if(pick)notify('tile-selected',pick);});
$('frontBtn').addEventListener('click',()=>{if(renderer){renderer.yaw=renderer.pitch=0;renderer.zoom=1;draw();}});
$('orbitBtn').addEventListener('click',()=>{if(renderer){renderer.yaw=-25;renderer.pitch=15;renderer.zoom=1;draw();}});
$('soundBtn').addEventListener('click',async()=>{try{if(!audio){audio=new AudioContext({sampleRate:48000});audioNode=audio.createScriptProcessor(2048,0,2);audioNode.onaudioprocess=e=>{const l=e.outputBuffer.getChannelData(0),r=e.outputBuffer.getChannelData(1);for(let i=0;i<l.length;i++){if(!sound||!active||paused||audioRead===audioWrite){l[i]=r[i]=0;continue;}l[i]=audioL[audioRead];r[i]=audioR[audioRead];audioRead=(audioRead+1)&16383;}};audioNode.connect(audio.destination);}await audio.resume();sound=!sound;audioRead=audioWrite=0;$('soundBtn').textContent=sound?'音声OFF':'音声ON';}catch(err){$('notice').textContent='音声を開始できませんでした。'+err.message;}});
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('saveBtn').addEventListener('click',()=>{if(active)download({version:1,romHash,state:nes.toJSON()},'nes-3d-state.json');});
$('stateInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file||!active)return;release();try{if(file.size>8*1024*1024)throw Error('ステートは8 MB以下にしてください。');const data=JSON.parse(await file.text());if(data.version!==1||data.romHash!==romHash||!data.state?.cpu||!data.state?.ppu)throw Error('同じROMの3Dモード用ステートを選択してください。');createCore(data.state);notify('state-loaded');}catch(err){notify('profile-error',{message:'ステート読込失敗：'+err.message});}e.target.value='';});
addEventListener('pagehide',()=>{active=false;cancelAnimationFrame(animation);release();capture?.dispose();renderer?.dispose();audioNode?.disconnect();audio?.close();});
notify('host-ready');
})();
