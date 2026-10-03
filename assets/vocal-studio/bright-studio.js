'use strict';
(function(){
const main=document.querySelector('.grid main'),hero=document.createElement('div');
hero.className='studio-hero';
hero.innerHTML='<div><span class="studio-eyebrow">VOCAL CREATIVE WORKSPACE</span><h2>歌詞から、あなただけのメロディへ。</h2><p>Compose · Edit · Sing — 作曲・編集・歌声をひとつの画面で。</p></div><div class="studio-wave" aria-hidden="true"></div>';
main.prepend(hero);
[18,27,40,25,52,35,58,43,25,46,32,20].forEach(h=>{const bar=document.createElement('i');bar.style.height=h+'px';hero.querySelector('.studio-wave').append(bar);});
['bright','breath','vibDepth'].forEach((id,i)=>{
const input=document.getElementById(id),label=document.querySelector('label[for="'+id+'"]');
if(!input||!label)return;
const box=document.createElement('div');box.className='expression-control';
label.before(box);box.append(label);
const dial=document.createElement('div');dial.className='expression-dial';dial.dataset.color=String(i);dial.setAttribute('aria-hidden','true');box.append(dial,input);
const update=()=>dial.style.setProperty('--angle',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))-.5)*160+'deg');
input.addEventListener('input',update);input.addEventListener('change',update);document.getElementById('voice').addEventListener('change',update);update();
});
})();
