/* 3D rendering data. JSNES 2.1.0 / mapper 0 only; no changes to CPU or PPU timing. */
(function(root){
'use strict';
const WIDTH=256,HEIGHT=240,PIXELS=WIDTH*HEIGHT;
function layer(){return {color:new Uint32Array(PIXELS),tile:new Int16Array(PIXELS).fill(-1),palette:new Uint8Array(PIXELS)};}
class Capture {
 constructor(nes){
  const p=nes.ppu;this.nes=nes;this.bg=layer();this.sprite=layer();this.priority=new Uint8Array(PIXELS);this.behind=new Uint8Array(PIXELS);this.originals=[];
  if(!p.scanlineSecondaryOAM||!p.scantile)throw Error('3D描画に必要なJSNES 2.1.0の描画情報がありません。');
  const self=this;
  this.wrap(p,'startFrame',function(original,args){original.apply(this,args);self.bg.tile.fill(-1);self.sprite.tile.fill(-1);self.priority.fill(255);self.behind.fill(0);});
  this.wrap(p,'renderBgScanline',function(original,args){
   const [useBg,scan]=args,row=this.cntFV,vertical=this.cntV,tileY=this.cntVT,horizontal=this.regH,tileX=this.regHT,fineX=this.regFH,base=this.regS?256:0;
   const visible=this.f_bgVisibility===1&&scan>=0&&scan<240&&scan-row>=0;
   const ids=visible?Array.from({length:32},(_,i)=>{const x=tileX+i,nt=this.ntable1[vertical*2+((horizontal+(x>>5))&1)];return base+this.nameTable[nt].getTileIndex(x&31,tileY);}):null;
   original.apply(this,args);
   if(!visible)return;
   const target=useBg?this.bgbuffer:this.buffer;
   for(let i=0;i<32;i++){
    const tile=this.scantile[i];if(!tile)continue;
    for(let sx=0;sx<8;sx++){
     const x=i*8-fineX+sx;if(x<0||x>=256||(x<8&&!this.f_bgClipping))continue;
     const at=scan*256+x;
     if(tile.pix[row*8+sx]!==0){self.bg.tile[at]=ids[i];self.bg.color[at]=target[at];self.bg.palette[at]=this.attrib[i]>>2;}
     else self.bg.tile[at]=-1;
    }
   }
  });
  this.wrap(p,'renderSpritesPartially',function(original,args){self.currentPriority=args[2];return original.apply(this,args);});
  // Capture the exact tile rows and flip flags supplied by the sprite renderer.
  // Per-instance wrappers avoid affecting another emulator on the page.
  for(let id=0;id<p.ptTile.length;id++)this.wrap(p.ptTile[id],'render',function(original,args){
   const [buffer,x1,y1,x2,y2,dx,dy,pal,palette,flipX,flipY,order]=args;
   if(buffer===p.buffer){
    for(let y=Math.max(0,y1,-dy);y<Math.min(8,y2,240-dy);y++)for(let x=Math.max(0,x1,-dx);x<Math.min(8,x2,256-dx);x++){
     const screenX=dx+x;if(screenX<8&&!p.f_spClipping)continue;
     const pixel=this.pix[(flipY?7-y:y)*8+(flipX?7-x:x)],at=(dy+y)*256+screenX;
     if(pixel&&order<=self.priority[at]){self.sprite.tile[at]=id;self.sprite.color[at]=palette[pal+pixel];self.sprite.palette[at]=pal>>2;self.priority[at]=order;self.behind[at]=self.currentPriority;}
    }
   }
   return original.apply(this,args);
  });
 }
 wrap(object,key,handler){const original=object[key];this.originals.push([object,key,original]);object[key]=function(...args){return handler.call(this,original,args);};}
 dispose(){for(const [object,key,original]of this.originals)object[key]=original;this.originals=[];}
 pick(x,y){const at=Math.max(0,Math.min(239,y))*256+Math.max(0,Math.min(255,x));const isSprite=this.sprite.tile[at]>=0&&(!this.behind[at]||this.bg.tile[at]<0);const data=isSprite?this.sprite:this.bg;return data.tile[at]<0?null:{layer:isSprite?'sprite':'background',tile:data.tile[at],palette:data.palette[at]};}
}
const presets={
 generic:{name:'共通 / Generic',hudRows:0,background:{z:0,depth:3},sprite:{z:12,depth:7},rules:[]},
 mario:{name:'スーパーマリオブラザーズ / 初期設定',hudRows:32,background:{z:0,depth:5},sprite:{z:12,depth:8},rules:[]},
 spartan:{name:'スパルタンX / 初期設定',hudRows:32,background:{z:0,depth:3},sprite:{z:10,depth:9},rules:[]}
};
const copy=value=>JSON.parse(JSON.stringify(value));
function preset(id){return {version:1,romHash:'',...copy(presets[id]||presets.generic)};}
function validate(raw){
 if(!raw||raw.version!==1||typeof raw.name!=='string'||raw.name.length>100||!Number.isInteger(raw.hudRows)||raw.hudRows<0||raw.hudRows>64||!Array.isArray(raw.rules)||raw.rules.length>1024)throw Error('3Dプロファイルの形式が不正です。');
 const style=s=>{if(!s||!Number.isFinite(s.z)||s.z< -48||s.z>48||!Number.isFinite(s.depth)||s.depth<0||s.depth>32)throw Error('奥行きは−48〜48、厚みは0〜32で指定してください。');return {z:s.z,depth:s.depth};};
 const result={version:1,name:raw.name,romHash:typeof raw.romHash==='string'?raw.romHash:'',hudRows:raw.hudRows,background:style(raw.background),sprite:style(raw.sprite),rules:[]};
 if(result.romHash&&!/^[0-9a-f]{64}$/.test(result.romHash))throw Error('ROM識別情報が不正です。');
 for(const r of raw.rules){if(!r||!['background','sprite'].includes(r.layer)||!Number.isInteger(r.tile)||r.tile<0||r.tile>511||(r.palette!==undefined&&(!Number.isInteger(r.palette)||r.palette<0||r.palette>3)))throw Error('タイル設定が不正です。');result.rules.push({layer:r.layer,tile:r.tile,...(r.palette!==undefined?{palette:r.palette}:{}),...style(r)});}
 return result;
}
function compile(profile){
 const table={background:[],sprite:[]};
 for(const kind of Object.keys(table))for(let pal=0;pal<4;pal++)for(let tile=0;tile<512;tile++)table[kind][pal*512+tile]=profile[kind];
 for(const rule of profile.rules)for(let pal=0;pal<4;pal++)if(rule.palette===undefined||rule.palette===pal)table[rule.layer][pal*512+rule.tile]=rule;
 return table;
}
// Merge adjacent, identically colored voxels into prisms. Geometry includes a
// complete background layer, even under sprites; sky is the clear color.
function geometry(capture,profile,table=compile(profile),output=new Float32Array(PIXELS*2*9)){
 let count=0;
 for(const [kind,data]of [['background',capture.bg],['sprite',capture.sprite]])for(let y=profile.hudRows;y<240;y++){
  let x=0;while(x<256){
   const at=y*256+x,tile=data.tile[at];if(tile<0){x++;continue;}
   const style=table[kind][data.palette[at]*512+tile];if(style.depth===0){x++;continue;}
   const back=kind==='sprite'&&capture.behind[at],bgTile=capture.bg.tile[at],bgStyle=bgTile>=0?table.background[capture.bg.palette[at]*512+bgTile]:profile.background,z=back?Math.min(style.z,bgStyle.z-bgStyle.depth-1):style.z;
   const color=data.color[at],start=x;let next=x+1;
   while(next<256){const n=y*256+next,id=data.tile[n];if(id<0||data.color[n]!==color||table[kind][data.palette[n]*512+id]!==style||(kind==='sprite'&&capture.behind[n]!==capture.behind[at]))break;next++;}
   const offset=count++*9;
   output.set([(start+next)/2-128,119.5-y,z-style.depth/2,next-start,1,style.depth,(color&255)/255,((color>>8)&255)/255,((color>>16)&255)/255],offset);
   x=next;
  }
 }
 return {data:output,count};
}
const api={Capture,preset,validate,compile,geometry,WIDTH,HEIGHT};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NESVoxelData=api;
})(typeof window!=='undefined'?window:globalThis);
