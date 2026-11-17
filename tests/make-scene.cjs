// Original NROM scene made for regression tests. Contains no commercial data.
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'.generated');fs.mkdirSync(root,{recursive:true});
const bytes=[],labels={},refs=[];
const emit=(...v)=>bytes.push(...v),label=n=>labels[n]=0x8000+bytes.length;
const address=(opcode,name)=>{emit(opcode,0,0);refs.push({at:bytes.length-2,name});};
const branch=(opcode,name)=>{emit(opcode,0);refs.push({at:bytes.length-1,name,relative:true});};
const lda=v=>emit(0xa9,v),sta=a=>emit(0x8d,a&255,a>>8),ppu=a=>{lda(a>>8);sta(0x2006);lda(a&255);sta(0x2006);};
label('reset');emit(0x78,0xd8,0xa2,0xff,0x9a,0xe8,0x8e,0,0x20,0x8e,1,0x20);
label('vblank1');emit(0x2c,2,0x20);branch(0x10,'vblank1');
lda(0xff);emit(0xa2,0);label('clearOam');emit(0x9d,0,2,0xe8);branch(0xd0,'clearOam');
label('vblank2');emit(0x2c,2,0x20);branch(0x10,'vblank2');
ppu(0x3f00);emit(0xa2,0);label('paletteLoop');address(0xbd,'palette');sta(0x2007);emit(0xe8,0xe0,32);branch(0xd0,'paletteLoop');
ppu(0x2000);
for(let page=0;page<4;page++){emit(0xa2,0);label('page'+page);address(0xbd,'name'+page);sta(0x2007);emit(0xe8);branch(0xd0,'page'+page);}
for(const [i,tile,x,y]of [[0,2,108,104],[1,3,116,104],[2,6,108,112],[3,7,116,112]]){for(const [offset,value]of [[0,y],[1,tile],[2,0],[3,x]]){lda(value);sta(0x0200+i*4+offset);}}
lda(0);sta(0x2000);sta(0x2005);sta(0x2005);lda(2);sta(0x4014);lda(0x1e);sta(0x2001);
label('loop');emit(0x2c,2,0x20);branch(0x10,'loop');
emit(0xee,3,2,0xee,7,2,0xee,11,2,0xee,15,2);lda(2);sta(0x4014);lda(0);sta(0x2005);sta(0x2005);address(0x4c,'loop');
label('palette');emit(...[0x21,0x17,0x27,0x30,0x21,0x09,0x19,0x30,0x21,0x16,0x27,0x30,0x21,0x00,0x10,0x30,0x21,0x16,0x27,0x30,0x21,0x06,0x17,0x30,0x21,0x06,0x17,0x30,0x21,0x06,0x17,0x30]);
const name=Buffer.alloc(1024);for(let y=0;y<30;y++)for(let x=0;x<32;x++){if(y>=25)name[y*32+x]=1;else if(y===17&&x>=10&&x<16)name[y*32+x]=5;else if(y>=6&&y<=7&&((x>=4&&x<=8)||(x>=23&&x<=26)))name[y*32+x]=4;}
for(let page=0;page<4;page++){label('name'+page);emit(...name.subarray(page*256,page*256+256));}
for(const ref of refs){const target=labels[ref.name];if(target===undefined)throw Error(ref.name);if(ref.relative){const d=target-(0x8000+ref.at+1);if(d<-128||d>127)throw Error('Branch overflow');bytes[ref.at]=d&255;}else{bytes[ref.at]=target&255;bytes[ref.at+1]=target>>8;}}
const rom=Buffer.alloc(16+32768+8192);rom.set([78,69,83,26,2,1]);rom.set(bytes,16);
for(const offset of [0x7ffa,0x7ffc,0x7ffe])rom.writeUInt16LE(labels.reset,16+offset);
function tile(id,rows){for(let y=0;y<8;y++)for(let x=0;x<8;x++){const value=Number(rows[y][x]);rom[16+32768+id*16+y]|=(value&1)<<(7-x);rom[16+32768+id*16+y+8]|=((value>>1)&1)<<(7-x);}}
tile(1,['33333333','11121112','11121112','22222222','21112111','21112111','21112111','22222222']);
tile(2,['00011111','00111111','00222222','00232322','00222222','00022222','00111111','01111111']);
tile(3,['11100000','11110000','22220000','22320000','22220000','22200000','11110000','11111000']);
tile(6,['01111111','01111111','00222222','00222000','00222000','00222000','03333000','03333000']);
tile(7,['11111000','11111000','22220000','02220000','02220000','02220000','03333000','03333000']);
tile(4,['00000000','00033000','00333300','03333330','33333333','33333333','00000000','00000000']);
tile(5,['33333333','31111113','31222213','31233213','31222213','31111113','31111113','33333333']);
fs.writeFileSync(path.join(root,'smoke-test.nes'),rom);
