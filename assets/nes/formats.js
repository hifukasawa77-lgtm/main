/* File validation shared by the browser loader and regression tests. */
(function(root){
'use strict';
const MAX_SIZE=32*1024*1024;
const magic=(b,v)=>v.every((x,i)=>b[i]===x);
function parse(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<16)throw Error('ファイルが短すぎます。ROMを選び直してください。');
 if(bytes.length>MAX_SIZE)throw Error('32 MB以下のファイルを選択してください。');
 if(magic(bytes,[0x4e,0x45,0x53,0x1a])){
  const nes2=(bytes[7]&12)===8;
  const size=(lsb,msb,unit)=>msb===15 ? 2**(lsb>>2)*((lsb&3)*2+1) : ((msb<<8)|lsb)*unit;
  const prg=size(bytes[4],nes2?bytes[9]&15:0,16384),chr=size(bytes[5],nes2?bytes[9]>>4:0,8192);
  const required=16+((bytes[6]&4)?512:0)+prg+chr;
  if(!prg||!Number.isSafeInteger(required)||required>bytes.length)throw Error('NESヘッダーとROM容量が一致しません。データが不足しています。');
  return {kind:'nes',format:nes2?'NES 2.0':'iNES',mapper:(bytes[6]>>4)|(bytes[7]&240)|(nes2?(bytes[8]&15)<<8:0),submapper:nes2?bytes[8]>>4:0,prg,chr,battery:!!(bytes[6]&2),region:nes2?['NTSC','PAL','Multi','Dendy'][bytes[12]&3]:(bytes[9]&1?'PAL':'NTSC')};
 }
 if(magic(bytes,[0x55,0x4e,0x49,0x46])){
  if(bytes.length<32)throw Error('UNIFヘッダーが途中で切れています。');
  let offset=32,board='',prg=0,chr=0;
  while(offset<bytes.length){
   if(offset+8>bytes.length)throw Error('UNIFチャンクが途中で切れています。');
   const tag=String.fromCharCode(...bytes.slice(offset,offset+4));const length=new DataView(bytes.buffer,bytes.byteOffset+offset+4,4).getUint32(0,true);offset+=8;
   if(length>bytes.length-offset)throw Error('UNIFデータが不足しています。');
   if(tag==='MAPR')board=new TextDecoder().decode(bytes.slice(offset,offset+length)).replace(/\0.*$/s,'');
   if(/^PRG[0-9A-F]$/.test(tag))prg+=length;if(/^CHR[0-9A-F]$/.test(tag))chr+=length;offset+=length;
  }
  if(!prg||!board)throw Error('UNIFの基板名またはプログラムがありません。');
  return {kind:'nes',format:'UNIF',mapper:board,prg,chr,region:'ROM指定'};
 }
 const header=magic(bytes,[0x46,0x44,0x53,0x1a]);const start=header?16:0;const body=bytes.length-start;
 const signature=[1,...Array.from('*NINTENDO-HVC*',c=>c.charCodeAt(0))];
 if(body>0&&body%65500===0){
  const sides=body/65500;if(header&&bytes[4]!==sides)throw Error('FDSヘッダーのディスク面数と容量が一致しません。');
  for(let side=0;side<sides;side++)if(!magic(bytes.subarray(start+side*65500),signature))throw Error('FDSディスク面の識別情報が不正です。');
  return {kind:'fds',format:header?'FDS':'FDS (raw)',sides,region:'NTSC'};
 }
 throw Error('iNES / NES 2.0 / UNIF / FDSとして認識できません。対応する未圧縮ROMを選択してください。');
}
function validateBios(bytes){if(!(bytes instanceof Uint8Array)||bytes.length!==8192)throw Error('FDS BIOSは8,192バイトのdisksys.romを選択してください。');return true;}
const api={parse,validateBios,MAX_SIZE};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NESFormats=api;
})(typeof window!=='undefined'?window:globalThis);
