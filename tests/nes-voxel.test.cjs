const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const V=require('../assets/nes/voxel-data.js');
test('Core unpacking exception is confined to the 2D player CSP',()=>{
 const read=name=>fs.readFileSync(path.join(__dirname,'../',name),'utf8'),csp=html=>html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 assert.ok(csp(read('assets/nes/player.html')).includes("'unsafe-eval'"));
 for(const name of ['retro-emulator.html','assets/nes/player3d.html']){assert.ok(!csp(read(name)).includes("'unsafe-eval'"));assert.ok(csp(read(name)).includes("script-src-attr 'none'"));}
});
test('Profiles validate, bound geometry parameters and distinguish layer / palette',()=>{
 const p=V.preset('mario');p.rules.push({layer:'background',tile:1,palette:2,z:-10,depth:18});const valid=V.validate(p),table=V.compile(valid);
 assert.equal(table.background[2*512+1].depth,18);assert.equal(table.background[1].depth,5);assert.equal(table.sprite[2*512+1].depth,8);
 for(const change of [{hudRows:300},{sprite:{z:0,depth:99}},{romHash:'not-a-hash'},{rules:[{layer:'sprite',tile:512,z:0,depth:1}]}])assert.throws(()=>V.validate({...p,...change}));
});
test('Geometry retains independent background and sprite pixels and real thickness',()=>{
 const make=()=>({tile:new Int16Array(61440).fill(-1),color:new Uint32Array(61440),palette:new Uint8Array(61440)}),capture={bg:make(),sprite:make(),behind:new Uint8Array(61440)};
 const at=100*256+100;capture.bg.tile[at]=1;capture.sprite.tile[at]=2;capture.bg.color[at]=0x0000ff;capture.sprite.color[at]=0xff0000;
 const p=V.preset('generic'),mesh=V.geometry(capture,p);assert.equal(mesh.count,2);assert.equal(mesh.data[5],3);assert.equal(mesh.data[14],7);assert.equal(mesh.data[6],1);assert.equal(mesh.data[17],1);
 capture.behind[at]=1;const behind=V.geometry(capture,p);assert.ok(behind.data[11]+behind.data[14]/2<p.background.z-p.background.depth);
 p.rules.push({layer:'sprite',tile:2,z:8,depth:0});assert.equal(V.geometry(capture,p).count,1);
});
test('HUD is omitted from geometry, matching runs merge, hidden pixels remain absent',()=>{
 const make=()=>({tile:new Int16Array(61440).fill(-1),color:new Uint32Array(61440),palette:new Uint8Array(61440)}),capture={bg:make(),sprite:make(),behind:new Uint8Array(61440)};
 capture.bg.tile[0]=1;capture.bg.tile.fill(1,256*50,256*50+8);const p=V.preset('mario');assert.equal(V.geometry(capture,p).count,1);assert.equal(V.geometry(capture,p).data[3],8);
});
if(process.env.NES_TEST_CORE&&process.env.NES_TEST_ROM){
 const {NES}=require(path.resolve(process.env.NES_TEST_CORE)),rom=fs.readFileSync(path.resolve(process.env.NES_TEST_ROM));
 test('Actual NROM PPU capture preserves emulation and captures both layers',()=>{
  let a,b;const plain=new NES({emulateSound:false,onFrame:buffer=>a=buffer.slice()}),voxel=new NES({emulateSound:false,onFrame:buffer=>b=buffer.slice()});plain.loadROM(rom);voxel.loadROM(rom);plain.ppu.clipToTvSize=voxel.ppu.clipToTvSize=false;
  const capture=new V.Capture(voxel);for(let i=0;i<100;i++){plain.frame();voxel.frame();}
  assert.deepEqual(a,b);assert.deepEqual(plain.cpu.toJSON(),voxel.cpu.toJSON());
  assert.ok(capture.bg.tile.filter(x=>x>=0).length>8000);assert.ok(capture.sprite.tile.filter(x=>x>=0).length>100);
  const at=capture.sprite.tile.findIndex(x=>x>=0),pick=capture.pick(at%256,at>>8);assert.equal(pick.layer,'sprite');assert.equal(pick.tile,capture.sprite.tile[at]);
  assert.ok(V.geometry(capture,V.preset('generic')).count>100);capture.dispose();
  const state=voxel.toJSON(),restored=new NES({emulateSound:false});restored.loadROM(rom);restored.fromJSON(state);const restoredCapture=new V.Capture(restored);restored.frame();voxel.frame();assert.deepEqual(restored.cpu.toJSON(),voxel.cpu.toJSON());assert.ok(restoredCapture.bg.tile.some(id=>id>=0));restoredCapture.dispose();
 });
}
