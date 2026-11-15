// Fetch an official, pinned test core; generate an original ROM locally.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
(async()=>{
 const root=__dirname,generated=path.join(root,'.generated');fs.mkdirSync(generated,{recursive:true});
 const core=path.join(generated,'jsnes.cjs');
 if(!fs.existsSync(core)){const response=await fetch('https://unpkg.com/jsnes@2.1.0/dist/jsnes.js');if(!response.ok)throw Error('JSNES test core download failed: '+response.status);fs.writeFileSync(core,await response.text());}
 const make=spawnSync(process.execPath,[path.join(root,'make-scene.cjs')],{stdio:'inherit'});if(make.status!==0)process.exit(make.status||1);
 const files=['nes-emulator.test.cjs','nes-voxel.test.cjs','nes-voxel-player.test.cjs'].map(name=>path.join(root,name));
 const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',env:{...process.env,NES_TEST_CORE:core,NES_TEST_ROM:path.join(generated,'smoke-test.nes')}});process.exit(result.status||0);
})().catch(err=>{console.error(err.message);process.exit(1);});
