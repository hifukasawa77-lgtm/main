(function(root,factory){const api=factory();root.VocalCore=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,()=>{
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const formants={a:[800,1200,2700],i:[300,2300,3000],u:[350,1100,2400],e:[500,1900,2700],o:[500,900,2500],n:[250,1000,2200]};
function phoneme(text,previous){return globalThis.LyricCore?.phoneme(text,previous)||{vowel:null,consonant:'',supported:false};}
function spectrum(pitch,vowel,voice='female',brightness=65){const f0=440*2**((pitch-69)/12),scale=voice==='male'?.87:1.08,centers=(formants[vowel]||formants.a).map(f=>f*scale),real=new Float32Array(49),imag=new Float32Array(49);let norm=0;for(let h=1;h<49;h++){const hz=f0*h;if(hz>12000)break;let energy=.018/h;for(let j=0;j<3;j++)energy+=Math.exp(-.5*((hz-centers[j])/(j===0?160:240))**2)*[1,.65,.35][j]/Math.sqrt(h);energy*=Math.exp(-hz/(2200+clamp(brightness,0,100)*60));imag[h]=energy;norm+=energy;}if(norm)for(let h=1;h<49;h++)imag[h]/=norm;return {real,imag,f0,centers};}
const caches=new WeakMap();
function noiseBuffer(ctx){let b=caches.get(ctx);if(!b){b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.25),ctx.sampleRate);const data=b.getChannelData(0);let seed=123456;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}caches.set(ctx,b);}return b;}
function syllable(ctx,dest,note,p,time,duration,voice,settings){
 if(!p.vowel||duration<.002||note.velocity===0)return null;
 const shape=spectrum(note.pitch,p.vowel,voice,settings.brightness),osc=ctx.createOscillator(),gain=ctx.createGain(),lfo=ctx.createOscillator(),depth=ctx.createGain(),sources=[osc,lfo],nodes=[osc,gain,lfo,depth];
 const end=time+duration,consonant=p.consonant==='stop'?.025:p.consonant?.04:.008,attack=Math.min(duration*.25,consonant),release=Math.min(.035,duration*.25),level=clamp(note.velocity??.75,0,1)*.47*(p.vowel==='n'?.65:1);
 osc.setPeriodicWave(ctx.createPeriodicWave(shape.real,shape.imag,{disableNormalization:true}));osc.frequency.setValueAtTime(shape.f0,time);lfo.frequency.value=voice==='male'?5:5.5;depth.gain.setValueAtTime(0,time);depth.gain.linearRampToValueAtTime(settings.emotion*.24,time+Math.min(.22,duration*.65));lfo.connect(depth);depth.connect(osc.detune);osc.connect(gain);gain.connect(dest);
 gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+attack);gain.gain.setValueAtTime(level,Math.max(time+attack,end-release));gain.gain.linearRampToValueAtTime(0,end);osc.start(time);lfo.start(time);osc.stop(end+.002);lfo.stop(end+.002);
 if(p.consonant||settings.breath>0){const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),ng=ctx.createGain();src.buffer=noiseBuffer(ctx);src.loop=true;filter.type=p.consonant==='nasal'?'bandpass':'highpass';filter.frequency.value=p.consonant==='s'?4500:p.consonant==='nasal'?800:1800;src.connect(filter);filter.connect(ng);ng.connect(dest);const breath=settings.breath*.00035*clamp(note.velocity??.75,0,1),burst=p.consonant==='s'?.075:p.consonant==='stop'?.045:p.consonant==='h'?.04:.012;
 ng.gain.setValueAtTime(0,time);ng.gain.linearRampToValueAtTime(breath+burst,time+Math.min(.008,duration*.1));ng.gain.linearRampToValueAtTime(breath,time+Math.min(.075,duration*.35));ng.gain.setValueAtTime(breath,Math.max(time+Math.min(.075,duration*.35),end-release));ng.gain.linearRampToValueAtTime(0,end);src.start(time);src.stop(end+.002);sources.push(src);nodes.push(src,filter,ng);
 }
 osc.onended=()=>nodes.forEach(n=>{try{n.disconnect();}catch{}});
 return {end,stop(){const t=ctx.currentTime;try{gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(0,t,.003);}catch{}sources.forEach(s=>{try{s.stop(t+.012);}catch{}});}};
}
function createVoice(ctx,dest,note,time,duration,voice='female',settings={}){
 const opts={brightness:clamp(settings.brightness??65,0,100),breath:clamp(settings.breath??20,0,100),emotion:clamp(settings.emotion??35,0,100)};
 const ps=note.phonemes||globalThis.LyricCore?.prepare([{...note,start:0}])[0].phonemes||[],parts=[];
 const fraction=clamp(note.offsetFraction,0,.9999),full=duration/(1-fraction),unit=full/Math.max(1,ps.length),skipped=full*fraction;
 ps.forEach((p,i)=>{const begin=Math.max(skipped,i*unit),end=(i+1)*unit;if(end>begin){const part=syllable(ctx,dest,note,p,time+begin-skipped,end-begin,voice,opts);if(part)parts.push(part);}});
 return {end:time+duration,stop(){parts.forEach(p=>p.stop());}};
}
function midi(notes,bpm,{title='VOCALIS',totalBeats=0}={}){
 const ppq=480,utf8=s=>Array.from(new TextEncoder().encode(String(s))),vlq=n=>{let v=Math.max(0,Math.round(n)),out=[v&127];while((v>>=7)>0)out.unshift((v&127)|128);return out;};
 const meta=(kind,text)=>{const b=utf8(text);return [255,kind,...vlq(b.length),...b];};
 function track(events){events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let tick=0;const data=[];for(const e of events){data.push(...vlq(e.tick-tick),...e.bytes);tick=e.tick;}data.push(...vlq(Math.max(0,Math.round(totalBeats*ppq)-tick)),255,47,0);const s=data.length;return [77,84,114,107,(s>>>24)&255,(s>>>16)&255,(s>>>8)&255,s&255,...data];}
 const micro=Math.round(60000000/clamp(bpm,40,240));const tracks=[track([{tick:0,order:0,bytes:meta(3,title)},{tick:0,order:1,bytes:[255,81,3,(micro>>16)&255,(micro>>8)&255,micro&255]},{tick:0,order:2,bytes:[255,88,4,4,2,24,8]}])];
 for(const harmony of [false,true]){const events=[{tick:0,order:-1,bytes:meta(3,harmony?'Harmony':'Lead Vocal')}],channel=harmony?1:0;for(const n of notes.filter(n=>!!n.harmony===harmony)){const t=Math.round(n.start*ppq),end=Math.max(t+1,Math.round((n.start+n.duration)*ppq)),velocity=Math.round(clamp(n.velocity??(harmony?.5:.75),0,1)*127);if(!velocity)continue;if(n.lyric)events.push({tick:t,order:0,bytes:meta(5,n.lyric)});events.push({tick:t,order:1,bytes:[144+channel,n.pitch,velocity]},{tick:end,order:-1,bytes:[128+channel,n.pitch,0]});}tracks.push(track(events));}
 const data=[77,84,104,100,0,0,0,6,0,1,0,tracks.length,ppq>>8,ppq&255];for(const t of tracks)for(const b of t)data.push(b);return new Uint8Array(data);
}
return {phoneme,spectrum,createVoice,midi};
});
