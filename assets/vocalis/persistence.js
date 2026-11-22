(function(root){
'use strict';
root.VocalisPersistence=function(key,onStatus,onConflict){
 const writer=crypto.randomUUID();let revision=null,pending=null,timer=null,blocked=false,writing=null;
 function read(){const raw=localStorage.getItem(key);if(!raw){revision=null;return null;}const data=JSON.parse(raw);revision=data.revision||'legacy';return data.project||data;}
 function storedRevision(){const raw=localStorage.getItem(key);return raw?(JSON.parse(raw).revision||'legacy'):null;}
 async function flush(){clearTimeout(timer);if(blocked||!pending)return false;if(writing){await writing;return flush();}const payload=pending;pending=null;
  writing=(async()=>{try{
   const write=()=>{if(storedRevision()!==revision){blocked=true;onConflict();return false;}const next=crypto.randomUUID();localStorage.setItem(key,JSON.stringify({revision:next,writer,project:payload}));revision=next;onStatus('このブラウザに保存済み');return true;};
   if(!navigator.locks){onStatus('自動保存に非対応 · JSON保存を使用');return false;}
   return await navigator.locks.request(key,write);
  }catch{onStatus('保存失敗 · JSON保存を使用');return false;}finally{writing=null;}})();return writing;
 }
 function save(project){pending=project;onStatus(blocked?'他のタブで更新 · JSON保存を使用':'保存中…');clearTimeout(timer);if(!blocked)timer=setTimeout(flush,250);}
 window.addEventListener('storage',e=>{if(e.key===key&&e.newValue){try{const v=JSON.parse(e.newValue);if(v.writer!==writer){blocked=true;clearTimeout(timer);onConflict();}}catch{}}});
 window.addEventListener('pagehide',()=>{if(pending&&!blocked){try{if(storedRevision()===revision){revision=crypto.randomUUID();localStorage.setItem(key,JSON.stringify({revision,writer,project:pending}));pending=null;}}catch{}}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 return {read,save,flush};
};
})(globalThis);
