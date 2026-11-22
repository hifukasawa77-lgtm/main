(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectCore=api;})(globalThis,()=>{
'use strict';
const VERSION=2,MAX_NOTES=10000,MAX_BEATS=2400;
const fail=()=>{throw Error('対応するVocalisプロジェクトJSONを選んでください。');};
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
function normalize(raw){
 const p=typeof raw==='string'?JSON.parse(raw):raw;
 if(!p||typeof p!=='object'||(p.version!==undefined&&![1,VERSION].includes(p.version)))fail();
 const beats=p.totalBeats===undefined?16:p.totalBeats;
 if(!finite(beats,1,MAX_BEATS)||!finite(p.bpm,40,240)||!finite(p.cursor,0,beats)||!p.settings||!['brightness','breath','emotion'].every(k=>finite(p.settings[k],0,100))||!Array.isArray(p.notes)||p.notes.length>MAX_NOTES)fail();
 const ids=new Set();const notes=p.notes.map((n,i)=>{
  if(!n||!Number.isInteger(n.pitch)||!finite(n.pitch,48,84)||!finite(n.start,0,beats)||!finite(n.duration,.015625,beats)||n.start+n.duration>beats+.00001||typeof n.lyric!=='string'||n.lyric.length>300)fail();
  const id=n.id===undefined?'legacy-'+i:n.id;
  if(!['number','string'].includes(typeof id)||(typeof id==='number'&&!Number.isFinite(id))||(typeof id==='string'&&(!id||id.length>100))||ids.has(String(id)))fail();ids.add(String(id));
  if(n.velocity!==undefined&&!finite(n.velocity,0,1))fail();
  if(n.reading!==undefined&&(typeof n.reading!=='string'||n.reading.length>300))fail();
  return {id,pitch:n.pitch,start:n.start,duration:n.duration,lyric:n.lyric,...(n.reading!==undefined?{reading:n.reading}:{}),velocity:n.velocity??(n.harmony?.55:.75),...(n.harmony?{harmony:true}:{})};
 });
 let song=null;
 if(p.song!==null&&p.song!==undefined){
  const s=p.song;
  if(typeof s.title!=='string'||s.title.length>100||!Array.isArray(s.sections)||s.sections.length>12||!['male','female'].includes(s.voice))fail();
  const sections=s.sections.map(v=>{
   if(!v||typeof v.name!=='string'||v.name.length>50||!finite(v.start,0,beats)||!finite(v.duration,.015625,beats)||v.start+v.duration>beats+.00001||typeof v.lyrics!=='string'||v.lyrics.length>20000)fail();
   return {name:v.name,start:v.start,duration:v.duration,lyrics:v.lyrics,repeats:finite(v.repeats,1,1000)?v.repeats:1};
  });
  song={title:s.title,voice:s.voice,theme:typeof s.theme==='string'?s.theme.slice(0,500):'',genre:typeof s.genre==='string'?s.genre.slice(0,40):'',minutes:beats/p.bpm,sections};
  if(Number.isInteger(s.tonic)&&finite(s.tonic,0,11))song.tonic=s.tonic;
  if(['major','minor'].includes(s.mode))song.mode=s.mode;
 }
 const mode=p.playback?.mode??'vocal',voice=p.playback?.voice??song?.voice??'female';
 if(!['vocal','instrument'].includes(mode)||!['male','female'].includes(voice))fail();
 let character=null;
 if(p.character){const c=p.character;if(typeof c.name!=='string'||!c.name.trim()||c.name.length>40||!['male','female'].includes(c.voice)||typeof c.appearance!=='string'||c.appearance.length>1000||!['アニメ','3D','イラスト'].includes(c.style)||typeof c.assetId!=='string'||c.assetId.length>100)fail();character={name:c.name,voice:c.voice,appearance:c.appearance,style:c.style,assetId:c.assetId};}
 return {version:VERSION,notes,bpm:p.bpm,settings:{brightness:p.settings.brightness,breath:p.settings.breath,emotion:p.settings.emotion},cursor:p.cursor,totalBeats:beats,song,playback:{mode,voice},character};
}
function playbackNotes(notes,from){return notes.filter(n=>n.start+n.duration>from).map(n=>({...n,offset:Math.max(0,from-n.start),start:Math.max(0,n.start-from),duration:n.duration-Math.max(0,from-n.start)})).sort((a,b)=>a.start-b.start);}
function inferKey(notes){
 const major=[0,2,4,5,7,9,11],minor=[0,2,3,5,7,8,10];let best={tonic:0,mode:'major',score:-Infinity};
 for(let tonic=0;tonic<12;tonic++)for(const [mode,scale]of [['major',major],['minor',minor]]){let score=0;for(const n of notes.filter(n=>!n.harmony)){const d=(n.pitch-tonic+120)%12;score+=(scale.includes(d)?1:-2)*n.duration+(d===0?.12*n.duration:0);}if(score>best.score)best={tonic,mode,score};}return best;
}
function harmonize(notes,key=inferKey(notes),voice='female'){
 const scale=(key.mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(p=>(p+key.tonic)%12),max=voice==='male'?76:84;
 return notes.filter(n=>!n.harmony&&n.lyric.trim()).map(n=>{let p=n.pitch+3;while(p<=max&&!scale.includes(p%12))p++;if(p>max)p-=12;return {...n,id:'h:'+n.id,pitch:p,velocity:(n.velocity??.75)*.58,harmony:true};});
}
function lyrics(notes,song){const sections=song?.sections||[{name:'Melody',start:0,duration:Infinity}];return (song?.title||'VOCALIS')+'\n\n'+sections.map(s=>'['+s.name+']\n'+notes.filter(n=>!n.harmony&&n.start>=s.start-.00001&&n.start<s.start+s.duration-.00001).sort((a,b)=>a.start-b.start).map(n=>n.lyric).join('')).join('\n\n');}
return {VERSION,MAX_NOTES,MAX_BEATS,normalize,playbackNotes,inferKey,harmonize,lyrics};
});
