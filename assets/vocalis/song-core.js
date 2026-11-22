(function(root,factory){const api=factory();root.SongCore=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,()=>{
'use strict';
function validateRequest(p){if(!p||typeof p.theme!=='string'||!p.theme.trim()||p.theme.length>500||!Number.isFinite(p.minutes)||p.minutes<.5||p.minutes>10||!['male','female'].includes(p.voice)||!['J-POP','バラード','ロック','エレクトロ'].includes(p.genre))throw Error('テーマ、0.5〜10分、男性／女性、ジャンルを指定してください。');return {theme:p.theme.trim(),minutes:p.minutes,voice:p.voice,genre:p.genre};}
function compile(plan,request){
 validateRequest(request);
 if(!plan||typeof plan.title!=='string'||!plan.title.trim()||plan.title.length>100||!Number.isFinite(plan.bpm)||plan.bpm<60||plan.bpm>180||!Array.isArray(plan.sections)||plan.sections.length<2||plan.sections.length>12)throw Error('AIの曲構成が不正です。');
 const range=request.voice==='male'?[48,72]:[60,84],tonic=Number.isInteger(plan.tonic)&&plan.tonic>=0&&plan.tonic<12?plan.tonic:0,mode=plan.mode==='minor'?'minor':'major',scale=(mode==='minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11]).map(p=>(p+tonic)%12);let sum=0;
 for(const s of plan.sections){if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>50||!Number.isFinite(s.weight)||s.weight<=0||s.weight>16||!Array.isArray(s.phrases)||!s.phrases.length||s.phrases.length>16)throw Error('AIのセクションが不正です。');sum+=s.weight;for(const p of s.phrases){if(!p||typeof p.text!=='string'||p.text.length>300||!Array.isArray(p.notes)||!p.notes.length||p.notes.length>80)throw Error('AIの歌詞が不正です。');for(const n of p.notes)if(!n||!(n.pitch===null||(Number.isInteger(n.pitch)&&n.pitch>=range[0]&&n.pitch<=range[1]))||typeof n.lyric!=='string'||n.lyric.length>30||(n.reading!==undefined&&(typeof n.reading!=='string'||n.reading.length>60))||!Number.isFinite(n.duration)||n.duration<.25||n.duration>8||Math.abs(n.duration*4-Math.round(n.duration*4))>.0001)throw Error('AIの音符が不正です。');}}
 const bars=Math.max(plan.sections.length,Math.round(request.minutes*plan.bpm/4)),totalBeats=bars*4;
 const allocation=plan.sections.map(s=>1+Math.floor((bars-plan.sections.length)*s.weight/sum));const remain=bars-allocation.reduce((a,b)=>a+b,0),order=plan.sections.map((s,i)=>({i,f:((bars-plan.sections.length)*s.weight/sum)%1})).sort((a,b)=>b.f-a.f);for(let i=0;i<remain;i++)allocation[order[i%order.length].i]++;
 const notes=[],sections=[];let offset=0,id=0;
 plan.sections.forEach((s,i)=>{
  const span=allocation[i]*4,base=s.phrases.flatMap(p=>p.notes);let pos=0,cycle=0;
  while(pos<span){for(let k=0;k<base.length&&pos<span;k++){const n=base[k],duration=Math.min(n.duration,span-pos);let pitch=n.pitch;
    if(pitch!==null&&n.lyric.trim()){
     // Reprise variations stay in the selected scale and voice range; rhythm stays on the grid.
     if(cycle%3===1&&k%4===2){let candidate=pitch+2;while(candidate<=range[1]&&!scale.includes(candidate%12))candidate++;if(candidate<=range[1])pitch=candidate;}
     const breath=k===base.length-1&&duration>=.5?.125:0;
     notes.push({id:++id,pitch,start:offset+pos,duration:duration-breath,lyric:n.lyric,...(n.reading?{reading:n.reading}:{}),velocity:Math.max(.4,Math.min(.9,.7+(i%3)*.06-(k%4===3?.08:0)))});
     if(notes.length>10000)throw Error('音符が多すぎます。短い曲で生成してください。');
    }pos+=duration;
   }cycle++;}
  sections.push({name:s.name,start:offset,duration:span,lyrics:s.phrases.map(p=>p.text).join('\n'),repeats:cycle});offset+=span;
 });
 if(!notes.length)throw Error('歌声の音符がありません。');
 return {notes,bpm:plan.bpm,totalBeats,song:{title:plan.title,theme:request.theme,minutes:totalBeats/plan.bpm,requestedMinutes:request.minutes,voice:request.voice,genre:request.genre,tonic,mode,sections}};
}
return {validateRequest,compile};
});
