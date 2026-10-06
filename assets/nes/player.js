'use strict';
(()=>{
const DATA='https://cdn.emulatorjs.org/4.2.3/data/';let session=0,booted=false,active=false;const urls=[];
const notify=(type,extra={})=>parent.postMessage({type,session,...extra},location.origin);
function fail(message){active=false;notify('error',{message});}
addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent)return;const d=e.data;if(!d||typeof d!=='object')return;
 if(d.type==='boot'&&!booted){
  if(!(d.rom instanceof File)||!['fceumm','nestopia'].includes(d.core)||!Number.isInteger(d.session))return;
  booted=true;session=d.session;
  const gameUrl=URL.createObjectURL(d.rom);urls.push(gameUrl);
  const controls={};
  const bindings={0:['z','BUTTON_2'],2:['shift','SELECT'],3:['enter','START'],4:['up arrow','DPAD_UP'],5:['down arrow','DPAD_DOWN'],6:['left arrow','DPAD_LEFT'],7:['right arrow','DPAD_RIGHT'],8:['x','BUTTON_1']};
  for(let player=0;player<4;player++)controls[player]=Object.fromEntries(Object.entries(bindings).map(([button,[key,pad]])=>[button,{value:player===0?key:'',value2:pad}]));
  Object.assign(window,{EJS_player:'#game',EJS_core:d.core,EJS_gameUrl:gameUrl,EJS_gameName:d.rom.name,EJS_pathtodata:DATA,EJS_startOnLoaded:true,EJS_color:'#9c303f',EJS_backgroundColor:'#05090c',EJS_language:'ja-JP',EJS_threads:false,EJS_disableDatabases:true,EJS_defaultControls:controls,EJS_Buttons:{netplay:false,cheat:false}});
  if(d.bios){if(!(d.bios instanceof File)||d.bios.size!==8192){fail('FDS BIOSの容量が不正です。');return;}const url=URL.createObjectURL(d.bios);urls.push(url);window.EJS_externalFiles={'/disksys.rom':url};}
  window.EJS_onGameStart=()=>{active=true;notify('started',{diskCount:window.EJS_emulator?.gameManager?.getDiskCount()||0});};
  window.EJS_onExit=()=>{active=false;notify('exited');};
  const loader=document.createElement('script');loader.src=DATA+'loader.js';loader.onerror=()=>{const p=document.createElement('p');p.textContent='エミュレータを取得できませんでした。インターネット接続を確認し、取出し後に再起動してください。';document.getElementById('game').replaceChildren(p);fail('エミュレータ配信サーバーに接続できません。');};document.body.append(loader);return;
 }
 if(d.session!==session||!active)return;
 const emulator=window.EJS_emulator,manager=emulator?.gameManager;if(!manager)return;
 try{
  if(d.type==='input'&&[0,2,3,4,5,6,7,8].includes(d.button)&&[0,1].includes(d.value))manager.simulateInput(0,d.button,d.value);
  if(d.type==='pause')d.paused?emulator.pause():emulator.play();
  if(d.type==='reset'){manager.restart();emulator.play();}
  if(d.type==='disk'&&Number.isInteger(d.index)&&d.index>=0&&d.index<manager.getDiskCount()){manager.setCurrentDisk(d.index);notify('disk-changed',{index:d.index});}
 }catch(err){notify('error',{message:err.message});}
});
addEventListener('error',e=>{if(booted)fail(e.message||'コアの読み込みに失敗しました。');});
addEventListener('unhandledrejection',e=>{if(booted)fail(String(e.reason?.message||e.reason));});
addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);});
parent.postMessage({type:'host-ready'},location.origin);
})();
