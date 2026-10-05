const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..')+path.sep;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fahren-hd-'));
const decoded=spawnSync('python',['-c',"from pathlib import Path\nfrom PIL import Image\nfrom io import BytesIO\nimport base64,re,json,sys\nroot=Path(sys.argv[1]); scratch=Path(sys.argv[2])\nfor item in json.loads((root/'assets/zelda-like/hd/manifest.json').read_text())['assets']:\n    svg=(root/'assets/zelda-like/hd'/item['file']).read_text()\n    payload=re.search(r'data:image/webp;base64,([^\"]+)',svg)[1]\n    image=Image.open(BytesIO(base64.b64decode(payload))).convert('RGBA')\n    assert image.size == (item['width'],item['height']), item['file']\n    (scratch/(item['file'].replace('.svg','')+'.rgba')).write_bytes(image.tobytes())\n",root,scratch],{encoding:'utf8'});
if(decoded.status!==0){fs.rmSync(scratch,{recursive:true,force:true});throw new Error('Python with Pillow is required to decode atlas pixels: '+decoded.stderr);}
const manifest=JSON.parse(fs.readFileSync(root+'assets/zelda-like/hd/manifest.json'));
const atlases=new Map(manifest.assets.map(a=>[a.file,{...a,pixels:fs.readFileSync(path.join(scratch,a.file.replace('.svg','')+'.rgba'))}]));
const calls=[],texts=[];
function context(canvas) {
    const obj={canvas,fillText(text){texts.push(text)},createLinearGradient(){return {addColorStop(){}}},
        drawImage(image,...args){
            assert(image,'Missing draw image');
            assert(args.every(Number.isFinite),'Non-finite draw dimensions');
            this.last={image,args};calls.push({image,args});
        },
        getImageData(x,y,w,h){
            const {image,args}=this.last;
            const [sx,sy,sw,sh]=args;
            const data=new Uint8ClampedArray(w*h*4);
            for(let py=0;py<h;py++) for(let px=0;px<w;px++) {
                const ix=Math.min(image.naturalWidth-1,Math.max(0,Math.floor(sx+px/w*sw)));
                const iy=Math.min(image.naturalHeight-1,Math.max(0,Math.floor(sy+py/h*sh)));
                const offset=(iy*image.naturalWidth+ix)*4;
                data.set(image.pixels.subarray(offset,offset+4),(py*w+px)*4);
            }
            return {data};
        }
    };
    return new Proxy(obj,{get:(o,key)=>o[key]??(()=>{})});
}
function element(){const e={width:768,height:720,textContent:'',addEventListener(){}};e.context=context(e);e.getContext=()=>e.context;return e;}
class Image {
    set src(value){
        this._src=value;
        const a=atlases.get(value.split('/').pop());
        if(a){this.naturalWidth=this.width=a.width;this.naturalHeight=this.height=a.height;this.pixels=a.pixels;queueMicrotask(()=>this.onload?.());}
    }
}
const storage=new Map();
let raf;
const sandbox={console,Math:Object.create(Math),Date,Image,performance:{now:()=>1000},
    document:{getElementById:element,createElement:element},window:{addEventListener(){}},navigator:{},
    requestAnimationFrame(fn){raf=fn},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(root+'assets/zelda-like/hd/graphics.js','utf8'),sandbox);
