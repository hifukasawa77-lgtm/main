const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto').webcrypto;
const V=require('../assets/nes/voxel-data.js'),formats=require('../assets/nes/formats.js');
test('3D bridge filters source/session and rejects unsupported ROM before startup',async()=>{
 const {ctx,listeners,messages}=environment();
 const rom=new Uint8Array(16+16384+8192);rom.set([78,69,83,26,1,1,0x10]);const file=new File([rom],'mapper1.nes');
 await listeners.message({origin:'https://evil.test',source:ctx.parent,data:{type:'boot',session:2,rom:file}});assert.equal(messages.length,1);
 await listeners.message({origin:'https://example.test',source:{},data:{type:'boot',session:2,rom:file}});assert.equal(messages.length,1);
 await listeners.message({origin:'https://example.test',source:ctx.parent,data:{type:'boot',session:2,rom:file}});assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/mapper 0/);
});
function environment(core={NES:class{}},Renderer=class{}){
 const listeners={},messages=[],elementListeners={};
 const context2d={createImageData:()=>({data:new Uint8ClampedArray(256*240*4)}),putImageData:()=>{},clearRect:()=>{},drawImage:()=>{}};
 const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',getContext:()=>context2d,addEventListener:(k,f)=>elementListeners[id+':'+k]=f,getBoundingClientRect:()=>({left:0,top:0,width:256,height:240})});return elements.get(id);};
 let raf;
 const ctx=vm.createContext({parent:{postMessage:d=>messages.push(d)},location:{origin:'https://example.test'},File,Blob,URL,Uint8Array,Uint8ClampedArray,Uint32Array,Float32Array,Int16Array,NESVoxelData:V,NESFormats:formats,jsnes:core,NESVoxelRenderer:Renderer,crypto,performance:{now:()=>0},requestAnimationFrame:f=>(raf=f,1),cancelAnimationFrame:()=>{},navigator:{getGamepads:()=>[]},setTimeout,document:{getElementById:element,addEventListener:()=>{},hidden:false,createElement:()=>({click(){}})},addEventListener:(k,f)=>listeners[k]=f});ctx.window=ctx;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/nes/player3d.js'),'utf8'),ctx);
 return {ctx,listeners,messages,elementListeners,step:time=>raf(time)};
}
if(process.env.NES_TEST_CORE&&process.env.NES_TEST_ROM){
 const core=require(path.resolve(process.env.NES_TEST_CORE)),rom=fs.readFileSync(path.resolve(process.env.NES_TEST_ROM));
 test('3D runtime boots, advances frames, pauses, resets and protects held inputs',async()=>{
  let instance,draws=0;class NES extends core.NES{constructor(options){super(options);instance=this;}}
  const e=environment({NES},class{draw(){draws++;}dispose(){}}),message=data=>e.listeners.message({origin:'https://example.test',source:e.ctx.parent,data:{session:7,...data}});
  await message({type:'boot',rom:new File([rom],'test.nes'),profile:V.preset('generic')});assert.equal(e.messages.at(-1).type,'started');
  for(let i=1;i<60;i++)e.step(i*17);assert.ok(draws>10);const cpu=instance.cpu.REG_PC;
  await message({type:'input',button:8,value:1});assert.equal(instance.controllers[1].state[0],0x41);
  await message({type:'input',session:6,button:8,value:0});assert.equal(instance.controllers[1].state[0],0x41);
  e.listeners.keydown({key:'x',target:{tagName:'CANVAS'},preventDefault(){}});await message({type:'input',button:8,value:0});assert.equal(instance.controllers[1].state[0],0x41);
  e.listeners.keyup({key:'x'});assert.equal(instance.controllers[1].state[0],0x40);
  await message({type:'pause',paused:true});e.step(1200);assert.equal(instance.cpu.REG_PC,cpu);
  const previous=instance;await message({type:'reset'});assert.notEqual(instance,previous);e.step(1217);assert.equal(instance.crashed,false);
 });
}
