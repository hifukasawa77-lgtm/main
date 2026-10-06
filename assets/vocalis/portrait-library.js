'use strict';
window.VocalPortraits = [
  ...['Ren','Sora','Haru','Rei','Akira','Shion','Yuto','Kai','Nagi','Jin'].map((name,i)=>({id:`male-${String(i+1).padStart(2,'0')}`,name,voice:'male'})),
  ...['Hikari','Yuki','Koharu','Mio','Akane','Sumire','Hinata','Rina','Nao','Sakura'].map((name,i)=>({id:`female-${String(i+1).padStart(2,'0')}`,name,voice:'female'}))
].map(p=>({...p,src:`assets/vocalis/portraits/${p.id}.webp`}));