const html=fs.readFileSync(root+'zelda_like.html','utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
    // Drain the actual async atlas loader, using the generated artwork's decoded pixels.
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(run('graphicsReady'),true);
    assert.equal(run('canvas.width'),768);assert.equal(run('canvas.height'),720);
    assert.equal(run('FahrenVisuals.sheets.length'),14);
    assert.equal(run('FahrenVisuals.sheets.reduce((n,s)=>n+s.cols*s.rows,0)'),232);
    assert(run('Object.keys(ENEMY_PROFILES).every(type => type === "worm" ? [1,2,3,4].every(n=>sprites[`worm_emerge_${n}`]&&sprites[`worm_hidden_${n}`]) : [1,2,3,4].every(n=>sprites[`${type}_${n}`]))'));
    assert(run('sprites.hero_down_1.image.width===84 && sprites.boss_gran_4.image.width===150'));
    console.log('PASS all 232 generated frames loaded, every enemy/boss covered, HD backing resolution');
    run('startNewGame();');
    // Render all 625 rooms, all species and all four animation frames.
    run(`for(let y=WORLD_MIN;y<=WORLD_MAX;y++) for(let x=WORLD_MIN;x<=WORLD_MAX;x++) {
        currentRoomX=x;currentRoomY=y;const room=getRoom(x,y);drawRoom(room,0,0);
        for(const actor of [...(room.enemies||[]),...(room.npcs||[])]) for(let f=1;f<=4;f++){actor.animFrame=f;actor.draw();}
    }`);
    console.log('PASS all 625 rooms and actor animation frames render without missing/non-finite images');
    for(const tile of [0,3,4,5,6]) assert.equal(run(`isSolid(${tile})`),false);
    for(const tile of [1,2,20,21,22,23,24,25,26,27,28,40,41,42,43,999]) assert.equal(run(`isSolid(${tile})`),true);
    run(`startNewGame(); const passageRoom=getRoom(currentRoomX,currentRoomY);
        passageRoom.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));
        passageRoom.tiles[3][4]=1;player.x=4*TILE;player.y=4*TILE;keys.KeyW=true;`);
    const initial=run('player.y');run('for(let n=0;n<20;n++)player.update();');
    assert.equal(run('player.y'),initial);assert.equal(run('player.animFrame'),1,'Blocked player must not walk');
    run('passageRoom.tiles[3][4]=5;for(let n=0;n<4;n++)player.update();');
    assert(run('player.y')<initial,'Flowers are walkable');
    run('keys.KeyW=false;passageRoom.tiles[3][4]=43;player.isAttacking=true;player.attackTimer=12;player.swordHitbox={x:64,y:48,w:16,h:16}; updatePlaying();');
    assert.equal(run('passageRoom.tiles[3][4]'),0);assert.equal(run('isSolid(passageRoom.tiles[3][4])'),false);
    console.log('PASS solid/passable terrain, wall stop, flowers, cuttable bushes');
    run('const gait={animFrame:1,animTimer:0,baseSpeed:1.5};const seen=new Set();for(let i=0;i<32;i++){advanceWalk(gait,1.5);seen.add(gait.animFrame);}');
    assert.equal(run('seen.size'),4);run('advanceWalk(gait,0);');assert.equal(run('gait.animFrame'),1);
    run('const wing={animFrame:1,animTimer:0};const wings=new Set();for(let i=0;i<30;i++){advanceWalk(wing,0,true);wings.add(wing.animFrame);}');
    assert.equal(run('wings.size'),4);
    console.log('PASS four-frame gait, stopped idle, continuous wing/spirit animation');
    run('player.update=()=>{};Math.random=()=>0.9;');
    for(const weapon of ['sword','arrow','fire','bomb']){
        run(`startNewGame();currentRoomX=10;currentRoomY=-8;const r${weapon}=getRoom(10,-8);const b${weapon}=r${weapon}.enemies[0];b${weapon}.x=100;b${weapon}.y=80;b${weapon}.health=1;b${weapon}.update=()=>{};player.x=170;player.y=130;player.invincibleTimer=100;r${weapon}.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));`);
        if(weapon==='sword')run('player.isAttacking=true;player.swordHitbox={x:100,y:80,w:32,h:32};');
        else if(weapon==='bomb')run('const bomb=new Bomb(100,80);bomb.timer=1;playerProjectiles.push(bomb);');
        else run(`playerProjectiles.push(new PlayerProjectile(100,80,0,0,'${weapon}'));`);
        run('updatePlaying();draw();');assert.equal(run('gameState'),'ENDING',weapon);
        run('endingFrame=60;keyPress.Enter=true;update();');assert.equal(run('gameState'),'TITLE');
    }
    run('startNewGame();sacredStones["Emerald Stone"]=true;writeSaveSlot(1);applySaveData(readSaveSlot(1));');
    assert.equal(run('sacredStones["Emerald Stone"]'),true);assert.equal(run('gameState'),'PLAYING');
    console.log('PASS four weapon victories, ending/title return, save/load regression');
    console.log('ALL HD CHECKS PASSED (generated pixels + actual game logic; Canvas calls instrumented)');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>fs.rmSync(scratch,{recursive:true,force:true}));
